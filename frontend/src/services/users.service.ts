import { api, cleanParams } from "@/services/api";
import type { Page, User, UserBrief, UserRole } from "@/types";

export interface UserPayload {
  name: string;
  username: string;
  password: string;
  mobile_number?: string | null;
  role: UserRole;
  is_active?: boolean;
}

export interface UserUpdatePayload {
  name?: string;
  mobile_number?: string | null;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserFilters {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export const usersService = {
  async list(filters: UserFilters = {}): Promise<Page<User>> {
    const { data } = await api.get<Page<User>>("/users", { params: cleanParams({ ...filters }) });
    return data;
  },

  async assignable(): Promise<UserBrief[]> {
    const { data } = await api.get<UserBrief[]>("/users/assignable");
    return data;
  },

  async get(userId: number): Promise<User> {
    const { data } = await api.get<User>(`/users/${userId}`);
    return data;
  },

  async create(payload: UserPayload): Promise<User> {
    const { data } = await api.post<User>("/users", payload);
    return data;
  },

  async update(userId: number, payload: UserUpdatePayload): Promise<User> {
    const { data } = await api.put<User>(`/users/${userId}`, payload);
    return data;
  },

  async setStatus(userId: number, isActive: boolean): Promise<User> {
    const { data } = await api.patch<User>(`/users/${userId}/status`, null, {
      params: { is_active: isActive },
    });
    return data;
  },

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    await api.post(`/users/${userId}/reset-password`, { new_password: newPassword });
  },

  async remove(userId: number): Promise<void> {
    await api.delete(`/users/${userId}`);
  },
};
