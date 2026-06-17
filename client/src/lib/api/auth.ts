import { get, post, type RequestOptions } from './client';

const AUTH_ME_TIMEOUT_MS = 120_000;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  role: 'user' | 'admin';
  can_write: boolean;
}

export interface PresenceHeartbeatRecord {
  user_id: string;
  username: string;
  active_database: string;
  active_area: string | null;
  last_seen_at: string;
}

export interface PresenceHeartbeatResponse {
  active_database: string;
  expires_in_seconds: number;
  record: PresenceHeartbeatRecord;
}

export const authApi = {
  login: (payload: LoginRequest) =>
    post<CurrentUser>('/api/v1/auth/login', payload),
  register: (payload: RegisterRequest) =>
    post<CurrentUser>('/api/v1/auth/register', payload),
  changePassword: (payload: ChangePasswordRequest) =>
    post<void>('/api/v1/auth/change-password', payload),
  me: (options?: RequestOptions) =>
    get<CurrentUser>('/api/v1/auth/me', AUTH_ME_TIMEOUT_MS, options),
  logout: () => post<void>('/api/v1/auth/logout', {}),
  heartbeatPresence: (activeArea?: string) =>
    post<PresenceHeartbeatResponse>('/api/v1/auth/presence/heartbeat', {
      active_area: activeArea ?? null,
    }),
};
