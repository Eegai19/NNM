import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import * as React from "react";

import { cn } from "@/utils/cn";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface ToastRecord {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

const TONES: Record<ToastVariant, string> = {
  default: "border-border bg-card text-card-foreground",
  success:
    "border-emerald-500/30 bg-card text-card-foreground [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400",
  error:
    "border-red-500/30 bg-card text-card-foreground [&_svg]:text-red-600 dark:[&_svg]:text-red-400",
  warning:
    "border-amber-500/30 bg-card text-card-foreground [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400",
};

interface ToastProps {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = ICONS[toast.variant];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg animate-fade-in",
        TONES[toast.variant],
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 break-words text-sm text-muted-foreground">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-sm text-muted-foreground transition-opacity hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 sm:bottom-4 sm:right-4 sm:p-0">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
