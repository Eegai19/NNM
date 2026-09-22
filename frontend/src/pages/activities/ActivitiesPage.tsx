import { Activity, Download, Search, X } from "lucide-react";
import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { ActivityStatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/services/api";
import { activitiesService } from "@/services/activities.service";
import { catalogService } from "@/services/catalog.service";
import { usersService } from "@/services/users.service";
import type { ActivityFilters, ActivityStatus } from "@/types";
import { ACTIVITY_STATUSES } from "@/utils/constants";
import { formatDate } from "@/utils/format";

const ALL = "__all__";

export default function ActivitiesPage() {
  useDocumentTitle("Activities");
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounce(search, 350);

  const status = searchParams.get("status") ?? ALL;
  const assignedTo = searchParams.get("assigned_to") ?? ALL;
  const circleId = searchParams.get("circle_id") ?? ALL;
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

  const filters: ActivityFilters = React.useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: status === ALL ? undefined : (status as ActivityStatus),
      assigned_to: assignedTo === ALL ? undefined : Number(assignedTo),
      circle_id: circleId === ALL ? undefined : Number(circleId),
      mine: mine || undefined,
      page,
      page_size: pageSize,
    }),
    [debouncedSearch, status, assignedTo, circleId, mine, page, pageSize],
  );

  const activities = useAsync(() => activitiesService.list(filters), [filters]);
  const circles = useAsync(() => catalogService.circles(), []);
  const people = useAsync(() => usersService.assignable(), []);

  const [exporting, setExporting] = React.useState(false);

  const hasFilters =
    Boolean(search) || status !== ALL || assignedTo !== ALL || circleId !== ALL || mine;

  const clearFilters = () => {
    setSearch("");
    setSearchParams(new URLSearchParams());
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await activitiesService.exportXlsx(filters);
      toast.success("Export ready", "The activity report has been downloaded.");
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activities"
        description="Every activity across every node, with its status and evidence count."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} loading={exporting}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search node, activity or engineer"
              aria-label="Search activities"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(value) => setParam("status", value)}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {ACTIVITY_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assignedTo} onValueChange={(value) => setParam("assigned_to", value)}>
              <SelectTrigger className="w-[170px]" aria-label="Filter by assignee">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                {(people.data ?? []).map((person) => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            <Button
              variant={mine ? "default" : "outline"}
              size="sm"
              onClick={() => setParam("mine", mine ? null : "true")}
            >
              Assigned to me
            </Button>

            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {activities.loading && !activities.data ? (
          <TableSkeleton rows={8} columns={6} />
        ) : activities.error ? (
          <ErrorState message={activities.error} onRetry={() => void activities.reload()} />
        ) : !activities.data?.items.length ? (
          <EmptyState
            icon={Activity}
            title="No activities match these filters"
            description={
              hasFilters
                ? "Try a different filter combination."
                : "Attach activities to a node from its detail page."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead className="hidden lg:table-cell">Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Logs</TableHead>
                  <TableHead className="hidden xl:table-cell">Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.activity_name}</p>
                      {item.remarks ? (
                        <p className="max-w-xs truncate text-xs text-muted-foreground">
                          {item.remarks}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/nodes/${item.node_id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {item.node_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.circle_name} · {item.product_name}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {item.assignee_name ?? (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActivityStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge tone={item.log_count > 0 ? "muted" : "warning"}>
                        {item.log_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground xl:table-cell">
                      {formatDate(item.start_date)} → {formatDate(item.completed_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              page={activities.data.page}
              pageSize={activities.data.page_size}
              total={activities.data.total}
              pages={activities.data.pages}
              onPageChange={(value) => setParam("page", String(value))}
              onPageSizeChange={(value) => setParam("page_size", String(value))}
            />
          </>
        )}
      </Card>
    </div>
  );
}
