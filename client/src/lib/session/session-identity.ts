/**
 * In-memory session identity shared across useSession hook instances.
 * Persisted session IDs live in localStorage (see session-sync.ts).
 */

import type { QueryClient } from '@tanstack/react-query';

import type { SessionResponse } from '@/types/session';
import {
  SESSION_ID_KEY,
  clearSessionBackup,
  getInitialSessionId,
} from '@/lib/session/session-sync';

let sharedSessionId: string | null | undefined;
let sharedCreatePromise: Promise<unknown> | null = null;
const sessionIdListeners = new Set<(sessionId: string | null) => void>();

export function getSharedSessionId(): string | null {
  if (sharedSessionId === undefined) {
    sharedSessionId = getInitialSessionId();
  }
  return sharedSessionId;
}

export function publishSessionId(nextSessionId: string | null): void {
  sharedSessionId = nextSessionId;
  sessionIdListeners.forEach((listener) => listener(nextSessionId));
}

export function subscribeSessionId(
  listener: (sessionId: string | null) => void,
): () => void {
  sessionIdListeners.add(listener);
  return () => {
    sessionIdListeners.delete(listener);
  };
}

export function getSharedCreatePromise(): Promise<unknown> | null {
  return sharedCreatePromise;
}

export function setSharedCreatePromise(promise: Promise<unknown> | null): void {
  sharedCreatePromise = promise;
}

/** Clear module-level session identity after login/logout storage wipes. */
export function resetClientSessionIdentity(): void {
  sharedSessionId = undefined;
  sharedCreatePromise = null;
  publishSessionId(null);
}

/** Drop persisted and in-memory session identity (e.g. login, logout, DB switch). */
export function clearStoredSessionIdentity(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_ID_KEY);
  }
  clearSessionBackup();
  resetClientSessionIdentity();
  invalidateCachedSessionQueries();
}

let invalidateSessionQueries: (() => void) | null = null;

export function registerSessionQueryInvalidator(fn: (() => void) | null): void {
  invalidateSessionQueries = fn;
}

export function invalidateCachedSessionQueries(): void {
  invalidateSessionQueries?.();
}

let sessionQueryClient: QueryClient | null = null;

export function registerSessionQueryClient(client: QueryClient | null): void {
  sessionQueryClient = client;
}

export function getSessionQueryClient(): QueryClient | null {
  return sessionQueryClient;
}

export function commitCreatedSession(newSession: SessionResponse): void {
  const newId = newSession.session_id;
  localStorage.setItem(SESSION_ID_KEY, newId);
  publishSessionId(newId);
  sessionQueryClient?.setQueryData(['session', newId], newSession);
  clearSessionBackup();
}
