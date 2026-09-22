import {
  Activity,
  CheckCircle2,
  Clock,
  RefreshCw,
  Server,
  Timer,
} from "lucide-react";
import { Link } from "react-router-dom";

import { CircleSummaryChart } from "@/components/charts/CircleSummaryChart";
import { EngineerWorkloadChart } from "@/components/charts/EngineerWorkloadChart";
import { StatusBreakdownChart } from "@/components/charts/StatusBreakdownChart";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
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
import { dashboardService } from "@/services/dashboard.service";

export default function DashboardPage() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();

  const summary = useAsync(() => dashboardService.summary(), []);
  const circles = useAsync(() => dashboardService.circleSummary(), []);
  const workload = useAsync(() => dashboardService.engineerWorkload(12), []);
  const breakdown = useAsync(() => dashboardService.statusBreakdown(), []);

  const reloadAll = () => {
    void summary.reload();
    void circles.reload();
    void workload.reload();
    void breakdown.reload();
  };

  const stats = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        description="Deployment progress across every circle, node and activity."
        actions={
          <Button variant="outline" size="sm" onClick={reloadAll}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Headline counters */}
      {summary.loading && !stats ? (
        <CardSkeleton />
      ) : summary.error ? (
        <Card>
          <ErrorState message={summary.error} onRetry={() => void summary.reload()} />
        </Card>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total nodes"
            value={stats.total_nodes}
            icon={Server}
            tone="primary"
            hint={`${stats.total_activities} activities tracked`}
          />
          <StatCard
            label="Pending activities"
            value={stats.pending_activities}
            icon={Clock}
            tone="warning"
            hint="Not yet started"
          />
          <StatCard
            label="In progress"
            value={stats.in_progress_activities}
            icon={Timer}
            tone="info"
            hint="Being worked on now"
          />
          <StatCard
            label="Completed"
            value={stats.completed_activities}
            icon={CheckCircle2}
            tone="success"
            hint={`${stats.completion_rate}% of all activities`}
          />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nodes per circle</CardTitle>
            <CardDescription>Where the deployment footprint sits today.</CardDescription>
          </CardHeader>
          <CardContent>
            {circles.loading && !circles.data ? (
              <Skeleton className="h-[300px] w-full" />
            ) : circles.error ? (
              <ErrorState message={circles.error} onRetry={() => void circles.reload()} />
            ) : (
              <CircleSummaryChart data={circles.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nodes by deployment state</CardTitle>
            <CardDescription>How far each node has progressed.</CardDescription>
          </CardHeader>
          <CardContent>
            {breakdown.loading && !breakdown.data ? (
              <Skeleton className="h-[260px] w-full" />
            ) : breakdown.error ? (
              <ErrorState message={breakdown.error} onRetry={() => void breakdown.reload()} />
            ) : (
              <StatusBreakdownChart data={breakdown.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engineer workload</CardTitle>
          <CardDescription>
            Assigned nodes and activities per engineer, highest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workload.loading && !workload.data ? (
            <Skeleton className="h-[320px] w-full" />
          ) : workload.error ? (
            <ErrorState message={workload.error} onRetry={() => void workload.reload()} />
          ) : (
            <>
              <EngineerWorkloadChart data={workload.data ?? []} />

              {/* Table view of the same numbers -- identity is never colour-alone. */}
              {workload.data?.length ? (
                <details className="mt-4 group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    View as table
                  </summary>
                  <div className="mt-3 rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Engineer</TableHead>
                          <TableHead className="text-right">Assigned nodes</TableHead>
                          <TableHead className="text-right">Activities</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workload.data.map((row) => (
                          <TableRow key={row.engineer}>
                            <TableCell className="font-medium">{row.engineer}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.assigned_nodes}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.activities}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Looking for something specific?</p>
            <p className="text-sm text-muted-foreground">
              Browse the full node list, or jump straight to the activities assigned to you.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/nodes">
                <Server className="h-4 w-4" />
                All nodes
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/activities?mine=true">
                <Activity className="h-4 w-4" />
                My activities
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
