import { api } from "@/services/api";
import type {
  CircleSummaryItem,
  DashboardSummary,
  EngineerWorkloadItem,
  StatusBreakdownItem,
} from "@/types";

export const dashboardService = {
  async summary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>("/dashboard/summary");
    return data;
  },

  async circleSummary(): Promise<CircleSummaryItem[]> {
    const { data } = await api.get<CircleSummaryItem[]>("/dashboard/circle-summary");
    return data;
  },

  async engineerWorkload(limit = 12): Promise<EngineerWorkloadItem[]> {
    const { data } = await api.get<EngineerWorkloadItem[]>("/dashboard/engineer-workload", {
      params: { limit },
    });
    return data;
  },

  async statusBreakdown(): Promise<StatusBreakdownItem[]> {
    const { data } = await api.get<StatusBreakdownItem[]>("/dashboard/status-breakdown");
    return data;
  },
};
