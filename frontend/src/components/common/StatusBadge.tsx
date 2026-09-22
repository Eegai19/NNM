import { Badge } from "@/components/ui/badge";
import type { ActivityStatus, AssignmentRole, DeploymentState, NodeStatus, UserRole } from "@/types";
import {
  activityStatusTone,
  deploymentStateTone,
  humanize,
  nodeStatusTone,
} from "@/utils/format";
import { ASSIGNMENT_ROLE_LABELS, ROLE_LABELS } from "@/utils/constants";

export function DeploymentStateBadge({ state }: { state: DeploymentState }) {
  return <Badge tone={deploymentStateTone(state)}>{humanize(state)}</Badge>;
}

export function NodeStatusBadge({ status }: { status: NodeStatus }) {
  return <Badge tone={nodeStatusTone(status)}>{humanize(status)}</Badge>;
}

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  return <Badge tone={activityStatusTone(status)}>{status}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  const tone = role === "TPM" ? "default" : role === "LEAD" ? "info" : "muted";
  return <Badge tone={tone}>{ROLE_LABELS[role]}</Badge>;
}

export function AssignmentRoleBadge({ role }: { role: AssignmentRole }) {
  const tone =
    role === "PRIMARY_OWNER" ? "default" : role === "SECONDARY_OWNER" ? "info" : "muted";
  return <Badge tone={tone}>{ASSIGNMENT_ROLE_LABELS[role]}</Badge>;
}
