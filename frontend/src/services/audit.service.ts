import { api, cleanParams } from "@/services/api";
import type { AuditEntry, Page } from "@/types";

export interface AuditFilters {
  entity_type?: string;
  entity_id?: number;
  node_id?: number;
  action?: string;
  performed_by?: number;
  page?: number;
  page_size?: number;
}

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<Page<AuditEntry>> {
    const { data } = await api.get<Page<AuditEntry>>("/audit", {
      params: cleanParams({ ...filters }),
    });
    return data;
  },
};
