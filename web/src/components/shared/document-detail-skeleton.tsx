import type { CSSProperties } from "react";

interface DocumentDetailSkeletonProps {
  /** Grid column ratio for the two-column layout, matching the real page's xl:grid-cols-[...]. */
  columns?: string;
  /** Render a tab-strip placeholder above the columns (project workspace only). */
  withTabs?: boolean;
  label: string;
}

/**
 * Shared loading skeleton for the project-scoped document detail pages
 * (invoices, proposals, contracts, estimates, jobs, intake) - they all share
 * the same PageHeader + two-column Card layout, so one component keeps every
 * route's loading.tsx a one-liner instead of 12 near-duplicate skeletons.
 */
export function DocumentDetailSkeleton({ columns = "1.1fr 0.9fr", withTabs = false, label }: DocumentDetailSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-6" aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>

        {withTabs ? (
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[var(--doc-skeleton-cols)]" style={{ "--doc-skeleton-cols": columns.replaceAll("_", " ") } as CSSProperties}>
          <div className="h-96 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
          <div className="h-96 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
