import { api, cleanParams, downloadFile } from "@/services/api";
import type {
  Assignment,
  AssignmentRole,
  AuditEntry,
  DeploymentState,
  NodeFilters,
  NodeRecord,
  NodeStatus,
  NodeSummary,
  Page,
} from "@/types";

export interface NodePayload {
  node_name: string;
  product_id: number;
  circle_id: number;
  owner_id?: number | null;
  lead_id?: number | null;
  tpm_id?: number | null;
  deployment_state?: DeploymentState;
  overall_status?: NodeStatus;
}

export const nodesService = {
  async list(filters: NodeFilters = {}): Promise<Page<NodeSummary>> {
    const { data } = await api.get<Page<NodeSummary>>("/nodes", {
      params: cleanParams({ ...filters }),
    });
    return data;
  },

  async get(nodeId: number): Promise<NodeSummary> {
    const { data } = await api.get<NodeSummary>(`/nodes/${nodeId}`);
    return data;
  },

  async canModify(nodeId: number): Promise<boolean> {
    const { data } = await api.get<{ can_modify: boolean }>(`/nodes/${nodeId}/can-modify`);
    return data.can_modify;
  },

  async create(payload: NodePayload): Promise<NodeRecord> {
    const { data } = await api.post<NodeRecord>("/nodes", payload);
    return data;
  },

  async update(nodeId: number, payload: Partial<NodePayload>): Promise<NodeRecord> {
    const { data } = await api.put<NodeRecord>(`/nodes/${nodeId}`, payload);
    return data;
  },

  async remove(nodeId: number): Promise<void> {
    await api.delete(`/nodes/${nodeId}`);
  },

  async timeline(nodeId: number, limit = 100): Promise<AuditEntry[]> {
    const { data } = await api.get<AuditEntry[]>(`/nodes/${nodeId}/timeline`, {
      params: { limit },
    });
    return data;
  },

  // --- Assignments ---------------------------------------------------------
  async assignments(nodeId: number): Promise<Assignment[]> {
    const { data } = await api.get<Assignment[]>(`/nodes/${nodeId}/assignments`);
    return data;
  },

  async assign(nodeId: number, userId: number, role: AssignmentRole): Promise<Assignment> {
    const { data } = await api.post<Assignment>(`/nodes/${nodeId}/assignments`, {
      user_id: userId,
      role,
    });
    return data;
  },

  async updateAssignment(
    nodeId: number,
    assignmentId: number,
    role: AssignmentRole,
  ): Promise<Assignment> {
    const { data } = await api.put<Assignment>(
      `/nodes/${nodeId}/assignments/${assignmentId}`,
      { role },
    );
    return data;
  },

  async unassign(nodeId: number, assignmentId: number): Promise<void> {
    await api.delete(`/nodes/${nodeId}/assignments/${assignmentId}`);
  },

  async exportXlsx(filters: NodeFilters = {}): Promise<void> {
    await downloadFile("/exports/nodes.xlsx", "nnm_nodes.xlsx", {
      params: cleanParams({ ...filters, page: undefined, page_size: undefined }),
    });
  },
};
