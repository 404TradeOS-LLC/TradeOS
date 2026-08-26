import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import type { DispatchSummary } from "@/lib/api";

interface DispatchSummaryStripProps {
  summary: DispatchSummary;
}

/**
 * Dispatcher-workspace KPI strip, modeled on OwnerKpiGrid but using the
 * lighter-weight SummaryMetricCard primitive since these numbers don't need
 * per-card icons/tone - just the five real counts the backend computed,
 * plus an honest caption about which timezone those counts were bucketed
 * against.
 */
export function DispatchSummaryStrip({ summary }: DispatchSummaryStripProps) {
  const metrics = [
    { label: "Active Jobs", value: String(summary.activeJobs) },
    { label: "Unscheduled", value: String(summary.unscheduledJobs) },
    { label: "Scheduled Today", value: String(summary.scheduledToday) },
    { label: "Overdue", value: String(summary.overdueActionable) },
    { label: "Needs Attention", value: String(summary.needsAttention) },
  ];

  return (
    <section aria-labelledby="dispatch-summary-heading" className="space-y-2">
      <h2 id="dispatch-summary-heading" className="sr-only">
        Dispatch summary
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <SummaryMetricCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>
      {summary.scope.source === "assigned_only" ? (
        <p className="text-xs text-muted-foreground">
          Showing counts for jobs assigned to you only ({summary.scope.role}) - your role does not have visibility into the organization-wide
          dispatch queue.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {summary.timezone.source === "utc_fallback"
          ? `Using UTC (no organization timezone configured) - counts are bucketed against ${summary.timezone.value}.`
          : `Times and "today"/"this week" ranges use the organization timezone (${summary.timezone.value}).`}
      </p>
    </section>
  );
}
