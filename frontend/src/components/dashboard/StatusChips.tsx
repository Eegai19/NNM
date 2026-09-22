import { Badge } from "@/components/ui/badge";
import type { StatusCounts } from "@/types";

/**
 * Node counts per status. Each chip carries its own label, so status is never
 * conveyed by colour alone.
 */
export function StatusChips({ status }: { status: StatusCounts }) {
  const chips = [
    { label: "Done", value: status.completed, tone: "success" as const },
    { label: "In progress", value: status.in_progress, tone: "info" as const },
    { label: "Not started", value: status.not_started, tone: "muted" as const },
    { label: "Blocked", value: status.blocked, tone: "danger" as const },
  ].filter((chip) => chip.value > 0);

  if (chips.length === 0) {
    return <span className="text-xs text-muted-foreground">No nodes</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip.label} tone={chip.tone} className="tabular-nums">
          {chip.value} {chip.label}
        </Badge>
      ))}
    </span>
  );
}

/** Completed-versus-total activity progress, as a bar plus a readable count. */
export function ActivityProgress({
  completed,
  total,
  className,
}: {
  completed: number;
  total: number;
  className?: string;
}) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <span
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${percent}% of activities complete`}
      >
        <span
          className="block h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {completed}/{total}
      </span>
    </span>
  );
}
