/**
 * Session hook - client-first optimistic updates
 *
 * Architecture:
 * 1. Cache is the source of truth for UI
 * 2. Optimistic updates applied immediately
 * 3. Server sync is fire-and-forget (background persistence)
 * 4. Server responses do NOT overwrite cache (prevents race conditions)
 *
 * This eliminates race conditions where server responses with stale data
 * would overwrite newer local changes.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import { sessionApi } from '@/lib/api/session';
import { APIError } from '@/lib/api/client';
import type { SessionState, SessionResponse } from '@/types/session';
import {
  clearStoredSessionIdentity,
  commitCreatedSession,
  getSharedCreatePromise,
  getSharedSessionId,
  subscribeSessionId,
} from '@/lib/session/session-identity';
import { ensureUserSession } from '@/lib/session/ensure-user-session';
import { useAuthStore } from '@/stores/auth-store';
import {
  BACKUP_INTERVAL_MS,
  SYNC_DEBOUNCE_MS,
  getDefaultSessionState,
  hasSessionUpdates,
  mergeSessionUpdates,
  saveSessionBackup,
} from '@/lib/session/session-sync';

export function useSession() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const isAuthed = authStatus === 'authenticated';
  const isCreatingRef = useRef(false);

  // Session ID state
  const [sessionId, setSessionId] = useState<string | null>(getSharedSessionId);

  // Pending updates to sync to server (accumulated between syncs)
  const pendingUpdatesRef = useRef<Partial<SessionState>>({});
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch session from server (initial load only)
  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery<SessionResponse>({
    queryKey: ['session', sessionId],
    queryFn: () => sessionApi.get(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity,
    retry: false,
  });

  // Create session mutation - restores from backup if available
  const createMutation = useMutation({
    mutationFn: async () => {
      const inFlight = getSharedCreatePromise();
      if (inFlight) {
        return (await inFlight) as SessionResponse;
      }
      return ensureUserSession() as Promise<SessionResponse>;
    },
    onSuccess: (newSession) => {
      if (!newSession) return;
      const newId = newSession.session_id;
      queryClient.setQueryData(['session', newId], newSession);
      if (sessionId && sessionId !== newId) {
        queryClient.removeQueries({ queryKey: ['session', sessionId] });
      }
    },
  });

  // Auto-create session if needed
  useEffect(() => {
    const sessionFetchMissing =
      error instanceof APIError &&
      (error.status === 404 || error.status === 403);
    const shouldCreate =
      isAuthed &&
      (!sessionId || sessionFetchMissing) &&
      !isCreatingRef.current &&
      !createMutation.isPending;

    if (shouldCreate) {
      isCreatingRef.current = true;
      if (sessionFetchMissing && sessionId) {
        clearStoredSessionIdentity();
        queryClient.removeQueries({ queryKey: ['session', sessionId] });
      }
      createMutation.mutate(undefined, {
        onSettled: () => {
          isCreatingRef.current = false;
        },
      });
    }
  }, [sessionId, error, createMutation, isAuthed, queryClient]);

  // Background sync mutation - fire and forget
  const syncMutation = useMutation({
    mutationFn: (state: Partial<SessionState>) =>
      sessionApi.update(sessionId!, state),
    // Intentionally no onSuccess - we don't use server response
    // Cache already has correct data from optimistic update
    onError: (err) => {
      console.error('[useSession] Sync failed:', err);
      // Could add retry logic or user notification here
    },
  });

  // Sync pending updates to server (debounced)
  const scheduleSyncToServer = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const updates = pendingUpdatesRef.current;
      if (hasSessionUpdates(updates) && sessionId) {
        pendingUpdatesRef.current = {};
        syncMutation.mutate(updates);
      }
      syncTimeoutRef.current = null;
    }, SYNC_DEBOUNCE_MS);
  }, [sessionId, syncMutation]);

  // Update session - optimistic first, sync in background
  const updateSession = useCallback(
    (updates: Partial<SessionState>) => {
      if (!sessionId) {
        console.warn('[useSession] updateSession called but sessionId is null - update ignored!', updates);
        return;
      }

      // Accumulate updates for server sync
      pendingUpdatesRef.current = mergeSessionUpdates(pendingUpdatesRef.current, updates);

      // Update cache immediately (optimistic)
      queryClient.setQueryData<SessionResponse | undefined>(
        ['session', sessionId],
        (old) => {
          if (!old) {
            console.warn('[useSession] Cache is empty, cannot apply update', { sessionId, updates });
            return old;
          }
          return { ...old, ...updates };
        }
      );

      // Schedule background sync
      scheduleSyncToServer();
    },
    [sessionId, queryClient, scheduleSyncToServer]
  );

  // Manual session reset
  const resetSession = useCallback(async () => {
    // Clear pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    pendingUpdatesRef.current = {};

    const newSession = await sessionApi.create(getDefaultSessionState());
    commitCreatedSession(newSession);
    queryClient.setQueryData(['session', newSession.session_id], newSession);
    if (sessionId && sessionId !== newSession.session_id) {
      queryClient.removeQueries({ queryKey: ['session', sessionId] });
    }
    return newSession;
  }, [sessionId, queryClient]);

  useEffect(() => subscribeSessionId(setSessionId), []);

  // Periodic backup to sessionStorage (protects against session expiry)
  useEffect(() => {
    if (!session) return;

    // Initial backup
    saveSessionBackup(session);

    // Periodic backup
    const intervalId = setInterval(() => {
      const currentSession = queryClient.getQueryData<SessionResponse>([
        'session',
        sessionId,
      ]);
      if (currentSession) {
        saveSessionBackup(currentSession);
      }
    }, BACKUP_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [session, sessionId, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    session,
    sessionId,
    isLoading: isLoading || createMutation.isPending,
    error:
      createMutation.isError
        ? createMutation.error
        : error instanceof APIError && error.status === 404
          ? null
          : error,
    updateSession,
    resetSession,
    refetch,
    isUpdating: syncMutation.isPending,
  };
}

