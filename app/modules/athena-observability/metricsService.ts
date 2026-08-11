import { prisma } from "../../db/client";
import { computeTraceCompleteness } from "./completeness";
import type { AthenaKernelState, AthenaTelemetryCost, AthenaTelemetrySpanType } from "../athena-kernel/types";
import type { AthenaCostSummary, AthenaEventHealthSummary, AthenaMetricsWindow, AthenaModelMetric, AthenaOverviewMetrics, AthenaTelemetrySpan, AthenaToolMetric } from "./types";

// A10 metrics/aggregation service (docs/athena/roadmap/
// A10-observability-implementation-plan.md "Metrics"). Every function here
// takes a bounded { orgId, from, to } window and scopes every underlying
// query to orgId plus the equivalent window column for that table
// (createdAt for executions/telemetry/deliveries/dead-letters, occurredAt
// for events - the one model that actually has a distinct
// "when did the real thing happen" timestamp). Like traceService.ts, this
// only ever imports `prisma` (the RLS-scoped proxy from app/db/client.ts),
// never basePrisma, and passes orgId explicitly in every where clause as
// defense in depth on top of RLS.

export interface AthenaMetricsQuery {
  orgId: string;
  from: string;
  to: string;
}

// A10 spec: "cap at 500 - do not compute this over unbounded rows" for
// averageTraceCompleteness specifically (see getOverviewMetrics below).
const COMPLETENESS_SAMPLE_CAP = 500;

function toWindow(query: AthenaMetricsQuery): AthenaMetricsWindow {
  return { from: query.from, to: query.to };
}

function windowRange(query: AthenaMetricsQuery): { gte: Date; lt: Date } {
  return { gte: new Date(query.from), lt: new Date(query.to) };
}

function sumEstimatedUsd(rows: { costJson: unknown }[]): number {
  let total = 0;
  for (const row of rows) {
    const cost = row.costJson as AthenaTelemetryCost | null | undefined;
    if (cost && typeof cost.estimatedUsd === "number") total += cost.estimatedUsd;
  }
  return total;
}

// Nearest-rank percentile. The A10 spec asks for "a standard percentile"
// without mandating interpolation, so nearest-rank was chosen because it
// never fabricates a latency value nobody actually observed - every
// returned percentile is one of the sampled durations, just picked by rank.
// `sortedAsc` must already be sorted ascending; p is 0-100.
function nearestRankPercentile(sortedAsc: readonly number[], p: number): number {
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const index = Math.min(Math.max(rank - 1, 0), sortedAsc.length - 1);
  return sortedAsc[index];
}

function percentiles(durationsMs: number[]): { p50: number | null; p95: number | null; p99: number | null } {
  if (durationsMs.length === 0) return { p50: null, p95: null, p99: null };
  const sorted = [...durationsMs].sort((a, b) => a - b);
  return {
    p50: nearestRankPercentile(sorted, 50),
    p95: nearestRankPercentile(sorted, 95),
    p99: nearestRankPercentile(sorted, 99),
  };
}

// Terminal escape states that count as "error" for overview purposes
// (lifecycle.ts's escapeStates): failed is the direct business failure,
// expired/cancelled are the other two ways a request ends without a
// success/denial - all three are failure-adjacent from an operator's point
// of view, per the milestone prompt.
const ERROR_STATES: ReadonlySet<string> = new Set(["failed", "expired", "cancelled"]);

// Round-trip states (lifecycle.ts's isRoundTripState): "degraded" is used
// literally, and "needs_clarification" is the other state a request can be
// sitting in mid-round-trip. Both are non-terminal - an execution counted
// here today can still finish "succeeded" or anything else later.
const DEGRADED_STATES: ReadonlySet<string> = new Set(["degraded", "needs_clarification"]);

export async function getOverviewMetrics(query: AthenaMetricsQuery): Promise<AthenaOverviewMetrics> {
  const { gte, lt } = windowRange(query);

  const executions = await prisma.athenaExecution.findMany({
    where: { orgId: query.orgId, createdAt: { gte, lt } },
    select: { id: true, state: true, createdAt: true, completedAt: true },
  });

  const requestCount = executions.length;

  // Rate bucketing - documented explicitly per the milestone prompt's
  // request, since this is exactly the kind of thing a future reader will
  // second-guess:
  //   successRate  = executions whose terminal state is "succeeded"
  //   errorRate    = executions whose terminal state is failed/expired/cancelled
  //   deniedRate   = executions whose terminal state is "denied"
  //   degradedRate = executions *currently* sitting in "degraded" or
  //                  "needs_clarification" - both non-terminal round-trip
  //                  states (lifecycle.ts's isRoundTripState). This is a
  //                  different kind of bucket than the first three: it is a
  //                  snapshot of in-flight state, not a terminal outcome, so
  //                  an execution counted here today may still resolve to
  //                  "succeeded" (or anything else) tomorrow.
  // The four rates are denominated over the same requestCount but do NOT
  // sum to 1: executions sitting in any *other* non-terminal state at query
  // time (created, context_building, routing, planning, policy_check,
  // executing, awaiting_approval, partially_succeeded) are counted in
  // requestCount but fall into none of the four buckets. There is no
  // "healthy in-progress" bucket in the AthenaOverviewMetrics contract, and
  // inventing one here would misrepresent a request that simply hasn't
  // reached a terminal or round-trip state yet.
  let succeeded = 0;
  let errored = 0;
  let denied = 0;
  let degraded = 0;
  const completedDurationsMs: number[] = [];
  for (const execution of executions) {
    if (execution.state === "succeeded") succeeded += 1;
    else if (ERROR_STATES.has(execution.state)) errored += 1;
    else if (execution.state === "denied") denied += 1;
    else if (DEGRADED_STATES.has(execution.state)) degraded += 1;

    if (execution.completedAt) {
      completedDurationsMs.push(execution.completedAt.getTime() - execution.createdAt.getTime());
    }
  }

  const rate = (count: number): number => (requestCount === 0 ? 0 : count / requestCount);
  const latency = percentiles(completedDurationsMs);

  const telemetryCostRows = await prisma.athenaTelemetryRecordRow.findMany({
    where: { orgId: query.orgId, createdAt: { gte, lt } },
    select: { costJson: true },
  });
  const totalCostUsd = sumEstimatedUsd(telemetryCostRows as { costJson: unknown }[]);

  const averageTraceCompleteness = await computeAverageTraceCompleteness(query.orgId, executions);

  return {
    window: toWindow(query),
    requestCount,
    successRate: rate(succeeded),
    errorRate: rate(errored),
    degradedRate: rate(degraded),
    deniedRate: rate(denied),
    latencyMsP50: latency.p50,
    latencyMsP95: latency.p95,
    latencyMsP99: latency.p99,
    totalCostUsd,
    averageTraceCompleteness,
  };
}

// Averages computeTraceCompleteness's score over a *bounded* sample of this
// window's executions (A10 spec: "cap at 500 - do not compute this over
// unbounded rows"). Completeness is O(spans-per-trace) per execution, so an
// unbounded window could mean scanning an unbounded number of telemetry
// rows for a single summary number; sampling the most-recently-created 500
// executions keeps the query bounded regardless of window size, at the cost
// of the metric becoming an estimate (not an exact average) once a window
// holds more than 500 executions. That tradeoff is intentional for an
// overview metric and is called out here and in the implementation report,
// not silently approximated.
async function computeAverageTraceCompleteness(orgId: string, executions: { id: string; state: string; createdAt: Date }[]): Promise<number | null> {
  if (executions.length === 0) return null;

  const sample = [...executions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, COMPLETENESS_SAMPLE_CAP);

  const spanRows = await prisma.athenaTelemetryRecordRow.findMany({
    where: { orgId, executionId: { in: sample.map((execution) => execution.id) } },
    select: { executionId: true, spanType: true, metadataJson: true },
  });

  const spansByExecution = new Map<string, AthenaTelemetrySpan[]>();
  for (const row of spanRows as { executionId: string; spanType: string; metadataJson: unknown }[]) {
    // computeTraceCompleteness only reads spanType and metadata.stepId at
    // runtime (completeness.ts) - a minimal span shape is used here
    // intentionally, so this aggregate only ever selects the two JSON/text
    // columns it needs instead of the full telemetry row for up to 500
    // traces' worth of spans.
    const span = { spanType: row.spanType as AthenaTelemetrySpanType, metadata: (row.metadataJson as Record<string, unknown> | null | undefined) ?? {} } as AthenaTelemetrySpan;
    const list = spansByExecution.get(row.executionId) ?? [];
    list.push(span);
    spansByExecution.set(row.executionId, list);
  }

  let totalScore = 0;
  for (const execution of sample) {
    const spans = spansByExecution.get(execution.id) ?? [];
    totalScore += computeTraceCompleteness(execution.state as AthenaKernelState, spans).score;
  }

  return totalScore / sample.length;
}

export async function getToolMetrics(query: AthenaMetricsQuery): Promise<AthenaToolMetric[]> {
  const { gte, lt } = windowRange(query);

  const rows = await prisma.athenaTelemetryRecordRow.findMany({
    where: { orgId: query.orgId, spanType: "action", createdAt: { gte, lt } },
    select: { status: true, durationMs: true, metadataJson: true },
  });

  const byTool = new Map<string, { durations: number[]; success: number; total: number }>();
  for (const row of rows as { status: string; durationMs: number; metadataJson: unknown }[]) {
    const metadata = (row.metadataJson as Record<string, unknown> | null | undefined) ?? {};
    const toolId = typeof metadata.toolId === "string" && metadata.toolId.length > 0 ? metadata.toolId : "unknown";
    const bucket = byTool.get(toolId) ?? { durations: [], success: 0, total: 0 };
    bucket.total += 1;
    if (row.status === "ok") bucket.success += 1;
    bucket.durations.push(row.durationMs);
    byTool.set(toolId, bucket);
  }

  return Array.from(byTool.entries()).map(([toolId, bucket]) => {
    const latency = percentiles(bucket.durations);
    return {
      toolId,
      invocationCount: bucket.total,
      successCount: bucket.success,
      // Failure is "not ok" (covers action spans' "error"/"denied" status
      // values) - AthenaToolMetric has no separate deniedCount, so a denied
      // action step is counted as a failed invocation here.
      failureCount: bucket.total - bucket.success,
      successRate: bucket.total === 0 ? 0 : bucket.success / bucket.total,
      latencyMsP50: latency.p50,
      latencyMsP95: latency.p95,
    };
  });
}

export async function getModelMetrics(query: AthenaMetricsQuery): Promise<AthenaModelMetric[]> {
  const { gte, lt } = windowRange(query);

  const rows = await prisma.athenaTelemetryRecordRow.findMany({
    where: { orgId: query.orgId, spanType: "model", createdAt: { gte, lt } },
    select: { status: true, durationMs: true, metadataJson: true, costJson: true },
  });

  const byModel = new Map<
    string,
    { provider: string; model: string; durations: number[]; failures: number; total: number; inputTokens: number; outputTokens: number; estimatedUsd: number }
  >();
  for (const row of rows as { status: string; durationMs: number; metadataJson: unknown; costJson: unknown }[]) {
    const metadata = (row.metadataJson as Record<string, unknown> | null | undefined) ?? {};
    const provider = typeof metadata.provider === "string" && metadata.provider.length > 0 ? metadata.provider : "unknown";
    const model = typeof metadata.model === "string" && metadata.model.length > 0 ? metadata.model : "unknown";
    const key = `${provider} ${model}`;
    const bucket = byModel.get(key) ?? { provider, model, durations: [], failures: 0, total: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 };
    bucket.total += 1;
    if (row.status === "error") bucket.failures += 1;
    bucket.durations.push(row.durationMs);
    const cost = row.costJson as AthenaTelemetryCost | null | undefined;
    if (cost) {
      if (typeof cost.inputTokens === "number") bucket.inputTokens += cost.inputTokens;
      if (typeof cost.outputTokens === "number") bucket.outputTokens += cost.outputTokens;
      if (typeof cost.estimatedUsd === "number") bucket.estimatedUsd += cost.estimatedUsd;
    }
    byModel.set(key, bucket);
  }

  return Array.from(byModel.values()).map((bucket) => {
    const latency = percentiles(bucket.durations);
    return {
      provider: bucket.provider,
      model: bucket.model,
      invocationCount: bucket.total,
      failureCount: bucket.failures,
      inputTokens: bucket.inputTokens,
      outputTokens: bucket.outputTokens,
      estimatedUsd: bucket.estimatedUsd,
      latencyMsP50: latency.p50,
      latencyMsP95: latency.p95,
    };
  });
}

export async function getCostSummary(query: AthenaMetricsQuery): Promise<AthenaCostSummary> {
  const { gte, lt } = windowRange(query);

  const [requestCount, succeededCount, allCostRows, modelRows] = await Promise.all([
    prisma.athenaExecution.count({ where: { orgId: query.orgId, createdAt: { gte, lt } } }),
    prisma.athenaExecution.count({ where: { orgId: query.orgId, createdAt: { gte, lt }, state: "succeeded" } }),
    prisma.athenaTelemetryRecordRow.findMany({ where: { orgId: query.orgId, createdAt: { gte, lt } }, select: { costJson: true } }),
    prisma.athenaTelemetryRecordRow.findMany({ where: { orgId: query.orgId, spanType: "model", createdAt: { gte, lt } }, select: { metadataJson: true, costJson: true } }),
  ]);

  const totalEstimatedUsd = sumEstimatedUsd(allCostRows as { costJson: unknown }[]);

  const byProviderMap = new Map<string, number>();
  const byModelMap = new Map<string, { provider: string; model: string; estimatedUsd: number }>();
  for (const row of modelRows as { metadataJson: unknown; costJson: unknown }[]) {
    const metadata = (row.metadataJson as Record<string, unknown> | null | undefined) ?? {};
    const provider = typeof metadata.provider === "string" && metadata.provider.length > 0 ? metadata.provider : "unknown";
    const model = typeof metadata.model === "string" && metadata.model.length > 0 ? metadata.model : "unknown";
    const cost = row.costJson as AthenaTelemetryCost | null | undefined;
    const estimatedUsd = cost && typeof cost.estimatedUsd === "number" ? cost.estimatedUsd : 0;

    byProviderMap.set(provider, (byProviderMap.get(provider) ?? 0) + estimatedUsd);

    const key = `${provider} ${model}`;
    const existing = byModelMap.get(key) ?? { provider, model, estimatedUsd: 0 };
    existing.estimatedUsd += estimatedUsd;
    byModelMap.set(key, existing);
  }

  return {
    window: toWindow(query),
    totalEstimatedUsd,
    costPerRequestUsd: requestCount === 0 ? null : totalEstimatedUsd / requestCount,
    costPerSuccessfulRequestUsd: succeededCount === 0 ? null : totalEstimatedUsd / succeededCount,
    byProvider: Array.from(byProviderMap.entries()).map(([provider, estimatedUsd]) => ({ provider, estimatedUsd })),
    byModel: Array.from(byModelMap.values()),
  };
}

export async function getEventHealth(query: AthenaMetricsQuery): Promise<AthenaEventHealthSummary> {
  const { gte, lt } = windowRange(query);

  // A8's event tables, not telemetry - AthenaEvent's own occurredAt is the
  // "when did the real thing happen" timestamp; AthenaEventDelivery/
  // AthenaEventDeadLetter have no occurredAt of their own, so their window
  // is their createdAt (when the delivery attempt / dead-letter row was
  // written).
  const [eventCount, deliveries, deadLetters] = await Promise.all([
    prisma.athenaEvent.count({ where: { orgId: query.orgId, occurredAt: { gte, lt } } }),
    prisma.athenaEventDelivery.findMany({ where: { orgId: query.orgId, createdAt: { gte, lt } }, select: { status: true } }),
    prisma.athenaEventDeadLetter.findMany({ where: { orgId: query.orgId, createdAt: { gte, lt } }, select: { eventId: true } }),
  ]);

  const deliveryRows = deliveries as { status: string }[];
  const deliveryCount = deliveryRows.length;
  const succeededDeliveries = deliveryRows.filter((delivery) => delivery.status === "succeeded").length;
  // Per the milestone prompt: pendingRetryCount counts status "pending"
  // specifically (not also "failed", even though store.ts's own retry
  // picker query treats status in ["pending", "failed"] as retryable - this
  // metric is narrower by spec, matching AthenaEventDeliveryStatus's literal
  // "pending" value).
  const pendingRetryCount = deliveryRows.filter((delivery) => delivery.status === "pending").length;

  const deadLetterRows = deadLetters as { eventId: string }[];
  const deadLetterCount = deadLetterRows.length;

  const eventIds = Array.from(new Set(deadLetterRows.map((deadLetter) => deadLetter.eventId)));
  const events = eventIds.length > 0 ? await prisma.athenaEvent.findMany({ where: { orgId: query.orgId, id: { in: eventIds } }, select: { id: true, type: true } }) : [];
  const typeByEventId = new Map((events as { id: string; type: string }[]).map((event) => [event.id, event.type]));

  const countByType = new Map<string, number>();
  for (const deadLetter of deadLetterRows) {
    const type = typeByEventId.get(deadLetter.eventId) ?? "unknown";
    countByType.set(type, (countByType.get(type) ?? 0) + 1);
  }

  return {
    window: toWindow(query),
    eventCount,
    deliveryCount,
    deliverySuccessRate: deliveryCount === 0 ? 0 : succeededDeliveries / deliveryCount,
    pendingRetryCount,
    deadLetterCount,
    deadLetterCountByType: Array.from(countByType.entries()).map(([type, count]) => ({ type, count })),
  };
}
