import type { TooltipProps } from "recharts";

import { useChartTheme } from "@/components/charts/chartTheme";

/**
 * Hover tooltip shared by every chart. Values and labels wear text tokens; the
 * series colour appears only as a small swatch beside the name.
 */
export function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  const theme = useChartTheme();
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{
        background: theme.tooltipBackground,
        borderColor: theme.tooltipBorder,
        color: theme.text,
      }}
    >
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ background: entry.color }}
          />
          <span style={{ color: theme.mutedText }}>{entry.name}</span>
          <span className="ml-auto font-semibold tabular-nums">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}
