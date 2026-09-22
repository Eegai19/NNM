import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartTheme } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/common/EmptyState";
import type { EngineerWorkloadItem } from "@/types";

interface Props {
  data: EngineerWorkloadItem[];
  limit?: number;
}

/**
 * Assigned nodes and activities per engineer. Two series share one axis -- both
 * are plain counts, so a single scale is correct and a legend is always shown.
 */
export function EngineerWorkloadChart({ data, limit = 10 }: Props) {
  const theme = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No engineer workload yet"
        description="Assign engineers to nodes to populate this chart."
      />
    );
  }

  const chartData = [...data]
    .sort((a, b) => b.assigned_nodes - a.assigned_nodes || b.activities - a.activities)
    .slice(0, limit);

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 42)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        barGap={2}
        barCategoryGap="28%"
      >
        <CartesianGrid horizontal={false} stroke={theme.grid} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tick={{ fill: theme.mutedText, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="engineer"
          tick={{ fill: theme.mutedText, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={128}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.grid, fillOpacity: 0.35 }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: theme.mutedText, paddingTop: 8 }}
          iconType="square"
          iconSize={10}
        />
        <Bar
          dataKey="assigned_nodes"
          name="Assigned nodes"
          fill={theme.series[0]}
          radius={[0, 4, 4, 0]}
          maxBarSize={14}
        />
        <Bar
          dataKey="activities"
          name="Activities"
          fill={theme.series[1]}
          radius={[0, 4, 4, 0]}
          maxBarSize={14}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
