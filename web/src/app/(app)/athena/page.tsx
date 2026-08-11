import type { Metadata } from "next";
import { AthenaAlertsPanel } from "@/components/athena/athena-alerts-panel";
import { AthenaSectionTabs } from "@/components/athena/athena-section-tabs";
import { AthenaStatePanel } from "@/components/athena/athena-state-panel";
import { AthenaWindowSwitcher } from "@/components/athena/athena-window-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import {
  buildAthenaWindow,
  formatAthenaCount,
  formatAthenaMs,
  formatAthenaPercent,
  formatAthenaUsd,
  hasAthenaActivity,
  resolveAthenaWindowPreset,
} from "@/lib/athena-overview-model";
import { describeAthenaLoadError, type AthenaLoadOutcome } from "@/lib/athena-state";
import { getAthenaObservabilityOverview, listAthenaAlerts, type AthenaAlertRecord, type AthenaOverviewMetrics } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Observability | TradeOS",
  description: "Operator-only reporting for Athena's request traces, tool/model health, cost, and event/DLQ health.",
};

interface AthenaOverviewSearchParams {
  window?: string;
}

export default async function AthenaOverviewPage({ searchParams }: { searchParams: Promise<AthenaOverviewSearchParams> }) {
  const [access, query] = await Promise.all([getAthenaOperatorContext(), searchParams]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Athena"
          description="Operator-only reporting for Athena's request traces, tool/model health, cost, and event/DLQ health."
        />
        <AthenaStatePanel state={access.state} />
      </div>
    );
  }

  const preset = resolveAthenaWindowPreset(query.window);
  const window = buildAthenaWindow(preset);

  let overview: AthenaOverviewMetrics | null = null;
  let alerts: AthenaAlertRecord[] = [];
  let loadState: AthenaLoadOutcome | null = null;

  try {
    [overview, alerts] = await Promise.all([
      getAthenaObservabilityOverview(access.token, window),
      listAthenaAlerts(access.token, { status: "active" }),
    ]);
  } catch (error) {
    loadState = describeAthenaLoadError(error);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Athena"
        description="Operator-only reporting for Athena's request traces, tool/model health, cost, and event/DLQ health."
      />
      <AthenaSectionTabs active="overview" />

      {loadState || !overview ? (
        <AthenaStatePanel state={loadState ?? { kind: "error", message: "Unable to load Athena overview metrics." }} />
      ) : (
        <>
          <AthenaWindowSwitcher basePath="/athena" active={preset} />

          {hasAthenaActivity(overview) ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryMetricCard label="Requests" value={formatAthenaCount(overview.requestCount)} />
              <SummaryMetricCard label="Success rate" value={formatAthenaPercent(overview.successRate)} />
              <SummaryMetricCard label="Error rate" value={formatAthenaPercent(overview.errorRate)} />
              <SummaryMetricCard label="Degraded rate" value={formatAthenaPercent(overview.degradedRate)} />
              <SummaryMetricCard label="Denied rate" value={formatAthenaPercent(overview.deniedRate)} />
              <SummaryMetricCard label="Latency p50" value={formatAthenaMs(overview.latencyMsP50)} />
              <SummaryMetricCard label="Latency p95" value={formatAthenaMs(overview.latencyMsP95)} />
              <SummaryMetricCard label="Latency p99" value={formatAthenaMs(overview.latencyMsP99)} />
              <SummaryMetricCard label="Total cost" value={formatAthenaUsd(overview.totalCostUsd)} />
              <SummaryMetricCard label="Avg. trace completeness" value={formatAthenaPercent(overview.averageTraceCompleteness)} />
            </div>
          ) : (
            <EmptyState
              title="No Athena activity in this window"
              description="No requests were recorded in the selected time window. Widen the window above, or check back once Athena has processed some requests."
            />
          )}

          <AthenaAlertsPanel alerts={alerts} />
        </>
      )}
    </div>
  );
}
