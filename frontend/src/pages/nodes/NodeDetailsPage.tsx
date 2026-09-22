import {
  ArrowLeft,
  CalendarDays,
  Lock,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { DeploymentStateBadge, NodeStatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";
import { NodeActivitiesPanel } from "@/pages/nodes/NodeActivitiesPanel";
import { NodeAssignmentsPanel } from "@/pages/nodes/NodeAssignmentsPanel";
import { NodeFormDialog } from "@/pages/nodes/NodeFormDialog";
import { NodeTimeline } from "@/pages/nodes/NodeTimeline";
import { getErrorMessage } from "@/services/api";
import { activitiesService } from "@/services/activities.service";
import { catalogService } from "@/services/catalog.service";
import { nodesService } from "@/services/nodes.service";
import { usersService } from "@/services/users.service";
import { completionPercent, formatDateTime } from "@/utils/format";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function NodeDetailsPage() {
  const { nodeId: rawId } = useParams<{ nodeId: string }>();
  const nodeId = Number(rawId);
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin, isTpm } = useAuth();

  const node = useAsync(() => nodesService.get(nodeId), [nodeId]);
  const canModify = useAsync(() => nodesService.canModify(nodeId), [nodeId]);
  const assignments = useAsync(() => nodesService.assignments(nodeId), [nodeId]);
  const activities = useAsync(() => activitiesService.listForNode(nodeId), [nodeId]);
  const timeline = useAsync(() => nodesService.timeline(nodeId), [nodeId]);
  const masters = useAsync(() => catalogService.activityMasters(), []);
  const products = useAsync(() => catalogService.products(), []);
  const circles = useAsync(() => catalogService.circles(), []);
  const people = useAsync(() => usersService.assignable(), []);

  useDocumentTitle(node.data?.node_name ?? "Node");

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const writable = canModify.data === true;

  const refreshAll = () => {
    void node.reload();
    void assignments.reload();
    void activities.reload();
    void timeline.reload();
  };

  const handleDelete = async () => {
    try {
      await nodesService.remove(nodeId);
      toast.success("Node deleted", `${node.data?.node_name} has been removed.`);
      navigate("/nodes", { replace: true });
    } catch (error) {
      toast.error("Could not delete the node", getErrorMessage(error));
    }
  };

  if (Number.isNaN(nodeId)) {
    return <ErrorState message="That node id is not valid." />;
  }

  if (node.loading && !node.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (node.error || !node.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/nodes">
            <ArrowLeft className="h-4 w-4" />
            Back to nodes
          </Link>
        </Button>
        <Card>
          <ErrorState
            message={node.error ?? "That node could not be found."}
            onRetry={() => void node.reload()}
          />
        </Card>
      </div>
    );
  }

  const data = node.data;
  const percent = completionPercent(data.completed_activities, data.total_activities);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/nodes">
          <ArrowLeft className="h-4 w-4" />
          Back to nodes
        </Link>
      </Button>

      <PageHeader
        title={data.node_name}
        description={`${data.circle?.circle_name ?? "—"} · ${data.product?.product_name ?? "—"}`}
        actions={
          <>
            {!writable && !canModify.loading ? (
              <Badge tone="muted" className="h-9 px-3">
                <Lock className="h-3.5 w-3.5" />
                Read only
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {writable ? (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {isTpm ? (
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      {/* 1. Node information */}
      <Card>
        <CardHeader>
          <CardTitle>Node information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow label="Deployment state">
              <DeploymentStateBadge state={data.deployment_state} />
            </InfoRow>
            <InfoRow label="Overall status">
              <NodeStatusBadge status={data.overall_status} />
            </InfoRow>
            <InfoRow label="Circle">{data.circle?.circle_name ?? "—"}</InfoRow>
            <InfoRow label="Product">{data.product?.product_name ?? "—"}</InfoRow>
            <InfoRow label="Owner">{data.owner?.name ?? "Unassigned"}</InfoRow>
            <InfoRow label="Lead">{data.lead?.name ?? "Unassigned"}</InfoRow>
            <InfoRow label="TPM">{data.tpm?.name ?? "Unassigned"}</InfoRow>
            <InfoRow label="Activity progress">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="tabular-nums">
                  {data.completed_activities}/{data.total_activities} ({percent}%)
                </span>
              </span>
            </InfoRow>
          </dl>

          <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Created {formatDateTime(data.created_at)} · Last updated{" "}
            {formatDateTime(data.updated_at)}
          </p>
        </CardContent>
      </Card>

      {/* 2-5. Assignments, activities, logs and timeline */}
      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">
            Activities
            <Badge tone="muted">{data.total_activities}</Badge>
          </TabsTrigger>
          <TabsTrigger value="assignments">
            Assignments
            <Badge tone="muted">{assignments.data?.length ?? 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>Activities and logs</CardTitle>
            </CardHeader>
            <CardContent>
              <NodeActivitiesPanel
                nodeId={nodeId}
                canModify={writable}
                activities={activities.data}
                loading={activities.loading}
                error={activities.error}
                masters={masters.data ?? []}
                people={people.data ?? []}
                onChanged={() => {
                  void activities.reload();
                  void node.reload();
                  void timeline.reload();
                }}
                onRetry={() => void activities.reload()}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Assignment information</CardTitle>
            </CardHeader>
            <CardContent>
              <NodeAssignmentsPanel
                nodeId={nodeId}
                canAssign={isAdmin}
                people={people.data ?? []}
                assignments={assignments.data}
                loading={assignments.loading}
                error={assignments.error}
                onChanged={() => {
                  void assignments.reload();
                  void canModify.reload();
                  void timeline.reload();
                }}
                onRetry={() => void assignments.reload()}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <NodeTimeline
                entries={timeline.data}
                loading={timeline.loading}
                error={timeline.error}
                onRetry={() => void timeline.reload()}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NodeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        node={data}
        products={products.data ?? []}
        circles={circles.data ?? []}
        people={people.data ?? []}
        onSaved={refreshAll}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${data.node_name}?`}
        description="This removes the node along with its assignments, activities and uploaded logs. This cannot be undone."
        confirmLabel="Delete node"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
