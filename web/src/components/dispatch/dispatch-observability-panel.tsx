import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActivityEvent, DispatchSummary } from "@/lib/api";

interface DispatchObservabilityPanelProps {
  summary: DispatchSummary;
  activity: ActivityEvent[];
  activityError?: string | null;
}

const signals = [
  { label: "Unscheduled work", value: (summary: DispatchSummary) => summary.unscheduledJobs, href: "/dispatch?view=all&status=unscheduled", tone: "text-amber-700" },
  { label: "Overdue work", value: (summary: DispatchSummary) => summary.overdueActionable, href: "/dispatch?view=attention&scheduled=week", tone: "text-red-700" },
  { label: "Needs attention", value: (summary: DispatchSummary) => summary.needsAttention, href: "/dispatch?view=attention", tone: "text-orange-700" },
];

function formatEventTime(value: string) {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function DispatchObservabilityPanel({ summary, activity, activityError }: DispatchObservabilityPanelProps) {
  return (
    <section aria-labelledby="dispatch-observability-heading" className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <CardTitle id="dispatch-observability-heading">Dispatch diagnostics</CardTitle>
          <CardDescription>
            Current exception signals from the {summary.scope.source === "organization" ? "organization" : "assigned-job"} view.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {signals.map((signal) => (
            <Link key={signal.label} href={signal.href} className="flex items-center justify-between rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/40">
              <span className="text-sm font-medium">{signal.label}</span>
              <span className={`text-lg font-semibold ${signal.tone}`}>{signal.value(summary)}</span>
            </Link>
          ))}
          <p className="text-xs text-muted-foreground">Conflict previews and overrides remain on the existing job actions. Successful conflict overrides appear in recent activity.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent dispatch activity</CardTitle>
          <CardDescription>Organization-scoped job activity from the existing timeline.</CardDescription>
        </CardHeader>
        <CardContent>
          {activityError ? (
            <EmptyState title="Activity is temporarily unavailable" description={activityError} />
          ) : activity.length === 0 ? (
            <EmptyState title="No dispatch activity yet" description="Successful scheduling, assignment, conflict override, and field-state events will appear here." />
          ) : (
            <div className="space-y-3">
              {activity.map((event) => (
                <div key={event.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-sm font-medium">{event.title}</div>
                    <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">{formatEventTime(event.occurredAt)}</time>
                  </div>
                  {event.description ? <p className="mt-1 text-xs text-muted-foreground">{event.description}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
