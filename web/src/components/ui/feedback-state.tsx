import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  CircleHelp,
  FileQuestion,
  SearchX,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const TRADEOS_STATE_TAXONOMY = [
  "loading",
  "empty",
  "filtered-empty",
  "partial",
  "restricted",
  "not-found",
  "mutation-failure",
  "unknown",
] as const;

export type TradeOsStateKind = (typeof TRADEOS_STATE_TAXONOMY)[number];

type FeedbackKind =
  | "error"
  | "partial"
  | "restricted"
  | "not-found"
  | "mutation-failure"
  | "unknown";

interface FeedbackStateProps {
  kind: FeedbackKind;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  reference?: ReactNode;
  className?: string;
}

const presentation: Record<
  FeedbackKind,
  {
    icon: typeof AlertTriangle;
    container: string;
    iconClass: string;
    eyebrow: string;
  }
> = {
  error: {
    icon: AlertTriangle,
    container: "border-destructive/30 bg-destructive/5",
    iconClass: "text-destructive",
    eyebrow: "Couldn’t complete",
  },
  partial: {
    icon: AlertTriangle,
    container: "border-warning/30 bg-warning/5",
    iconClass: "text-warning",
    eyebrow: "Partial data",
  },
  restricted: {
    icon: ShieldAlert,
    container: "border-border/70 bg-muted/20",
    iconClass: "text-muted-foreground",
    eyebrow: "Access restricted",
  },
  "not-found": {
    icon: FileQuestion,
    container: "border-border/70 bg-muted/20",
    iconClass: "text-muted-foreground",
    eyebrow: "Not found",
  },
  "mutation-failure": {
    icon: AlertTriangle,
    container: "border-destructive/30 bg-destructive/5",
    iconClass: "text-destructive",
    eyebrow: "Change not saved",
  },
  unknown: {
    icon: CircleHelp,
    container: "border-info/25 bg-info/5",
    iconClass: "text-info",
    eyebrow: "Needs verification",
  },
};

export function FeedbackState({
  kind,
  title,
  description,
  action,
  secondaryAction,
  reference,
  className,
}: FeedbackStateProps) {
  const state = presentation[kind];
  const Icon = state.icon;
  const isUrgent = kind === "error" || kind === "mutation-failure";

  return (
    <section
      data-state-kind={kind}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      className={cn("rounded-xl border p-5", state.container, className)}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border border-current/15 bg-background/60",
            state.iconClass
          )}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", state.iconClass)}>
            {state.eyebrow}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>

          {reference ? (
            <div className="mt-3 text-xs text-muted-foreground">{reference}</div>
          ) : null}

          {action || secondaryAction ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {action}
              {secondaryAction}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

interface FilteredEmptyStateProps {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function FilteredEmptyState({
  title = "No matches",
  description,
  action,
  className,
}: FilteredEmptyStateProps) {
  return (
    <section
      data-state-kind="filtered-empty"
      role="status"
      aria-live="polite"
      className={cn("rounded-xl border border-dashed border-border/70 bg-muted/20 p-5", className)}
    >
      <div className="flex gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border/70 bg-background/60 text-muted-foreground"
          aria-hidden="true"
        >
          <SearchX className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Filters active
          </p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
