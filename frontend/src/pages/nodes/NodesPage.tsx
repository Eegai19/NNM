import {
  Download,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { DeploymentStateBadge, NodeStatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";
import { NodeFormDialog } from "@/pages/nodes/NodeFormDialog";
import { getErrorMessage } from "@/services/api";
import { catalogService } from "@/services/catalog.service";
import { nodesService } from "@/services/nodes.service";
import { usersService } from "@/services/users.service";
import type { DeploymentState, NodeFilters, NodeStatus, NodeSummary } from "@/types";
import { DEPLOYMENT_STATES, NODE_STATUSES } from "@/utils/constants";
import { completionPercent, formatRelative, humanize } from "@/utils/format";

const ALL = "__all__";

export default function NodesPage() {
  useDocumentTitle("Nodes");
  const toast = useToast();
  const { isAdmin, isTpm } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Filters, mirrored into the URL so views are shareable ---------------
  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounce(search, 350);

  const circleId = searchParams.get("circle_id") ?? ALL;
  const productId = searchParams.get("product_id") ?? ALL;
  const state = searchParams.get("deployment_state") ?? ALL;
  const status = searchParams.get("overall_status") ?? ALL;
  const mine = searchParams.get("mine") === "true";
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("page_size") ?? 20);

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (value === null || value === ALL || value === "") next.delete(key);
        else next.set(key, value);
        if (key !== "page") next.delete("page");
        return next;
      });
    },
    [setSearchParams],
  );

  React.useEffect(() => {
    setParam("search", debouncedSearch.trim() || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters: NodeFilters = React.useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      circle_id: circleId === ALL ? undefined : Number(circleId),
      product_id: productId === ALL ? undefined : Number(productId),
      deployment_state: state === ALL ? undefined : (state as DeploymentState),
      overall_status: status === ALL ? undefined : (status as NodeStatus),
      mine: mine || undefined,
      page,
      page_size: pageSize,
    }),
    [debouncedSearch, circleId, productId, state, status, mine, page, pageSize],
  );

  const nodes = useAsync(() => nodesService.list(filters), [filters]);
  const products = useAsync(() => catalogService.products(), []);
  const circles = useAsync(() => catalogService.circles(), []);
  const people = useAsync(() => usersService.assignable(), []);

  // --- Dialog state --------------------------------------------------------
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<NodeSummary | null>(null);
  const [deleting, setDeleting] = React.useState<NodeSummary | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const activeFilterCount = [circleId, productId, state, status].filter(
    (value) => value !== ALL,
  ).length + (mine ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setSearchParams(new URLSearchParams());
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await nodesService.exportXlsx(filters);
      toast.success("Export ready", "The node report has been downloaded.");
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await nodesService.remove(deleting.id);
      toast.success("Node deleted", `${deleting.node_name} has been removed.`);
      setDeleting(null);
      void nodes.reload();
    } catch (error) {
      toast.error("Could not delete node", getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nodes"
        description="Every node being tracked, with its deployment state and activity progress."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport} loading={exporting}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            {isAdmin ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                New node
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        {/* Filter row */}
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search node, circle or product"
              aria-label="Search nodes"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={circleId} onValueChange={(value) => setParam("circle_id", value)}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by circle">
                <SelectValue placeholder="Circle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All circles</SelectItem>
                {(circles.data ?? []).map((circle) => (
                  <SelectItem key={circle.id} value={String(circle.id)}>
                    {circle.circle_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={productId} onValueChange={(value) => setParam("product_id", value)}>
              <SelectTrigger className="w-[170px]" aria-label="Filter by product">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All products</SelectItem>
                {(products.data ?? []).map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={state} onValueChange={(value) => setParam("deployment_state", value)}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by deployment state">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All states</SelectItem>
                {DEPLOYMENT_STATES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {humanize(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(value) => setParam("overall_status", value)}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by overall status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {NODE_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {humanize(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={mine ? "default" : "outline"}
              size="sm"
              onClick={() => setParam("mine", mine ? null : "true")}
            >
              <Filter className="h-4 w-4" />
              My nodes
            </Button>

            {activeFilterCount > 0 || search ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {nodes.loading && !nodes.data ? (
          <TableSkeleton rows={8} columns={6} />
        ) : nodes.error ? (
          <ErrorState message={nodes.error} onRetry={() => void nodes.reload()} />
        ) : !nodes.data?.items.length ? (
          <EmptyState
            icon={Server}
            title="No nodes match these filters"
            description={
              activeFilterCount || search
                ? "Try clearing the filters or searching for something else."
                : "Create your first node to start tracking deployment progress."
            }
            action={
              activeFilterCount || search ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : isAdmin ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New node
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead className="hidden md:table-cell">Circle / Product</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="hidden xl:table-cell">Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.data.items.map((node) => {
                  const percent = completionPercent(
                    node.completed_activities,
                    node.total_activities,
                  );
                  return (
                    <TableRow key={node.id}>
                      <TableCell>
                        <Link
                          to={`/nodes/${node.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {node.node_name}
                        </Link>
                        <p className="text-xs text-muted-foreground md:hidden">
                          {node.circle?.circle_name} · {node.product?.product_name}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm">{node.circle?.circle_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {node.product?.product_name ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <DeploymentStateBadge state={node.deployment_state} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <NodeStatusBadge status={node.overall_status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
                            role="img"
                            aria-label={`${percent}% of activities completed`}
                          >
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {node.completed_activities}/{node.total_activities}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground xl:table-cell">
                        {formatRelative(node.updated_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${node.node_name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/nodes/${node.id}`}>View details</Link>
                            </DropdownMenuItem>
                            {isAdmin ? (
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(node);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil />
                                Edit node
                              </DropdownMenuItem>
                            ) : null}
                            {isTpm ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  destructive
                                  onSelect={() => setDeleting(node)}
                                >
                                  <Trash2 />
                                  Delete node
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Pagination
              page={nodes.data.page}
              pageSize={nodes.data.page_size}
              total={nodes.data.total}
              pages={nodes.data.pages}
              onPageChange={(value) => setParam("page", String(value))}
              onPageSizeChange={(value) => setParam("page_size", String(value))}
            />
          </>
        )}
      </Card>

      <NodeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        node={editing}
        products={products.data ?? []}
        circles={circles.data ?? []}
        people={people.data ?? []}
        onSaved={() => void nodes.reload()}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => (value ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.node_name}?`}
        description="This removes the node along with its assignments, activities and uploaded logs. This cannot be undone."
        confirmLabel="Delete node"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
