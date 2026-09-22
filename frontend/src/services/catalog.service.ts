import { api } from "@/services/api";
import type { ActivityMaster, Circle, Product } from "@/types";

export const catalogService = {
  async products(includeInactive = false): Promise<Product[]> {
    const { data } = await api.get<Product[]>("/products", {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  async createProduct(productName: string): Promise<Product> {
    const { data } = await api.post<Product>("/products", { product_name: productName });
    return data;
  },

  async updateProduct(id: number, payload: Partial<Product>): Promise<Product> {
    const { data } = await api.put<Product>(`/products/${id}`, payload);
    return data;
  },

  async deleteProduct(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async circles(includeInactive = false): Promise<Circle[]> {
    const { data } = await api.get<Circle[]>("/circles", {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  async createCircle(circleName: string): Promise<Circle> {
    const { data } = await api.post<Circle>("/circles", { circle_name: circleName });
    return data;
  },

  async updateCircle(id: number, payload: Partial<Circle>): Promise<Circle> {
    const { data } = await api.put<Circle>(`/circles/${id}`, payload);
    return data;
  },

  async deleteCircle(id: number): Promise<void> {
    await api.delete(`/circles/${id}`);
  },

  async activityMasters(includeInactive = false): Promise<ActivityMaster[]> {
    const { data } = await api.get<ActivityMaster[]>("/activity-masters", {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  async createActivityMaster(
    activityName: string,
    description?: string | null,
  ): Promise<ActivityMaster> {
    const { data } = await api.post<ActivityMaster>("/activity-masters", {
      activity_name: activityName,
      description: description ?? null,
    });
    return data;
  },

  async updateActivityMaster(
    id: number,
    payload: Partial<ActivityMaster>,
  ): Promise<ActivityMaster> {
    const { data } = await api.put<ActivityMaster>(`/activity-masters/${id}`, payload);
    return data;
  },

  async deleteActivityMaster(id: number): Promise<void> {
    await api.delete(`/activity-masters/${id}`);
  },
};
