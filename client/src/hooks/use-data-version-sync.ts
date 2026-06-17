'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth';
import { syncApi } from '@/lib/api/sync';
import { DATABASE_DATA_INVALIDATION_KEYS } from '@/lib/metadata-save-cache';
import { useInspectDamageResultsStore } from '@/stores/inspect-damage-results-store';
import { useAuthStore } from '@/stores/auth-store';

const SYNC_POLL_INTERVAL_MS = 10_000;
const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;

function invalidateSyncSensitiveQueries(queryClient: ReturnType<typeof useQueryClient>) {
  DATABASE_DATA_INVALIDATION_KEYS.filter((key) => key !== 'sync-version').forEach(
    (queryKey) => {
      void queryClient.invalidateQueries({ queryKey: [queryKey] });
    }
  );
}

export function useDataVersionSync() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const lastSeenVersionRef = useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: ['sync-version'],
    queryFn: syncApi.getVersion,
    enabled: authStatus === 'authenticated',
    staleTime: 0,
    refetchInterval: SYNC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: false,
  });

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      lastSeenVersionRef.current = null;
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }

    const sendHeartbeat = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      try {
        const activeArea =
          typeof window !== 'undefined' ? window.location.pathname : undefined;
        await authApi.heartbeatPresence(activeArea);
      } catch {
        // Best-effort signal only; do not interrupt data-sync flow on heartbeat failures.
      }
    };

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authStatus]);

  useEffect(() => {
    const currentVersion = data?.data_version;
    if (typeof currentVersion !== 'number') return;

    const previousVersion = lastSeenVersionRef.current;
    if (previousVersion === null) {
      lastSeenVersionRef.current = currentVersion;
      return;
    }

    if (currentVersion > previousVersion) {
      invalidateSyncSensitiveQueries(queryClient);
      useInspectDamageResultsStore.getState().clearCachedResults();
    }
    lastSeenVersionRef.current = currentVersion;
  }, [data?.data_version, queryClient]);
}
