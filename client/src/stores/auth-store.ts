import { create } from 'zustand';

import { APIError, AUTH_UNAUTHORIZED_EVENT } from '@/lib/api/client';
import {
  authApi,
  type ChangePasswordRequest,
  type CurrentUser,
} from '@/lib/api/auth';
import { clearStoredSessionIdentity } from '@/lib/session/session-identity';
import { ensureUserSession } from '@/lib/session/ensure-user-session';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: CurrentUser | null;
  status: AuthStatus;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
  refresh: () => Promise<void>;
  forceUnauthenticated: () => void;
  logout: () => Promise<void>;
}

let bootstrapAbortController: AbortController | null = null;
const TRANSIENT_AUTH_ERROR_STATUSES = new Set([0, 499, 502, 503, 504]);

function cancelAuthBootstrap(): void {
  bootstrapAbortController?.abort();
  bootstrapAbortController = null;
}

function clearClientSessionStorage(): void {
  clearStoredSessionIdentity();
}

function isTransientBootstrapError(error: unknown): boolean {
  return error instanceof APIError && TRANSIENT_AUTH_ERROR_STATUSES.has(error.status);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  bootstrap: async () => {
    cancelAuthBootstrap();
    const controller = new AbortController();
    bootstrapAbortController = controller;
    const previous = get();
    set({ status: 'loading' });
    try {
      const user = await authApi.me({
        signal: controller.signal,
        suppressAuthEvent: true,
      });
      if (controller.signal.aborted) return;
      set({ user, status: 'authenticated' });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isTransientBootstrapError(error)) {
        if (previous.status === 'authenticated' && previous.user) {
          set({ user: previous.user, status: 'authenticated' });
          return;
        }
        set({ user: null, status: 'idle' });
        return;
      }
      const { status, user } = get();
      if (status === 'authenticated' && user) {
        return;
      }
      if (error instanceof APIError && error.status === 401) {
        set({ user: null, status: 'unauthenticated' });
        return;
      }
      set({ user: null, status: 'unauthenticated' });
    } finally {
      if (bootstrapAbortController === controller) {
        bootstrapAbortController = null;
      }
    }
  },
  login: async (username, password) => {
    cancelAuthBootstrap();
    set({ status: 'loading' });
    const user = await authApi.login({ username, password });
    clearClientSessionStorage();
    await ensureUserSession();
    set({ user, status: 'authenticated' });
  },
  register: async (username, password) => {
    cancelAuthBootstrap();
    set({ status: 'loading' });
    const user = await authApi.register({ username, password });
    clearClientSessionStorage();
    await ensureUserSession();
    set({ user, status: 'authenticated' });
  },
  changePassword: async (payload) => {
    await authApi.changePassword(payload);
  },
  refresh: async () => {
    try {
      const user = await authApi.me();
      set({ user, status: 'authenticated' });
    } catch {
      // Leave existing state untouched on transient failures.
    }
  },
  forceUnauthenticated: () => {
    clearClientSessionStorage();
    set({ user: null, status: 'unauthenticated' });
    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      window.location.replace('/login');
    }
  },
  logout: async () => {
    cancelAuthBootstrap();
    try {
      await authApi.logout();
    } finally {
      clearClientSessionStorage();
      set({ user: null, status: 'unauthenticated' });
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
  },
}));

if (typeof window !== 'undefined') {
  const authWindow = window as Window & { __rspUnauthorizedListener?: boolean };
  if (!authWindow.__rspUnauthorizedListener) {
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, () => {
      useAuthStore.getState().forceUnauthenticated();
    });
    authWindow.__rspUnauthorizedListener = true;
  }
}

export const selectIsAdmin = (state: { user: CurrentUser | null }) =>
  state.user?.role === 'admin';

export const selectCanWrite = (state: { user: CurrentUser | null }) =>
  state.user?.role === 'admin' || state.user?.can_write === true;
