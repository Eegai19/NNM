import { ChevronDown, ChevronRight, ListChecks, Plus, Save, Trash2 } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ActivityStatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { ActivityLogList } from "@/pages/nodes/ActivityLogList";
import { getErrorMessage } from "@/services/api";
import { activitiesService } from "@/services/activities.service";
import type { ActivityMaster, ActivityStatus, NodeActivity, UserBrief } from "@/types";
import { ACTIVITY_STATUSES } from "@/utils/constants";
import { formatDate } from "@/utils/format";

const UNASSIGNED = "__none__";

interface Props {
  nodeId: number;
  canModify: boolean;
  activities: NodeActivity[] | null;
  loading: boolean;
  error: string | null;
  masters: ActivityMaster[];
  people: UserBrief[];
  onChanged: () => void;
  onRetry: () => void;
}

export function NodeActivitiesPanel({
  nodeId,
  canModify,
  activities,
  loading,
  error,
  masters,
  people,
  onChanged,
  onRetry,
}: Props) {
  const toast = useToast();
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<NodeActivity | null>(null);

  // Draft remarks are held locally so typing does not refetch on every keystroke.
  const [remarkDrafts, setRemarkDrafts] = React.useState<Record<number, string>>({});
  const [savingRemark, setSavingRemark] = React.useState<number | null>(null);

  const attached = new Set((activities ?? []).map((item) => item.activity_master_id));
  const availableMasters = masters.filter((master) => !attached.has(master.id));

  const [newMaster, setNewMaster] = React.useState("");
  const [newAssignee, setNewAssignee] = React.useState(UNASSIGNED);
  const [adding, setAdding] = React.useState(false);

  const addActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMaster) {
      toast.warning("Select an activity", "Choose which catalogue activity to attach.");
      return;
    }
    setAdding(true);
    try {
      await activitiesService.create(nodeId, {
        activity_master_id: Number(newMaster),
        assigned_to: newAssignee === UNASSIGNED ? null : Number(newAssignee),
      });
      toast.success("Activity added", "It starts as Pending.");
      setNewMaster("");
      setNewAssignee(UNASSIGNED);
      setAddOpen(false);
      onChanged();
    } catch (cause) {
      toast.error("Could not add the activity", getErrorMessage(cause));
    } finally {
      setAdding(false);
    }
  };

  const changeStatus = async (activity: NodeActivity, status: ActivityStatus) => {
    try {
      await activitiesService.update(activity.id, { status });
      toast.success("Status updated", `${activity.activity_master?.activity_name} is now ${status}.`);
      onChanged();
    } catch (cause) {
      // The completion rule surfaces here: a 422 means no evidence was uploaded.
      toast.error("Could not change the status", getErrorMessage(cause));
    }
  };

  const changeAssignee = async (activity: NodeActivity, value: string) => {
    try {
      await activitiesService.update(activity.id, {
        assigned_to: value === UNASSIGNED ? null : Number(value),
      });
      toast.success("Assignee updated");
      onChanged();
    } catch (cause) {
      toast.error("Could not change the assignee", getErrorMessage(cause));
    }
  };

  const saveRemarks = async (activity: NodeActivity) => {
    const remarks = remarkDrafts[activity.id] ?? "";
    setSavingRemark(activity.id);
    try {
      await activitiesService.update(activity.id, { remarks: remarks || null });
      toast.success("Remarks saved");
      onChanged();
    } catch (cause) {
      toast.error("Could not save the remarks", getErrorMessage(cause));
    } finally {
      setSavingRemark(null);
    }
  };

  const removeActivity = async () => {
    if (!deleting) return;
    try {
      await activitiesService.remove(deleting.id);
      toast.success("Activity removed", "Its logs were deleted along with it.");
      setDeleting(null);
      onChanged();
    } catch (cause) {
      toast.error("Could not remove the activity", getErrorMessage(cause));
    }
  };

  if (loading && !activities) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div className="space-y-4">
      {canModify ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add activity
          </Button>
        </div>
      ) : null}

      {!activities?.length ? (
        <EmptyState
          icon={ListChecks}
          title="No activities on this node"
          description={
            canModify
              ? "Attach activities from the catalogue to start tracking work."
              : "Nothing has been planned for this node yet."
          }
          action={
            canModify ? (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Add activity
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-2">
          {activities.map((activity) => {
            const isOpen = expanded === activity.id;
            return (
              <li key={activity.id} className="rounded-md border border-border">
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : activity.id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {activity.activity_master?.activity_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {activity.assignee ? activity.assignee.name : "Unassigned"} ·{" "}
                        {activity.logs.length} log{activity.logs.length === 1 ? "" : "s"}
                        {activity.completed_date
                          ? ` · completed ${formatDate(activity.completed_date)}`
                          : ""}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {canModify ? (
                      <Select
                        value={activity.status}
                        onValueChange={(value) =>
                          changeStatus(activity, value as ActivityStatus)
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-[140px]"
                          aria-label={`Status for ${activity.activity_master?.activity_name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_STATUSES.map((status) => (
                            <SelectItem
                              key={status}
                              value={status}
                              disabled={status === "Completed" && activity.logs.length === 0}
                            >
                              {status}
                              {status === "Completed" && activity.logs.length === 0
                                ? " (needs a log)"
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <ActivityStatusBadge status={activity.status} />
                    )}

                    {canModify ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(activity)}
                        aria-label={`Remove ${activity.activity_master?.activity_name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isOpen ? (
                  <div className="space-y-4 border-t border-border p-4">
                    {activity.activity_master?.description ? (
                      <p className="text-sm text-muted-foreground">
                        {activity.activity_master.description}
                      </p>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`assignee-${activity.id}`}>Assigned engineer</Label>
                        {canModify ? (
                          <Select
                            value={
                              activity.assigned_to ? String(activity.assigned_to) : UNASSIGNED
                            }
                            onValueChange={(value) => changeAssignee(activity, value)}
                          >
                            <SelectTrigger id={`assignee-${activity.id}`}>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                              {people.map((person) => (
                                <SelectItem key={person.id} value={String(person.id)}>
                                  {person.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm">{activity.assignee?.name ?? "Unassigned"}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>Dates</Label>
                        <p className="text-sm text-muted-foreground">
                          Started {formatDate(activity.start_date)} · Completed{" "}
                          {formatDate(activity.completed_date)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`remarks-${activity.id}`}>Remarks</Label>
                      {canModify ? (
                        <>
                          <Textarea
                            id={`remarks-${activity.id}`}
                            value={remarkDrafts[activity.id] ?? activity.remarks ?? ""}
                            onChange={(event) =>
                              setRemarkDrafts((current) => ({
                                ...current,
                                [activity.id]: event.target.value,
                              }))
                            }
                            placeholder="Notes for the next person picking this up…"
                            rows={3}
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveRemarks(activity)}
                              loading={savingRemark === activity.id}
                            >
                              <Save className="h-4 w-4" />
                              Save remarks
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {activity.remarks || "No remarks recorded."}
                        </p>
                      )}
                    </div>

                    <ActivityLogList
                      activityId={activity.id}
                      logs={activity.logs}
                      canModify={canModify}
                      onChanged={onChanged}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Add activity dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add an activity</DialogTitle>
            <DialogDescription>
              Attach an activity from the catalogue. Each catalogue activity can appear on a node
              only once.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={addActivity} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-activity">Activity</Label>
              <Select value={newMaster} onValueChange={setNewMaster}>
                <SelectTrigger id="new-activity">
                  <SelectValue placeholder="Select an activity" />
                </SelectTrigger>
                <SelectContent>
                  {availableMasters.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Every catalogue activity is already attached
                    </SelectItem>
                  ) : (
                    availableMasters.map((master) => (
                      <SelectItem key={master.id} value={String(master.id)}>
                        {master.activity_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-activity-assignee">Assign to</Label>
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger id="new-activity-assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={adding}>
                Add activity
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => (value ? undefined : setDeleting(null))}
        title={`Remove ${deleting?.activity_master?.activity_name}?`}
        description="The activity and every log uploaded against it are deleted permanently."
        confirmLabel="Remove activity"
        destructive
        onConfirm={removeActivity}
      />
    </div>
  );
}
