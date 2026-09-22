import type { ActivityStatus, DeploymentState, NodeStatus } from "@/types";

/** Format an ISO timestamp as a short, locale-aware date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Format an ISO timestamp as date + time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 hours ago" style relative time, falling back to an absolute date. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const ranges: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
  ];

  let amount = seconds;
  for (const [unit, size] of ranges) {
    if (Math.abs(amount) < size) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        -Math.round(amount),
        unit,
      );
    }
    amount /= size;
  }
  return formatDate(value);
}

/** Human-readable file size. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/** Turn SCREAMING_SNAKE_CASE into "Title Case". */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Initials for an avatar, at most two letters. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export type BadgeTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

export function deploymentStateTone(state: DeploymentState): BadgeTone {
  switch (state) {
    case "LIVE":
      return "success";
    case "ACCEPTANCE":
    case "INTEGRATION":
    case "IN_PROGRESS":
      return "info";
    case "ON_HOLD":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "muted";
  }
}

export function nodeStatusTone(status: NodeStatus): BadgeTone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "IN_PROGRESS":
      return "info";
    case "BLOCKED":
      return "danger";
    default:
      return "muted";
  }
}

export function activityStatusTone(status: ActivityStatus): BadgeTone {
  switch (status) {
    case "Completed":
      return "success";
    case "In Progress":
      return "info";
    default:
      return "warning";
  }
}

/** Percentage of completed activities, 0 when there are none. */
export function completionPercent(completed: number, total: number): number {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}
