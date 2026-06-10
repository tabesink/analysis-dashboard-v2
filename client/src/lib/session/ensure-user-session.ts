/**
 * Ensures a server-backed user session exists after auth boundary transitions.
 * Runs outside React so login can await session creation before navigation.
 */

import { sessionApi } from '@/lib/api/session';
import type { SessionResponse } from '@/types/session';
import {
  commitCreatedSession,
  getSharedCreatePromise,
  getSharedSessionId,
  setSharedCreatePromise,
} from '@/lib/session/session-identity';
import {
  getDefaultSessionState,
  getSessionBackup,
} from '@/lib/session/session-sync';

async function createUserSession(): Promise<SessionResponse> {
  const backup = getSessionBackup();
  const initialState = getDefaultSessionState(backup);
  const newSession = await sessionApi.create(initialState);
  commitCreatedSession(newSession);
  return newSession;
}

export async function ensureUserSession(): Promise<SessionResponse | null> {
  const existingId = getSharedSessionId();
  if (existingId) {
    return null;
  }

  const inFlight = getSharedCreatePromise();
  if (inFlight) {
    return (await inFlight) as SessionResponse;
  }

  const promise = createUserSession().finally(() => {
    setSharedCreatePromise(null);
  });
  setSharedCreatePromise(promise);
  return promise;
}
