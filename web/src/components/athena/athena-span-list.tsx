import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import type { AthenaTelemetrySpan } from "@/lib/api";
import { formatAthenaMs, formatAthenaUsd } from "@/lib/athena-overview-model";

// Pinned to UTC (with the zone spelled out) to match the filter bar's
// "From (UTC)"/"To (UTC)" window inputs (athena-trace-filter-bar.tsx) -
// otherwise an operator outside UTC sees span timestamps rendered in the
// server/browser's local zone with no on-screen indication they've shifted.
// Module-scope so the formatter isn't rebuilt on every row's render.
// Intl.DateTimeFormat rejects combining dateStyle/timeStyle with
// timeZoneName (throws "Invalid option : option"), so this spells out the
// equivalent component options individually instead of using dateStyle:
// "medium"/timeStyle: "medium".
const spanDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function formatDateTime(value: string) {
  return spanDateTimeFormatter.format(new Date(value));
}

/**
 * `metadata` is already redacted/sanitized at write time by
 * athena-kernel/telemetry.ts's sanitizeMetadata() (see
 * app/modules/athena-observability/types.ts's AthenaTelemetrySpan doc
 * comment) - this just renders it as collapsed JSON, it does not re-derive
 * or fetch anything beyond what the trace-detail response already returned.
 */
export function AthenaSpanList({ spans }: { spans: AthenaTelemetrySpan[] }) {
  if (spans.length === 0) {
    return (
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Telemetry spans</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No spans recorded" description="No C011 telemetry spans exist for this trace yet." />
        </CardContent>
      </Card>
    );
  }

  const chronological = [...spans].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Telemetry spans</CardTitle>
        <CardDescription>{spans.length} span{spans.length === 1 ? "" : "s"}, in chronological order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {chronological.map((span) => (
          <div key={span.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground capitalize">{span.spanType}</span>
                <StatusBadge status={span.status} />
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(span.createdAt)}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Duration: {formatAthenaMs(span.durationMs)}</span>
              <span>Redaction: {span.redaction.replaceAll("_", " ")}</span>
              {span.cost ? (
                <span>
                  Cost: {formatAthenaUsd(span.cost.estimatedUsd)}
                  {span.cost.provider ? ` · ${span.cost.provider}` : ""}
                  {span.cost.model ? ` · ${span.cost.model}` : ""}
                  {span.cost.inputTokens != null ? ` · ${span.cost.inputTokens} in` : ""}
                  {span.cost.outputTokens != null ? ` / ${span.cost.outputTokens} out tokens` : ""}
                </span>
              ) : null}
            </div>

            {Object.keys(span.metadata).length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Metadata</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-background/80 p-3 text-xs text-foreground">
                  {JSON.stringify(span.metadata, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
