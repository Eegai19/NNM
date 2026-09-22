import { Activity, Download, FileSpreadsheet, History, Server } from "lucide-react";
import * as React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/services/api";
import { activitiesService } from "@/services/activities.service";
import { auditService } from "@/services/audit.service";
import { nodesService } from "@/services/nodes.service";
import { formatDateTime, humanize } from "@/utils/format";

const ALL = "__all__";

const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ASSIGN",
  "UNASSIGN",
  "STATUS_CHANGE",
  "UPLOAD",
  "LOGIN",
  "PASSWORD_RESET",
];

const AUDIT_ENTITIES = [
  "NODE",
  "NODE_ACTIVITY",
  "NODE_ASSIGNMENT",
  "ACTIVITY_LOG",
  "USER",
  "ACTIVITY_MASTER",
  "PRODUCT",
  "CIRCLE",
];

export default function ReportsPage() {
  useDocumentTitle("Reports");
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [exporting, setExporting] = React.useState<"nodes" | "activities" | null>(null);

  const [action, setAction] = React.useState(ALL);
  const [entity, setEntity] = React.useState(ALL);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const audit = useAsync(
    () =>
      isAdmin
        ? auditService.list({
            action: action === ALL ? undefined : action,
            entity_type: entity === ALL ? undefined : entity,
            page,
            page_size: pageSize,
          })
        : Promise.resolve(null),
    [isAdmin, action, entity, page, pageSize],
  );

  const exportNodes = async () => {
    setExporting("nodes");
    try {
      await nodesService.exportXlsx();
      toast.success("Export ready", "nnm_nodes.xlsx has been downloaded.");
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const exportActivities = async () => {
    setExporting("activities");
    try {
      await activitiesService.exportXlsx();
      toast.success("Export ready", "nnm_activities.xlsx has been downloaded.");
    } catch (error) {
      toast.error("Export failed", getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download Excel extracts and review the audit trail."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Node report
            </CardTitle>
            <CardDescription>
              Every node with its circle, product, owners, deployment state and activity counts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportNodes} loading={exporting === "nodes"}>
              <FileSpreadsheet className="h-4 w-4" />
              Download nodes.xlsx
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Activity report
            </CardTitle>
            <CardDescription>
              Every activity with its node, assignee, status, dates and evidence count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportActivities} loading={exporting === "activities"}>
              <Download className="h-4 w-4" />
              Download activities.xlsx
            </Button>
          </CardContent>
        </Card>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Audit trail
              </CardTitle>
              <CardDescription>
                Who created, changed, assigned, completed or uploaded — and when.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={entity}
                onValueChange={(value) => {
                  setEntity(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]" aria-label="Filter by record type">
                  <SelectValue placeholder="Record type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All record types</SelectItem>
                  {AUDIT_ENTITIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {humanize(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={action}
                onValueChange={(value) => {
                  setAction(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[170px]" aria-label="Filter by action">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All actions</SelectItem>
                  {AUDIT_ACTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {humanize(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {audit.loading && !audit.data ? (
              <TableSkeleton rows={8} columns={4} />
            ) : audit.error ? (
              <ErrorState message={audit.error} onRetry={() => void audit.reload()} />
            ) : !audit.data?.items.length ? (
              <EmptyState
                icon={History}
                title="No audit entries match"
                description="Try a different record type or action."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>What happened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.data.items.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.performed_by_name ?? "System"}
                        </TableCell>
                        <TableCell>
                          <Badge tone="muted">{humanize(entry.action)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Pagination
                  page={audit.data.page}
                  pageSize={audit.data.page_size}
                  total={audit.data.total}
                  pages={audit.data.pages}
                  onPageChange={setPage}
                  onPageSizeChange={(value) => {
                    setPageSize(value);
                    setPage(1);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
