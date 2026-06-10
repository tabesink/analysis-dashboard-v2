import { apiRequest } from "@/lib/api/client";
import type {
  AdminUser,
  CreateUserPayload,
  ResetPasswordPayload,
  UpdateUserPayload,
} from "@/types/user";

export const usersApi = {
  list() {
    return apiRequest<AdminUser[]>("/admin/users");
  },
  create(payload: CreateUserPayload) {
    return apiRequest<AdminUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update(userId: string, payload: UpdateUserPayload) {
    return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  resetPassword(userId: string, payload: ResetPasswordPayload) {
    return apiRequest<void>(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  remove(userId: string) {
    return apiRequest<void>(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },
};
