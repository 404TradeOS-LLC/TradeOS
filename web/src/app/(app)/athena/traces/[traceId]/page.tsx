import type { Metadata } from "next";
import { AthenaCompletenessPanel } from "@/components/athena/athena-completeness-panel";
import { AthenaSpanList } from "@/components/athena/athena-span-list";
import { AthenaStatePanel } from "@/components/athena/athena-state-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SummaryList } from "@/components/shared/summary-list";
import { Timeline } from "@/components/shared/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import { describeAthenaLoadError, type AthenaLoadOutcome } from "@/lib/athena-state";
import { ApiClientError, getAthenaTraceByTrace, type AthenaTraceDetail } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Trace | TradeOS",
  description: "Detail view of a single Athena request execution trace.",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AthenaTraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const [access, { traceId }] = await Promise.all([getAthenaOperatorContext(), params]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Trace" backHref="/athena/traces" backLabel="All traces" />
        <AthenaStatePanel state={access.state} />
      </div>
    );
  }

  let trace: AthenaTraceDetail | null = null;
  let loadState: AthenaLoadOutcome | null = null;
  let notFound = false;

  try {
    trace = await getAthenaTraceByTrace(access.token, traceId);
  } catch (error) {
    // The backend 404s both for "flag disabled" (requireObservabilityAccess,
    // before it even checks the trace) and for a genuinely missing trace
    // (getTrace's explicit ApiError(404, "Trace not found")) - disambiguate
    // by message so a bad/expired trace id gets its own calm "not found"
    // copy instead of being folded into the "not enabled yet" state.
    if (error instanceof ApiClientError && error.status === 404 && error.message === "Trace not found") {
      notFound = true;
    } else {
      loadState = describeAthenaLoadError(error);
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Trace" backHref="/athena/traces" backLabel="All traces" />
        <EmptyState
          title="Trace not found"
          description="No trace with this id exists in your organization. It may be outside the retention window, or the id may be incorrect."
        />
      </div>
    );
  }

  if (loadState || !trace) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Trace" backHref="/athena/traces" backLabel="All traces" />
        <AthenaStatePanel state={loadState ?? { kind: "error", message: "Unable to load this trace." }} />
      </div>
    );
  }

  const { execution, transitions, spans, completeness } = trace;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Trace ${execution.traceId}`}
        backHref="/athena/traces"
        backLabel="All traces"
        description={execution.safeSummary ?? "Full lifecycle detail for this Athena request execution."}
      />

      <Card className="border-border/70">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Execution</CardTitle>
          <StatusBadge status={execution.state} />
        </CardHeader>
        <CardContent>
          <SummaryList
            items={[
              { label: "Request ID", value: execution.requestId },
              { label: "Execution ID", value: execution.executionId },
              { label: "Actor", value: execution.actorUserId },
              { label: "Role", value: execution.canonicalRole },
              { label: "Source", value: execution.requestSource },
              { label: "Round trips", value: String(execution.roundTrips) },
              { label: "Error code", value: execution.safeErrorCode ?? "None" },
              { label: "Created", value: formatDateTime(execution.createdAt) },
              { label: "Updated", value: formatDateTime(execution.updatedAt) },
              { label: "Completed", value: formatDateTime(execution.completedAt) },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Lifecycle transitions</CardTitle>
        </CardHeader>
        <CardContent>
          {transitions.length === 0 ? (
            <EmptyState title="No transitions recorded" description="This execution has no recorded state transitions yet." />
          ) : (
            <Timeline
              items={transitions.map((transition, index) => ({
                label: `${transition.fromState ?? "start"} → ${transition.toState}`,
                value: `${transition.reasonCode} · ${formatDateTime(transition.createdAt)}`,
                active: index === transitions.length - 1,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <AthenaCompletenessPanel completeness={completeness} />

      <AthenaSpanList spans={spans} />
    </div>
  );
}
