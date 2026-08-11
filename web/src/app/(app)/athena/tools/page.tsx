import type { Metadata } from "next";
import { AthenaSectionTabs } from "@/components/athena/athena-section-tabs";
import { AthenaStatePanel } from "@/components/athena/athena-state-panel";
import { AthenaWindowSwitcher } from "@/components/athena/athena-window-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { TableSection } from "@/components/shared/table-section";
import { EmptyState } from "@/components/ui/empty-state";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import { buildAthenaWindow, formatAthenaCount, formatAthenaMs, formatAthenaPercent, resolveAthenaWindowPreset } from "@/lib/athena-overview-model";
import { describeAthenaLoadError, type AthenaLoadOutcome } from "@/lib/athena-state";
import { getAthenaToolMetrics, type AthenaToolMetric } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Tool Health | TradeOS",
  description: "Invocation volume, success rate, and latency for every tool Athena has called.",
};

export default async function AthenaToolsPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const [access, query] = await Promise.all([getAthenaOperatorContext(), searchParams]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Tool Health" backHref="/athena" backLabel="Athena" description="Invocation volume, success rate, and latency by tool." />
        <AthenaStatePanel state={access.state} />
      </div>
    );
  }

  const preset = resolveAthenaWindowPreset(query.window);
  const window = buildAthenaWindow(preset);

  let tools: AthenaToolMetric[] = [];
  let loadState: AthenaLoadOutcome | null = null;

  try {
    tools = await getAthenaToolMetrics(access.token, window);
  } catch (error) {
    loadState = describeAthenaLoadError(error);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tool Health" backHref="/athena" backLabel="Athena" description="Invocation volume, success rate, and latency by tool." />
      <AthenaSectionTabs active="tools" />

      {loadState ? (
        <AthenaStatePanel state={loadState} />
      ) : (
        <>
          <AthenaWindowSwitcher basePath="/athena/tools" active={preset} />

          {tools.length === 0 ? (
            <EmptyState
              title="No tool activity in this window"
              description="Athena hasn't invoked any tools in the selected time window. Widen the window above, or check back once tools have run."
            />
          ) : (
            <TableSection title="Tools" description={`${tools.length} tool${tools.length === 1 ? "" : "s"} invoked in this window.`}>
              <table className="min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <th scope="col" className="px-3 py-2">Tool</th>
                    <th scope="col" className="px-3 py-2">Invocations</th>
                    <th scope="col" className="px-3 py-2">Success rate</th>
                    <th scope="col" className="px-3 py-2">Failures</th>
                    <th scope="col" className="px-3 py-2">Latency p50</th>
                    <th scope="col" className="px-3 py-2">Latency p95</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((tool) => (
                    <tr key={tool.toolId} className="border-b border-border/50">
                      <td className="px-3 py-3 font-medium text-foreground">{tool.toolId}</td>
                      <td className="px-3 py-3 text-foreground">{formatAthenaCount(tool.invocationCount)}</td>
                      <td className="px-3 py-3 text-foreground">{formatAthenaPercent(tool.successRate)}</td>
                      <td className="px-3 py-3 text-foreground">{formatAthenaCount(tool.failureCount)}</td>
                      <td className="px-3 py-3 text-foreground">{formatAthenaMs(tool.latencyMsP50)}</td>
                      <td className="px-3 py-3 text-foreground">{formatAthenaMs(tool.latencyMsP95)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSection>
          )}
        </>
      )}
    </div>
  );
}
