import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APIError } from '@/lib/api/client';
import { authApi, type CurrentUser } from '@/lib/api/auth';
import { useAuthStore } from './auth-store';

vi.mock('@/lib/api/auth', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    heartbeatPresence: vi.fn(),
  },
}));

vi.mock('@/lib/session/session-identity', () => ({
  clearStoredSessionIdentity: vi.fn(),
}));

vi.mock('@/lib/session/ensure-user-session', () => ({
  ensureUserSession: vi.fn(),
}));

describe('auth store bootstrap hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, status: 'idle' });
  });

  it('keeps auth status idle after transient bootstrap failure with no prior user', async () => {
    vi.mocked(authApi.me).mockRejectedValue(
      new APIError(504, 'Gateway Timeout', null),
    );

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().status).toBe('idle');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('keeps prior authenticated user on transient bootstrap failure', async () => {
    const existingUser: CurrentUser = {
      id: 'user-1',
      username: 'writer',
      role: 'user',
      can_write: true,
    };
    useAuthStore.setState({ user: existingUser, status: 'authenticated' });
    vi.mocked(authApi.me).mockRejectedValue(
      new APIError(499, 'Request Cancelled', null),
    );

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user).toEqual(existingUser);
  });
});
