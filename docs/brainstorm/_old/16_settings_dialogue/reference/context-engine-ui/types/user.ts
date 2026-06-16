export type UserRole = "user" | "admin";

export type CurrentUser = {
  id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
};

export type AdminUser = CurrentUser;

export type LoginPayload = {
  username: string;
  password: string;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  role: UserRole;
};

export type UpdateUserPayload = {
  role: UserRole;
};

export type ResetPasswordPayload = {
  new_password: string;
};

