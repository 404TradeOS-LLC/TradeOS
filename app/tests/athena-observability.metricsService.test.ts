import { createFakeModel, type FakeRow } from "./helpers/fakeAthenaObservabilityDb";

const executions: FakeRow[] = [];
const telemetry: FakeRow[] = [];
const events: FakeRow[] = [];
const deliveries: FakeRow[] = [];
const deadLetters: FakeRow[] = [];

const fakePrisma = {
  athenaExecution: createFakeModel(executions),
  athenaTelemetryRecordRow: createFakeModel(telemetry),
  athenaEvent: createFakeModel(events),
  athenaEventDelivery: createFakeModel(deliveries),
  athenaEventDeadLetter: createFakeModel(deadLetters),
};

jest.mock("../db/client", () => ({ prisma: fakePrisma }));

import { getCostSummary, getEventHealth, getModelMetrics, getOverviewMetrics, getToolMetrics } from "../modules/athena-observability/metricsService";

const ORG_A = "org-a";
const ORG_B = "org-b";
const WINDOW_FROM = "2026-08-10T00:00:00.000Z";
const WINDOW_TO = "2026-08-10T01:00:00.000Z";

function t(offsetMs: number): Date {
  return new Date(new Date(WINDOW_FROM).getTime() + offsetMs);
}

let executionCounter = 0;
function seedExecution(overrides: Partial<FakeRow> & { orgId: string; state: string }): string {
  executionCounter += 1;
  const id = (overrides.id as string) ?? `exec-${executionCounter}`;
  executions.push({
    id,
    orgId: overrides.orgId,
    requestId: `req-${id}`,
    traceId: `trace-${id}`,
    actorUserId: "user-1",
    canonicalRole: "owner",
    requestSource: "http",
    state: overrides.state,
    roundTrips: 0,
    safeSummary: "ok",
    safeErrorCode: null,
    createdAt: overrides.createdAt ?? t(0),
    updatedAt: overrides.createdAt ?? t(0),
    completedAt: overrides.completedAt ?? null,
  });
  return id;
}

let telemetryCounter = 0;
function seedSpan(overrides: Partial<FakeRow> & { orgId: string; executionId: string; spanType: string }): void {
  telemetryCounter += 1;
  telemetry.push({
    id: `span-${telemetryCounter}`,
    orgId: overrides.orgId,
    executionId: overrides.executionId,
    requestId: `req-${overrides.executionId}`,
    traceId: `trace-${overrides.executionId}`,
    spanType: overrides.spanType,
    status: overrides.status ?? "ok",
    durationMs: overrides.durationMs ?? 10,
    redaction: "metadata_only",
    costJson: overrides.costJson ?? null,
    metadataJson: overrides.metadataJson ?? {},
    createdAt: overrides.createdAt ?? t(0),
  });
}

let eventCounter = 0;
function seedEvent(overrides: Partial<FakeRow> & { orgId: string; type: string }): string {
  eventCounter += 1;
  const id = (overrides.id as string) ?? `event-${eventCounter}`;
  events.push({
    id,
    orgId: overrides.orgId,
    type: overrides.type,
    occurredAt: overrides.occurredAt ?? t(0),
    createdAt: overrides.createdAt ?? t(0),
  });
  return id;
}

let deliveryCounter = 0;
function seedDelivery(overrides: Partial<FakeRow> & { orgId: string; eventId: string; status: string }): void {
  deliveryCounter += 1;
  deliveries.push({
    id: `delivery-${deliveryCounter}`,
    orgId: overrides.orgId,
    eventId: overrides.eventId,
    status: overrides.status,
    createdAt: overrides.createdAt ?? t(0),
  });
}

let deadLetterCounter = 0;
function seedDeadLetter(overrides: Partial<FakeRow> & { orgId: string; eventId: string }): void {
  deadLetterCounter += 1;
  deadLetters.push({
    id: `dead-letter-${deadLetterCounter}`,
    orgId: overrides.orgId,
    eventId: overrides.eventId,
    createdAt: overrides.createdAt ?? t(0),
  });
}

function resetAll(): void {
  executions.length = 0;
  telemetry.length = 0;
  events.length = 0;
  deliveries.length = 0;
  deadLetters.length = 0;
  executionCounter = 0;
  telemetryCounter = 0;
  eventCounter = 0;
  deliveryCounter = 0;
  deadLetterCounter = 0;
  jest.clearAllMocks();
}

describe("athena-observability metricsService", () => {
  beforeEach(resetAll);

  it("getOverviewMetrics computes request counts, rate bucketing, and nearest-rank latency percentiles", async () => {
    seedExecution({ orgId: ORG_A, state: "succeeded", createdAt: t(100), completedAt: t(600) }); // duration 500
    seedExecution({ orgId: ORG_A, state: "succeeded", createdAt: t(200), completedAt: t(900) }); // duration 700
    seedExecution({ orgId: ORG_A, state: "failed", createdAt: t(300), completedAt: t(1000) }); // duration 700
    seedExecution({ orgId: ORG_A, state: "denied", createdAt: t(400), completedAt: t(500) }); // duration 100
    seedExecution({ orgId: ORG_A, state: "degraded", createdAt: t(500) }); // in-flight, no completedAt
    seedExecution({ orgId: ORG_A, state: "needs_clarification", createdAt: t(600) }); // in-flight
    seedExecution({ orgId: ORG_A, state: "routing", createdAt: t(700) }); // in-flight, in neither rate bucket

    // Out of window - must not affect any count.
    seedExecution({ orgId: ORG_A, state: "succeeded", createdAt: new Date("2026-08-09T00:00:00.000Z") });

    const metrics = await getOverviewMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });

    expect(metrics.requestCount).toBe(7);
    expect(metrics.successRate).toBeCloseTo(2 / 7, 10);
    expect(metrics.errorRate).toBeCloseTo(1 / 7, 10); // failed only in this dataset
    expect(metrics.deniedRate).toBeCloseTo(1 / 7, 10);
    expect(metrics.degradedRate).toBeCloseTo(2 / 7, 10); // degraded + needs_clarification
    // The four rates intentionally do not sum to 1: "routing" (in-flight,
    // non-terminal, non-round-trip) is counted in requestCount but in none
    // of the four buckets.
    expect(metrics.successRate + metrics.errorRate + metrics.deniedRate + metrics.degradedRate).toBeLessThan(1);

    // Durations: [500, 700, 700, 100] -> sorted [100, 500, 700, 700].
    // Nearest-rank: p50 rank=ceil(0.5*4)=2 -> index 1 -> 500.
    expect(metrics.latencyMsP50).toBe(500);
    // p95/p99 rank=ceil(0.95*4)=4 and ceil(0.99*4)=4 -> index 3 -> 700.
    expect(metrics.latencyMsP95).toBe(700);
    expect(metrics.latencyMsP99).toBe(700);
  });

  it("getOverviewMetrics returns zeroed rates and null latency/completeness for an empty window", async () => {
    const metrics = await getOverviewMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(metrics.requestCount).toBe(0);
    expect(metrics.successRate).toBe(0);
    expect(metrics.errorRate).toBe(0);
    expect(metrics.degradedRate).toBe(0);
    expect(metrics.deniedRate).toBe(0);
    expect(metrics.latencyMsP50).toBeNull();
    expect(metrics.latencyMsP95).toBeNull();
    expect(metrics.latencyMsP99).toBeNull();
    expect(metrics.totalCostUsd).toBe(0);
    expect(metrics.averageTraceCompleteness).toBeNull();
  });

  it("getOverviewMetrics sums telemetry cost across all span types and averages trace completeness", async () => {
    const execFull = seedExecution({ orgId: ORG_A, state: "succeeded", createdAt: t(0), completedAt: t(100) });
    const execPartial = seedExecution({ orgId: ORG_A, state: "succeeded", createdAt: t(50), completedAt: t(150) });

    // execFull has every span completeness.ts requires for "succeeded":
    // kernel, context, approval, model -> score 1.
    seedSpan({ orgId: ORG_A, executionId: execFull, spanType: "kernel", costJson: { estimatedUsd: 0.01 } });
    seedSpan({ orgId: ORG_A, executionId: execFull, spanType: "context" });
    seedSpan({ orgId: ORG_A, executionId: execFull, spanType: "approval" });
    seedSpan({ orgId: ORG_A, executionId: execFull, spanType: "model", costJson: { estimatedUsd: 0.02 } });

    // execPartial only has kernel+context -> missing approval+model -> score 0.5.
    seedSpan({ orgId: ORG_A, executionId: execPartial, spanType: "kernel" });
    seedSpan({ orgId: ORG_A, executionId: execPartial, spanType: "context" });

    const metrics = await getOverviewMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });

    expect(metrics.totalCostUsd).toBeCloseTo(0.03, 10);
    expect(metrics.averageTraceCompleteness).toBeCloseTo(0.75, 10); // (1 + 0.5) / 2
  });

  it("getToolMetrics groups action spans by toolId and computes success/failure counts and latency percentiles", async () => {
    const execA = seedExecution({ orgId: ORG_A, state: "succeeded" });
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "action", status: "ok", durationMs: 100, metadataJson: { toolId: "tool.a" } });
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "action", status: "ok", durationMs: 200, metadataJson: { toolId: "tool.a" } });
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "action", status: "error", durationMs: 300, metadataJson: { toolId: "tool.a" } });
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "action", status: "ok", durationMs: 50, metadataJson: { toolId: "tool.b" } });
    // Non-action spans must never be counted as tool invocations.
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "model", status: "ok", durationMs: 999 });

    const metrics = await getToolMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    const toolA = metrics.find((m) => m.toolId === "tool.a")!;
    const toolB = metrics.find((m) => m.toolId === "tool.b")!;

    expect(toolA.invocationCount).toBe(3);
    expect(toolA.successCount).toBe(2);
    expect(toolA.failureCount).toBe(1);
    expect(toolA.successRate).toBeCloseTo(2 / 3, 10);
    // [100, 200, 300] -> p50 rank=2 -> 200; p95 rank=ceil(2.85)=3 -> 300.
    expect(toolA.latencyMsP50).toBe(200);
    expect(toolA.latencyMsP95).toBe(300);

    expect(toolB.invocationCount).toBe(1);
    expect(toolB.successRate).toBe(1);
    expect(toolB.latencyMsP50).toBe(50);
  });

  it("getModelMetrics groups model spans by (provider, model) and sums token/cost data", async () => {
    const execA = seedExecution({ orgId: ORG_A, state: "succeeded" });
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "model", status: "ok", durationMs: 100, metadataJson: { provider: "anthropic", model: "claude" }, costJson: { inputTokens: 10, outputTokens: 5, estimatedUsd: 0.001 } });
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "model", status: "error", durationMs: 200, metadataJson: { provider: "anthropic", model: "claude" }, costJson: { inputTokens: 20, outputTokens: 10, estimatedUsd: 0.002 } });
    seedSpan({ orgId: ORG_A, executionId: execA, spanType: "model", status: "ok", durationMs: 50, metadataJson: { provider: "openai", model: "gpt" }, costJson: { inputTokens: 5, outputTokens: 2, estimatedUsd: 0.0005 } });

    const metrics = await getModelMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    const claude = metrics.find((m) => m.model === "claude")!;
    const gpt = metrics.find((m) => m.model === "gpt")!;

    expect(claude.provider).toBe("anthropic");
    expect(claude.invocationCount).toBe(2);
    expect(claude.failureCount).toBe(1);
    expect(claude.inputTokens).toBe(30);
    expect(claude.outputTokens).toBe(15);
    expect(claude.estimatedUsd).toBeCloseTo(0.003, 10);
    expect(claude.latencyMsP50).toBe(100);
    expect(claude.latencyMsP95).toBe(200);

    expect(gpt.invocationCount).toBe(1);
    expect(gpt.failureCount).toBe(0);
    expect(gpt.estimatedUsd).toBeCloseTo(0.0005, 10);
  });

  it("getCostSummary aggregates total/per-request/per-successful-request cost and provider/model breakdowns", async () => {
    const succeeded = seedExecution({ orgId: ORG_A, state: "succeeded" });
    seedExecution({ orgId: ORG_A, state: "failed" });

    seedSpan({ orgId: ORG_A, executionId: succeeded, spanType: "model", metadataJson: { provider: "anthropic", model: "claude" }, costJson: { estimatedUsd: 0.003 } });
    seedSpan({ orgId: ORG_A, executionId: succeeded, spanType: "model", metadataJson: { provider: "openai", model: "gpt" }, costJson: { estimatedUsd: 0.0005 } });
    // Cost data outside a "model" span still counts toward totalEstimatedUsd
    // (the spec scopes totalEstimatedUsd to "all telemetry cost data", not
    // just model spans) but must never show up in byProvider/byModel, which
    // are model-span-only breakdowns.
    seedSpan({ orgId: ORG_A, executionId: succeeded, spanType: "kernel", costJson: { estimatedUsd: 0.0001 } });

    const summary = await getCostSummary({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });

    expect(summary.totalEstimatedUsd).toBeCloseTo(0.0036, 10);
    expect(summary.costPerRequestUsd).toBeCloseTo(0.0036 / 2, 10);
    expect(summary.costPerSuccessfulRequestUsd).toBeCloseTo(0.0036 / 1, 10);
    expect(summary.byProvider.sort((a, b) => a.provider.localeCompare(b.provider))).toEqual([
      { provider: "anthropic", estimatedUsd: expect.closeTo(0.003, 10) },
      { provider: "openai", estimatedUsd: expect.closeTo(0.0005, 10) },
    ]);
    expect(summary.byModel).toHaveLength(2);
  });

  it("getCostSummary returns null cost-per-request fields when the window has no requests", async () => {
    const summary = await getCostSummary({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(summary.totalEstimatedUsd).toBe(0);
    expect(summary.costPerRequestUsd).toBeNull();
    expect(summary.costPerSuccessfulRequestUsd).toBeNull();
  });

  it("getEventHealth counts events/deliveries/dead-letters and groups dead letters by event type", async () => {
    const jobEvent1 = seedEvent({ orgId: ORG_A, type: "job.created" });
    const jobEvent2 = seedEvent({ orgId: ORG_A, type: "job.created" });
    const invoiceEvent = seedEvent({ orgId: ORG_A, type: "invoice.updated" });

    seedDelivery({ orgId: ORG_A, eventId: jobEvent1, status: "succeeded" });
    seedDelivery({ orgId: ORG_A, eventId: jobEvent1, status: "succeeded" });
    seedDelivery({ orgId: ORG_A, eventId: jobEvent2, status: "succeeded" });
    seedDelivery({ orgId: ORG_A, eventId: jobEvent2, status: "pending" });
    seedDelivery({ orgId: ORG_A, eventId: invoiceEvent, status: "failed" });

    seedDeadLetter({ orgId: ORG_A, eventId: jobEvent1 });
    seedDeadLetter({ orgId: ORG_A, eventId: invoiceEvent });

    const health = await getEventHealth({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });

    expect(health.eventCount).toBe(3);
    expect(health.deliveryCount).toBe(5);
    expect(health.deliverySuccessRate).toBeCloseTo(3 / 5, 10);
    expect(health.pendingRetryCount).toBe(1);
    expect(health.deadLetterCount).toBe(2);
    expect(health.deadLetterCountByType.sort((a, b) => a.type.localeCompare(b.type))).toEqual([
      { type: "invoice.updated", count: 1 },
      { type: "job.created", count: 1 },
    ]);
  });

  it("getEventHealth returns zeroed counts and an empty breakdown for an empty window", async () => {
    const health = await getEventHealth({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(health.eventCount).toBe(0);
    expect(health.deliveryCount).toBe(0);
    expect(health.deliverySuccessRate).toBe(0);
    expect(health.pendingRetryCount).toBe(0);
    expect(health.deadLetterCount).toBe(0);
    expect(health.deadLetterCountByType).toEqual([]);
  });

  it("cross-org isolation: overview/tool/model/cost/event metrics for org A never include org B's data", async () => {
    const orgAExec = seedExecution({ orgId: ORG_A, state: "succeeded", completedAt: t(100) });
    seedSpan({ orgId: ORG_A, executionId: orgAExec, spanType: "action", metadataJson: { toolId: "shared-tool-id" }, costJson: { estimatedUsd: 0.01 } });
    seedSpan({ orgId: ORG_A, executionId: orgAExec, spanType: "model", metadataJson: { provider: "anthropic", model: "claude" }, costJson: { estimatedUsd: 0.01 } });
    const jobEventA = seedEvent({ orgId: ORG_A, type: "job.created" });
    seedDelivery({ orgId: ORG_A, eventId: jobEventA, status: "succeeded" });

    const orgBExec = seedExecution({ orgId: ORG_B, state: "succeeded", completedAt: t(100) });
    seedSpan({ orgId: ORG_B, executionId: orgBExec, spanType: "action", metadataJson: { toolId: "shared-tool-id" }, costJson: { estimatedUsd: 99 } });
    seedSpan({ orgId: ORG_B, executionId: orgBExec, spanType: "model", metadataJson: { provider: "anthropic", model: "claude" }, costJson: { estimatedUsd: 99 } });
    const jobEventB = seedEvent({ orgId: ORG_B, type: "job.created" });
    seedDelivery({ orgId: ORG_B, eventId: jobEventB, status: "failed" });
    seedDeadLetter({ orgId: ORG_B, eventId: jobEventB });

    const overview = await getOverviewMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(overview.requestCount).toBe(1);
    expect(overview.totalCostUsd).toBeCloseTo(0.02, 10);

    const toolMetrics = await getToolMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(toolMetrics).toHaveLength(1);
    expect(toolMetrics[0].invocationCount).toBe(1);

    const modelMetrics = await getModelMetrics({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(modelMetrics).toHaveLength(1);
    expect(modelMetrics[0].estimatedUsd).toBeCloseTo(0.01, 10);

    const costSummary = await getCostSummary({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(costSummary.totalEstimatedUsd).toBeCloseTo(0.02, 10);

    const eventHealth = await getEventHealth({ orgId: ORG_A, from: WINDOW_FROM, to: WINDOW_TO });
    expect(eventHealth.eventCount).toBe(1);
    expect(eventHealth.deliveryCount).toBe(1);
    expect(eventHealth.deliverySuccessRate).toBe(1);
    expect(eventHealth.deadLetterCount).toBe(0);
  });
});
