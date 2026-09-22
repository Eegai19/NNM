import type {
  ActivityStatus,
  AssignmentRole,
  DeploymentState,
  NodeStatus,
  UserRole,
} from "@/types";

export const STORAGE_KEYS = {
  token: "nnm.token",
  user: "nnm.user",
  expiry: "nnm.expiry",
  remember: "nnm.remember",
  theme: "nnm.theme",
  lastUsername: "nnm.lastUsername",
} as const;

export const DEPLOYMENT_STATES: DeploymentState[] = [
  "PLANNED",
  "IN_PROGRESS",
  "INTEGRATION",
  "ACCEPTANCE",
  "LIVE",
  "ON_HOLD",
  "CANCELLED",
];

export const NODE_STATUSES: NodeStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
];

export const ACTIVITY_STATUSES: ActivityStatus[] = ["Pending", "In Progress", "Completed"];

export const ASSIGNMENT_ROLES: AssignmentRole[] = [
  "PRIMARY_OWNER",
  "SECONDARY_OWNER",
  "SUPPORT_ENGINEER",
];

export const USER_ROLES: UserRole[] = ["TPM", "LEAD", "ENGINEER"];

export const ROLE_LABELS: Record<UserRole, string> = {
  TPM: "TPM",
  LEAD: "Lead",
  ENGINEER: "Engineer",
};

export const ASSIGNMENT_ROLE_LABELS: Record<AssignmentRole, string> = {
  PRIMARY_OWNER: "Primary Owner",
  SECONDARY_OWNER: "Secondary Owner",
  SUPPORT_ENGINEER: "Support Engineer",
};

/** Extensions the activity log uploader accepts, mirroring the backend. */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".zip",
  ".txt",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
] as const;

export const MAX_UPLOAD_MB = 25;

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Categorical chart palette, stepped separately for each surface so dark mode
 * is a chosen set rather than an automatic flip. Slots are assigned in fixed
 * order and never cycled; the first three are validated for all-pairs use.
 */
export const CHART_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
} as const;
