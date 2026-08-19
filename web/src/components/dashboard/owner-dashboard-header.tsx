import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { OwnerDashboardGreeting } from "@/components/dashboard/owner-dashboard-greeting";
import { buildReviewQueueMetrics, type ReviewQueueCounts } from "@/components/dashboard/owner-dashboard-header-model";

interface OwnerDashboardHeaderProps {
  companyName: string;
  currentDateLabel: string;
  notificationCount: number;
  weather?: unknown;
  projectScopeLabel: string;
  reviewQueue?: ReviewQueueCounts;
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className="tabular-nums text-foreground">{value}</span>
      {label}
    </span>
  );
}

export function OwnerDashboardHeader({
  companyName,
  currentDateLabel,
  notificationCount,
  projectScopeLabel,
  reviewQueue,
}: OwnerDashboardHeaderProps) {
  const hasAttention = notificationCount > 0;
  const metrics = buildReviewQueueMetrics(reviewQueue);

  return (
    <section className="rounded-2xl border border-border/70 bg-card/98 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <OwnerDashboardGreeting />
            </p>
            <Badge
              variant="outline"
              className={
                hasAttention
                  ? "border-primary/20 bg-primary/8 text-primary"
                  : "border-border/70 bg-muted/30 text-muted-foreground"
              }
            >
              {hasAttention ? `Needs attention · ${notificationCount}` : "On track"}
            </Badge>
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{companyName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {currentDateLabel}
            </span>
            <span>{projectScopeLabel}</span>
          </div>
          {metrics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {metrics.map((metric) => (
                <MetricChip key={metric.key} label={metric.label} value={metric.value} />
              ))}
            </div>
          ) : null}
        </div>

        <Link href="/projects" className={buttonVariants()}>
          Review work
        </Link>
      </div>
    </section>
  );
}
