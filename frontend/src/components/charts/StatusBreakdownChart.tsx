import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartTheme } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/common/EmptyState";
import type { StatusBreakdownItem } from "@/types";
import { humanize } from "@/utils/format";

interface Props {
  data: StatusBreakdownItem[];
}

/**
 * Nodes per deployment state. A horizontal bar is used rather than a pie: with
 * up to seven slices a pie makes the very comparison it is meant to support
 * (which state has more nodes) harder to read.
 */
export function StatusBreakdownChart({ data }: Props) {
  const theme = useChartTheme();

  if (!data.length) {
    return <EmptyState title="No nodes yet" description="Create a node to see its state here." />;
  }

  const chartData = [...data]
    .sort((a, b) => b.count - a.count)
    .map((item) => ({ ...item, label: humanize(item.status) }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 40)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
        barCategoryGap="26%"
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
          dataKey="label"
          tick={{ fill: theme.mutedText, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.grid, fillOpacity: 0.35 }} />
        <Bar
          dataKey="count"
          name="Nodes"
          fill={theme.series[0]}
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
        >
          {/* Direct labels keep the values readable without a colour lookup. */}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fill: theme.mutedText, fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
