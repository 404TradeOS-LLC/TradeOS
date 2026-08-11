import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { AthenaAlertRecord, AthenaAlertSeverity } from "@/lib/api";

// Deliberately NOT using the shared StatusBadge/STATUS_TONES here: that map
// already keys "active" to green (a job/project "currently active and
// healthy"). An Athena alert with status "active" means the opposite - a
// still-firing problem - so reusing that key would render a firing alert in
// the same reassuring green as a healthy active job. Severity gets its own
// small, alert-specific tone table instead, using the same color language
// (rose/amber/slate) STATUS_TONES already uses for "bad/warn/neutral".
const SEVERITY_TONE: Record<AthenaAlertSeverity, string> = {
  critical: "border-rose-700/40 bg-rose-600/15 text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-200",
  high: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  medium: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AthenaAlertsPanel({ alerts }: { alerts: AthenaAlertRecord[] }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Active alerts</CardTitle>
        <CardDescription>
          Rule-based signals evaluated across your organization&apos;s Athena activity - the first place to look when something needs attention.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <EmptyState
            title="No active alerts"
            description="Nothing is currently firing. Athena's error, latency, cost, and event-health rules are all within normal range."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {alerts.map((alert) => (
              <li key={alert.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className={SEVERITY_TONE[alert.severity]}>
                    {alert.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground">First seen {formatDateTime(alert.firstSeenAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{alert.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last seen {formatDateTime(alert.lastSeenAt)} · rule: {alert.ruleId.replaceAll("_", " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
