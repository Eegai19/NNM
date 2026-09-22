import { ClipboardList, Search } from "lucide-react";
import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { AssignmentRoleBadge, DeploymentStateBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { NodeAssignmentsPanel } from "@/pages/nodes/NodeAssignmentsPanel";
import { nodesService } from "@/services/nodes.service";
import { usersService } from "@/services/users.service";
import { cn } from "@/utils/cn";

/**
 * TPM / LEAD workspace for staffing nodes: pick a node on the left, manage its
 * primary owner, secondary owner and support engineers on the right.
 */
export default function AssignmentsPage() {
  useDocumentTitle("Assignments");
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedId = searchParams.get("node") ? Number(searchParams.get("node")) : null;
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 350);

  const nodes = useAsync(
    () => nodesService.list({ search: debouncedSearch.trim() || undefined, page_size: 50 }),
    [debouncedSearch],
  );
  const people = useAsync(() => usersService.assignable(), []);

  const assignments = useAsync(
    () => (selectedId ? nodesService.assignments(selectedId) : Promise.resolve([])),
    [selectedId],
  );

  const selectedNode = nodes.data?.items.find((item) => item.id === selectedId) ?? null;

  const select = (nodeId: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("node", String(nodeId));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Staff each node with a primary owner, secondary owner and support engineers."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Node picker */}
        <Card className="flex max-h-[70vh] flex-col">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a node"
                aria-label="Search nodes"
                className="pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {nodes.loading && !nodes.data ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : nodes.error ? (
              <ErrorState message={nodes.error} onRetry={() => void nodes.reload()} />
            ) : !nodes.data?.items.length ? (
              <EmptyState title="No nodes found" description="Try a different search term." />
            ) : (
              <ul className="space-y-1">
                {nodes.data.items.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => select(node.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left transition-colors",
                        node.id === selectedId
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted",
                      )}
                      aria-current={node.id === selectedId}
                    >
                      <span className="block truncate text-sm font-medium">{node.node_name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {node.circle?.circle_name}
                        <span aria-hidden="true">·</span>
                        {node.assigned_engineers} assigned
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Assignment editor */}
        <Card>
          {!selectedId ? (
            <EmptyState
              icon={ClipboardList}
              title="Select a node"
              description="Choose a node on the left to see and change who works on it."
            />
          ) : (
            <>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="truncate">
                    {selectedNode?.node_name ?? `Node #${selectedId}`}
                  </CardTitle>
                  {selectedNode ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <DeploymentStateBadge state={selectedNode.deployment_state} />
                      <span className="text-xs text-muted-foreground">
                        {selectedNode.circle?.circle_name} · {selectedNode.product?.product_name}
                      </span>
                    </div>
                  ) : null}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/nodes/${selectedId}`}>Open node</Link>
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Role coverage at a glance */}
                <div className="flex flex-wrap gap-2">
                  {(["PRIMARY_OWNER", "SECONDARY_OWNER", "SUPPORT_ENGINEER"] as const).map(
                    (role) => {
                      const holders = (assignments.data ?? []).filter(
                        (item) => item.role === role,
                      );
                      return (
                        <div
                          key={role}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                        >
                          <AssignmentRoleBadge role={role} />
                          <span className="text-sm text-muted-foreground">
                            {holders.length
                              ? holders.map((item) => item.user?.name).join(", ")
                              : "Vacant"}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>

                <NodeAssignmentsPanel
                  nodeId={selectedId}
                  canAssign
                  people={people.data ?? []}
                  assignments={assignments.data}
                  loading={assignments.loading}
                  error={assignments.error}
                  onChanged={() => {
                    void assignments.reload();
                    void nodes.reload();
                  }}
                  onRetry={() => void assignments.reload()}
                />
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
