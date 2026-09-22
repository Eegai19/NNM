import {
  FilePlus2,
  History,
  PencilLine,
  Trash2,
  UserMinus,
  UserPlus,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditAction, AuditEntry } from "@/types";
import { formatDateTime, formatRelative, initials } from "@/utils/format";

const ACTION_ICONS: Partial<Record<AuditAction, LucideIcon>> = {
  CREATE: FilePlus2,
  UPDATE: PencilLine,
  DELETE: Trash2,
  ASSIGN: UserPlus,
  UNASSIGN: UserMinus,
  STATUS_CHANGE: Workflow,
  UPLOAD: FilePlus2,
};

interface Props {
  entries: AuditEntry[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Chronological record of everything that has happened to a node. */
export function NodeTimeline({ entries, loading, error, onRetry }: Props) {
  if (loading && !entries) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  if (!entries?.length) {
    return (
      <EmptyState
        icon={History}
        title="Nothing recorded yet"
        description="Changes to this node and its activities will appear here."
      />
    );
  }

  return (
    <ol className="relative space-y-1 pl-2">
      {entries.map((entry, index) => {
        const Icon = ACTION_ICONS[entry.action] ?? History;
        const isLast = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-4">
            {!isLast ? (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border"
                aria-hidden="true"
              />
            ) : null}

            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm">{entry.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {entry.performed_by_name ? (
                  <>
                    <span
                      className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary"
                      aria-hidden="true"
                    >
                      {initials(entry.performed_by_name)}
                    </span>
                    {entry.performed_by_name} ·{" "}
                  </>
                ) : null}
                <time dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>
                  {formatRelative(entry.created_at)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
