/** Types mirroring the FastAPI schemas. */

export type UserRole = "TPM" | "LEAD" | "ENGINEER";

export type DeploymentState =
  | "PLANNED"
  | "IN_PROGRESS"
  | "INTEGRATION"
  | "ACCEPTANCE"
  | "LIVE"
  | "ON_HOLD"
  | "CANCELLED";

export type NodeStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export type ActivityStatus = "Pending" | "In Progress" | "Completed";

export type AssignmentRole = "PRIMARY_OWNER" | "SECONDARY_OWNER" | "SUPPORT_ENGINEER";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ASSIGN"
  | "UNASSIGN"
  | "STATUS_CHANGE"
  | "UPLOAD"
  | "DOWNLOAD"
  | "LOGIN"
  | "PASSWORD_RESET";

export interface User {
  id: number;
  name: string;
  username: string;
  mobile_number: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface UserBrief {
  id: number;
  name: string;
  username: string;
  role: UserRole;
}

export interface Product {
  id: number;
  product_name: string;
  is_active: boolean;
}

export interface Circle {
  id: number;
  circle_name: string;
  is_active: boolean;
}

export interface ActivityMaster {
  id: number;
  activity_name: string;
  description: string | null;
  is_active: boolean;
}

export interface NodeRecord {
  id: number;
  node_name: string;
  product_id: number;
  circle_id: number;
  owner_id: number | null;
  lead_id: number | null;
  tpm_id: number | null;
  deployment_state: DeploymentState;
  overall_status: NodeStatus;
  created_at: string;
  updated_at: string;
  product: Product | null;
  circle: Circle | null;
  owner: UserBrief | null;
  lead: UserBrief | null;
  tpm: UserBrief | null;
}

export interface NodeSummary extends NodeRecord {
  total_activities: number;
  completed_activities: number;
  pending_activities: number;
  in_progress_activities: number;
  assigned_engineers: number;
}

export interface Assignment {
  id: number;
  node_id: number;
  user_id: number;
  role: AssignmentRole;
  assigned_by: number | null;
  created_at: string;
  user: UserBrief | null;
  assigner: UserBrief | null;
}

export interface ActivityLog {
  id: number;
  node_activity_id: number;
  file_name: string;
  content_type: string | null;
  file_size: number | null;
  uploaded_by: number | null;
  uploaded_at: string;
  uploader: UserBrief | null;
}

export interface NodeActivity {
  id: number;
  node_id: number;
  activity_master_id: number;
  assigned_to: number | null;
  status: ActivityStatus;
  start_date: string | null;
  completed_date: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  activity_master: ActivityMaster | null;
  assignee: UserBrief | null;
  logs: ActivityLog[];
}

export interface ActivityListItem {
  id: number;
  node_id: number;
  node_name: string;
  activity_name: string;
  circle_name: string | null;
  product_name: string | null;
  assignee_name: string | null;
  status: ActivityStatus;
  start_date: string | null;
  completed_date: string | null;
  remarks: string | null;
  log_count: number;
}

export interface AuditEntry {
  id: number;
  entity_type: string;
  entity_id: number | null;
  action: AuditAction;
  node_id: number | null;
  description: string;
  changes: string | null;
  performed_by: number | null;
  performed_by_name: string | null;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DashboardSummary {
  total_nodes: number;
  pending_activities: number;
  in_progress_activities: number;
  completed_activities: number;
  total_activities: number;
  total_users: number;
  total_engineers: number;
  completion_rate: number;
}

export interface CircleSummaryItem {
  circle: string;
  count: number;
}

export interface EngineerWorkloadItem {
  engineer: string;
  assigned_nodes: number;
  activities: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
}

export interface SearchHit {
  type: string;
  id: number;
  title: string;
  subtitle: string | null;
  url: string;
}

export interface GlobalSearchResponse {
  query: string;
  nodes: Page<SearchHit>;
  activities: Page<SearchHit>;
  engineers: Page<SearchHit>;
  circles: Page<SearchHit>;
  products: Page<SearchHit>;
  total: number;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface NodeFilters {
  search?: string;
  circle_id?: number;
  product_id?: number;
  deployment_state?: DeploymentState;
  overall_status?: NodeStatus;
  assigned_user_id?: number;
  mine?: boolean;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface ActivityFilters {
  search?: string;
  node_id?: number;
  status?: ActivityStatus;
  assigned_to?: number;
  circle_id?: number;
  product_id?: number;
  mine?: boolean;
  page?: number;
  page_size?: number;
}
