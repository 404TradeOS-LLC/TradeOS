import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  /** Optional decorative icon (e.g. a lucide icon) shown above the title -
   *  a light illustration for a genuinely empty (not just filtered) state,
   *  like a brand-new organization's first-ever view of a list. */
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-xl border border-dashed border-border/70 bg-muted/20 p-5", className)}>
      {Icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-dashed border-border/70 bg-background/60 text-muted-foreground" aria-hidden="true">
          <Icon className="size-5" />
        </div>
      ) : null}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
