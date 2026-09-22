import { Trash2, UserPlus, Users } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { AssignmentRoleBadge } from "@/components/common/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/services/api";
import { nodesService } from "@/services/nodes.service";
import type { Assignment, AssignmentRole, UserBrief } from "@/types";
import { ASSIGNMENT_ROLE_LABELS, ASSIGNMENT_ROLES } from "@/utils/constants";
import { formatDate, initials } from "@/utils/format";

interface Props {
  nodeId: number;
  /** Only TPM and LEAD may change assignments. */
  canAssign: boolean;
  people: UserBrief[];
  assignments: Assignment[] | null;
  loading: boolean;
  error: string | null;
  onChanged: () => void;
  onRetry: () => void;
}

export function NodeAssignmentsPanel({
  nodeId,
  canAssign,
  people,
  assignments,
  loading,
  error,
  onChanged,
  onRetry,
}: Props) {
  const toast = useToast();
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState<AssignmentRole>("PRIMARY_OWNER");
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState<Assignment | null>(null);

  const assignedIds = new Set((assignments ?? []).map((item) => item.user_id));
  const available = people.filter((person) => !assignedIds.has(person.id));

  const takenSingletonRoles = new Set(
    (assignments ?? [])
      .filter((item) => item.role !== "SUPPORT_ENGINEER")
      .map((item) => item.role),
  );

  const assign = async () => {
    if (!userId) {
      toast.warning("Select an engineer", "Choose who should be assigned to this node.");
      return;
    }
    setSaving(true);
    try {
      await nodesService.assign(nodeId, Number(userId), role);
      toast.success("Engineer assigned", `Added as ${ASSIGNMENT_ROLE_LABELS[role]}.`);
      setUserId("");
      onChanged();
    } catch (cause) {
      toast.error("Could not assign engineer", getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (assignment: Assignment, nextRole: AssignmentRole) => {
    if (nextRole === assignment.role) return;
    try {
      await nodesService.updateAssignment(nodeId, assignment.id, nextRole);
      toast.success("Role updated", `${assignment.user?.name} is now ${ASSIGNMENT_ROLE_LABELS[nextRole]}.`);
      onChanged();
    } catch (cause) {
      toast.error("Could not change the role", getErrorMessage(cause));
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await nodesService.unassign(nodeId, removing.id);
      toast.success("Assignment removed", `${removing.user?.name} no longer works on this node.`);
      setRemoving(null);
      onChanged();
    } catch (cause) {
      toast.error("Could not remove the assignment", getErrorMessage(cause));
    }
  };

  if (loading && !assignments) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-4">
      {canAssign ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 sm:flex-row sm:items-center">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="sm:w-56" aria-label="Engineer to assign">
              <SelectValue placeholder="Select an engineer" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  Everyone available is already assigned
                </SelectItem>
              ) : (
                available.map((person) => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name} ({person.role})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Select value={role} onValueChange={(value) => setRole(value as AssignmentRole)}>
            <SelectTrigger className="sm:w-52" aria-label="Assignment role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNMENT_ROLES.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  disabled={takenSingletonRoles.has(option)}
                >
                  {ASSIGNMENT_ROLE_LABELS[option]}
                  {takenSingletonRoles.has(option) ? " (taken)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={assign} loading={saving} className="sm:ml-auto">
            <UserPlus className="h-4 w-4" />
            Assign
          </Button>
        </div>
      ) : null}

      {!assignments?.length ? (
        <EmptyState
          icon={Users}
          title="No engineers assigned"
          description={
            canAssign
              ? "Assign a primary owner so someone can start working on this node."
              : "A TPM or Lead needs to assign engineers to this node."
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <AvatarFallback>{initials(assignment.user?.name ?? "?")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{assignment.user?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{assignment.user?.username} · assigned{" "}
                    {formatDate(assignment.created_at)}
                    {assignment.assigner ? ` by ${assignment.assigner.name}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canAssign ? (
                  <Select
                    value={assignment.role}
                    onValueChange={(value) => changeRole(assignment, value as AssignmentRole)}
                  >
                    <SelectTrigger
                      className="h-8 w-[180px]"
                      aria-label={`Role for ${assignment.user?.name}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNMENT_ROLES.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          disabled={
                            option !== assignment.role && takenSingletonRoles.has(option)
                          }
                        >
                          {ASSIGNMENT_ROLE_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <AssignmentRoleBadge role={assignment.role} />
                )}

                {canAssign ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRemoving(assignment)}
                    aria-label={`Remove ${assignment.user?.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(value) => (value ? undefined : setRemoving(null))}
        title={`Remove ${removing?.user?.name}?`}
        description="They will lose the ability to modify this node and its activities."
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
