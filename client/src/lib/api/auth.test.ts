import { describe, expect, it, vi } from 'vitest';

import { authApi } from './auth';
import { get } from './client';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  return {
    ...actual,
    get: vi.fn(),
    post: vi.fn(),
  };
});

describe('auth api', () => {
  it('uses an extended timeout for /auth/me bootstrap probes', async () => {
    vi.mocked(get).mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      role: 'admin',
      can_write: true,
    });

    await authApi.me();

    expect(get).toHaveBeenCalledWith('/api/v1/auth/me', 120_000, undefined);
  });
});
