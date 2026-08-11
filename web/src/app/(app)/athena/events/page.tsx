import type { Metadata } from "next";
import { AthenaSectionTabs } from "@/components/athena/athena-section-tabs";
import { AthenaStatePanel } from "@/components/athena/athena-state-panel";
import { AthenaWindowSwitcher } from "@/components/athena/athena-window-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { TableSection } from "@/components/shared/table-section";
import { EmptyState } from "@/components/ui/empty-state";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import { buildAthenaWindow, formatAthenaCount, formatAthenaPercent, resolveAthenaWindowPreset } from "@/lib/athena-overview-model";
import { describeAthenaLoadError, type AthenaLoadOutcome } from "@/lib/athena-state";
import { getAthenaEventHealth, type AthenaEventHealthSummary } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Events & DLQ | TradeOS",
  description: "Event delivery success rate, pending retries, and dead-letter counts for Athena.",
};

export default async function AthenaEventsPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const [access, query] = await Promise.all([getAthenaOperatorContext(), searchParams]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Events & DLQ"
          backHref="/athena"
          backLabel="Athena"
          description="Event delivery success rate, pending retries, and dead-letter counts."
        />
        <AthenaStatePanel state={access.state} />
      </div>
    );
  }

  const preset = resolveAthenaWindowPreset(query.window);
  const window = buildAthenaWindow(preset);

  let events: AthenaEventHealthSummary | null = null;
  let loadState: AthenaLoadOutcome | null = null;

  try {
    events = await getAthenaEventHealth(access.token, window);
  } catch (error) {
    loadState = describeAthenaLoadError(error);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events & DLQ"
        backHref="/athena"
        backLabel="Athena"
        description="Event delivery success rate, pending retries, and dead-letter counts."
      />
      <AthenaSectionTabs active="events" />

      {loadState || !events ? (
        <AthenaStatePanel state={loadState ?? { kind: "error", message: "Unable to load event health." }} />
      ) : (
        <>
          <AthenaWindowSwitcher basePath="/athena/events" active={preset} />

          {events.eventCount === 0 ? (
            <EmptyState
              title="No events in this window"
              description="Athena hasn't emitted any events in the selected time window. Widen the window above, or check back once activity resumes."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryMetricCard label="Events" value={formatAthenaCount(events.eventCount)} />
                <SummaryMetricCard label="Delivery success rate" value={formatAthenaPercent(events.deliverySuccessRate)} />
                <SummaryMetricCard label="Pending retries" value={formatAthenaCount(events.pendingRetryCount)} />
                <SummaryMetricCard label="Dead letters" value={formatAthenaCount(events.deadLetterCount)} />
              </div>

              <TableSection title="Dead letters by type" description="Events that exhausted retries, grouped by event type.">
                {events.deadLetterCountByType.length === 0 ? (
                  <EmptyState title="No dead letters" description="No events have exhausted their delivery retries in this window - event delivery is healthy." />
                ) : (
                  <table className="min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th scope="col" className="px-3 py-2">Event type</th>
                        <th scope="col" className="px-3 py-2">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.deadLetterCountByType.map((row) => (
                        <tr key={row.type} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium text-foreground">{row.type}</td>
                          <td className="px-3 py-2 text-foreground">{formatAthenaCount(row.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </TableSection>
            </>
          )}
        </>
      )}
    </div>
  );
}
