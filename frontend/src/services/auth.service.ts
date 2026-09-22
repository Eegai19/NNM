import { api } from "@/services/api";
import type { AuthSession, User } from "@/types";

export interface LoginPayload {
  username: string;
  password: string;
  remember_me?: boolean;
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    const { data } = await api.post<AuthSession>("/auth/login", payload);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};
