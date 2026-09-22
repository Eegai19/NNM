import { api, cleanParams, downloadFile } from "@/services/api";
import type {
  ActivityFilters,
  ActivityListItem,
  ActivityLog,
  ActivityStatus,
  NodeActivity,
  Page,
} from "@/types";

export interface NodeActivityPayload {
  activity_master_id: number;
  assigned_to?: number | null;
  status?: ActivityStatus;
  start_date?: string | null;
  remarks?: string | null;
}

export interface NodeActivityUpdate {
  assigned_to?: number | null;
  status?: ActivityStatus;
  start_date?: string | null;
  completed_date?: string | null;
  remarks?: string | null;
}

export const activitiesService = {
  async listForNode(nodeId: number): Promise<NodeActivity[]> {
    const { data } = await api.get<NodeActivity[]>(`/nodes/${nodeId}/activities`);
    return data;
  },

  async list(filters: ActivityFilters = {}): Promise<Page<ActivityListItem>> {
    const { data } = await api.get<Page<ActivityListItem>>("/activities", {
      params: cleanParams({ ...filters }),
    });
    return data;
  },

  async get(activityId: number): Promise<NodeActivity> {
    const { data } = await api.get<NodeActivity>(`/activities/${activityId}`);
    return data;
  },

  async create(nodeId: number, payload: NodeActivityPayload): Promise<NodeActivity> {
    const { data } = await api.post<NodeActivity>(`/nodes/${nodeId}/activities`, payload);
    return data;
  },

  async update(activityId: number, payload: NodeActivityUpdate): Promise<NodeActivity> {
    const { data } = await api.put<NodeActivity>(`/activities/${activityId}`, payload);
    return data;
  },

  async remove(activityId: number): Promise<void> {
    await api.delete(`/activities/${activityId}`);
  },

  // --- Activity logs -------------------------------------------------------
  async logs(activityId: number): Promise<ActivityLog[]> {
    const { data } = await api.get<ActivityLog[]>(`/activities/${activityId}/logs`);
    return data;
  },

  async uploadLog(
    activityId: number,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<ActivityLog> {
    const form = new FormData();
    form.append("file", file);

    const { data } = await api.post<ActivityLog>(`/activities/${activityId}/logs`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return data;
  },

  async downloadLog(logId: number, fileName: string): Promise<void> {
    await downloadFile(`/activity-logs/${logId}/download`, fileName);
  },

  async deleteLog(logId: number): Promise<void> {
    await api.delete(`/activity-logs/${logId}`);
  },

  async exportXlsx(filters: ActivityFilters = {}): Promise<void> {
    await downloadFile("/exports/activities.xlsx", "nnm_activities.xlsx", {
      params: cleanParams({ ...filters, page: undefined, page_size: undefined }),
    });
  },
};
