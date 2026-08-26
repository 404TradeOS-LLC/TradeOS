import type { Metadata } from "next";
import { AthenaSectionTabs } from "@/components/athena/athena-section-tabs";
import { AthenaStatePanel } from "@/components/athena/athena-state-panel";
import { AthenaWindowSwitcher } from "@/components/athena/athena-window-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { TableSection } from "@/components/shared/table-section";
import { EmptyState } from "@/components/ui/empty-state";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import {
  buildAthenaWindow,
  formatAthenaCount,
  formatAthenaMs,
  formatAthenaUsd,
  resolveAthenaWindowPreset,
} from "@/lib/athena-overview-model";
import { describeAthenaLoadError, type AthenaLoadOutcome } from "@/lib/athena-state";
import { getAthenaCostSummary, getAthenaModelMetrics, type AthenaCostSummary, type AthenaModelMetric } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Models & Cost | TradeOS",
  description: "Per-model invocation volume, token usage, and estimated cost for Athena.",
};

export default async function AthenaModelsPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const [access, query] = await Promise.all([getAthenaOperatorContext(), searchParams]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Models & Cost" backHref="/athena" backLabel="Athena" description="Per-model usage and estimated cost for Athena." />
        <AthenaStatePanel state={access.state} />
      </div>
    );
  }

  const preset = resolveAthenaWindowPreset(query.window);
  const window = buildAthenaWindow(preset);

  let models: AthenaModelMetric[] = [];
  let cost: AthenaCostSummary | null = null;
  let loadState: AthenaLoadOutcome | null = null;

  try {
    [models, cost] = await Promise.all([getAthenaModelMetrics(access.token, window), getAthenaCostSummary(access.token, window)]);
  } catch (error) {
    loadState = describeAthenaLoadError(error);
  }

  const isEmpty = models.length === 0 && (!cost || cost.totalEstimatedUsd === 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Models & Cost" backHref="/athena" backLabel="Athena" description="Per-model usage and estimated cost for Athena." />
      <AthenaSectionTabs active="models" />

      {loadState || !cost ? (
        <AthenaStatePanel state={loadState ?? { kind: "error", message: "Unable to load model and cost metrics." }} />
      ) : (
        <>
          <AthenaWindowSwitcher basePath="/athena/models" active={preset} />

          {isEmpty ? (
            <EmptyState
              title="No model activity in this window"
              description="Athena hasn't called any AI models in the selected time window. Widen the window above, or check back once requests have run."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryMetricCard label="Total cost" value={formatAthenaUsd(cost.totalEstimatedUsd)} />
                <SummaryMetricCard label="Cost / request" value={formatAthenaUsd(cost.costPerRequestUsd)} />
                <SummaryMetricCard label="Cost / successful request" value={formatAthenaUsd(cost.costPerSuccessfulRequestUsd)} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <TableSection title="Cost by provider" description="Estimated spend for this window, grouped by provider.">
                  {cost.byProvider.length === 0 ? (
                    <EmptyState title="No provider cost yet" description="No provider spend recorded in this window." />
                  ) : (
                    <table className="min-w-[280px] text-left text-sm">
                      <tbody>
                        {cost.byProvider.map((row) => (
                          <tr key={row.provider} className="border-b border-border/50">
                            <td className="px-3 py-2 font-medium text-foreground">{row.provider}</td>
                            <td className="px-3 py-2 text-right text-foreground">{formatAthenaUsd(row.estimatedUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </TableSection>

                <TableSection title="Cost by model" description="Estimated spend for this window, grouped by model.">
                  {cost.byModel.length === 0 ? (
                    <EmptyState title="No model cost yet" description="No per-model spend recorded in this window." />
                  ) : (
                    <table className="min-w-[280px] text-left text-sm">
                      <tbody>
                        {cost.byModel.map((row) => (
                          <tr key={`${row.provider}:${row.model}`} className="border-b border-border/50">
                            <td className="px-3 py-2 font-medium text-foreground">
                              {row.model}
                              <span className="ml-1 text-xs text-muted-foreground">{row.provider}</span>
                            </td>
                            <td className="px-3 py-2 text-right text-foreground">{formatAthenaUsd(row.estimatedUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </TableSection>
              </div>

              {models.length === 0 ? (
                <EmptyState title="No model invocations" description="No model metrics recorded in this window." />
              ) : (
                <TableSection title="Models" description={`${models.length} model${models.length === 1 ? "" : "s"} invoked in this window.`}>
                  <table className="min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th scope="col" className="px-3 py-2">Provider / Model</th>
                        <th scope="col" className="px-3 py-2">Invocations</th>
                        <th scope="col" className="px-3 py-2">Failures</th>
                        <th scope="col" className="px-3 py-2">Tokens (in / out)</th>
                        <th scope="col" className="px-3 py-2">Estimated cost</th>
                        <th scope="col" className="px-3 py-2">Latency p50</th>
                        <th scope="col" className="px-3 py-2">Latency p95</th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((model) => (
                        <tr key={`${model.provider}:${model.model}`} className="border-b border-border/50">
                          <td className="px-3 py-3">
                            <div className="font-medium text-foreground">{model.model}</div>
                            <div className="text-xs text-muted-foreground">{model.provider}</div>
                          </td>
                          <td className="px-3 py-3 text-foreground">{formatAthenaCount(model.invocationCount)}</td>
                          <td className="px-3 py-3 text-foreground">{formatAthenaCount(model.failureCount)}</td>
                          <td className="px-3 py-3 text-foreground">
                            {formatAthenaCount(model.inputTokens)} / {formatAthenaCount(model.outputTokens)}
                          </td>
                          <td className="px-3 py-3 text-foreground">{formatAthenaUsd(model.estimatedUsd)}</td>
                          <td className="px-3 py-3 text-foreground">{formatAthenaMs(model.latencyMsP50)}</td>
                          <td className="px-3 py-3 text-foreground">{formatAthenaMs(model.latencyMsP95)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableSection>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
