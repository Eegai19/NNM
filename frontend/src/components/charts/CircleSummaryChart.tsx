import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartTheme } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/common/EmptyState";
import type { CircleSummaryItem } from "@/types";

interface Props {
  data: CircleSummaryItem[];
  /** Circles beyond this count are folded into "Other" rather than cycling hues. */
  limit?: number;
}

/** Node count per circle -- one measure, one series, so no legend is needed. */
export function CircleSummaryChart({ data, limit = 12 }: Props) {
  const theme = useChartTheme();

  if (!data.length) {
    return <EmptyState title="No circles yet" description="Add circles to see this breakdown." />;
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit);
  const chartData = tail.length
    ? [...head, { circle: "Other", count: tail.reduce((sum, item) => sum + item.count, 0) }]
    : head;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="circle"
          tick={{ fill: theme.mutedText, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          interval={0}
          angle={chartData.length > 8 ? -35 : 0}
          textAnchor={chartData.length > 8 ? "end" : "middle"}
          height={chartData.length > 8 ? 54 : 30}
        />
        <YAxis
          tick={{ fill: theme.mutedText, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={48}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: theme.grid, fillOpacity: 0.35 }}
        />
        <Bar
          dataKey="count"
          name="Nodes"
          fill={theme.series[0]}
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
