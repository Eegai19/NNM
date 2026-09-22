import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        default: "border-transparent bg-primary/10 text-primary dark:bg-primary/20",
        muted: "border-border bg-muted text-muted-foreground",
        info: "border-transparent bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
        danger: "border-transparent bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
