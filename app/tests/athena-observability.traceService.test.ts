import { createFakeModel, type FakeRow } from "./helpers/fakeAthenaObservabilityDb";

const executions: FakeRow[] = [];
const transitions: FakeRow[] = [];
const telemetry: FakeRow[] = [];

const fakePrisma = {
  athenaExecution: createFakeModel(executions),
  athenaExecutionTransition: createFakeModel(transitions),
  athenaTelemetryRecordRow: createFakeModel(telemetry),
};

jest.mock("../db/client", () => ({ prisma: fakePrisma }));

import { getTrace, getTraceByRequest, searchTraces } from "../modules/athena-observability/traceService";

const ORG_A = "org-a";
const ORG_B = "org-b";

function seedExecution(overrides: Partial<FakeRow> & { id: string; orgId: string }): FakeRow {
  const row: FakeRow = {
    id: overrides.id,
    orgId: overrides.orgId,
    requestId: overrides.requestId ?? `req-${overrides.id}`,
    traceId: overrides.traceId ?? `trace-${overrides.id}`,
    actorUserId: overrides.actorUserId ?? "user-1",
    canonicalRole: overrides.canonicalRole ?? "owner",
    requestSource: overrides.requestSource ?? "http",
    state: overrides.state ?? "succeeded",
    roundTrips: overrides.roundTrips ?? 0,
    safeSummary: overrides.safeSummary ?? "ok",
    safeErrorCode: overrides.safeErrorCode ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-08-10T00:00:00.000Z"),
    completedAt: overrides.completedAt ?? new Date("2026-08-10T00:00:01.000Z"),
  };
  executions.push(row);
  return row;
}

function seedTransition(overrides: Partial<FakeRow> & { executionId: string; orgId: string; toState: string }): void {
  transitions.push({
    id: `transition-${transitions.length}`,
    orgId: overrides.orgId,
    executionId: overrides.executionId,
    fromState: overrides.fromState ?? null,
    toState: overrides.toState,
    reasonCode: overrides.reasonCode ?? "reason",
    createdAt: overrides.createdAt ?? new Date("2026-08-10T00:00:00.000Z"),
  });
}

let spanCounter = 0;
function seedSpan(overrides: Partial<FakeRow> & { orgId: string; executionId: string; traceId: string; spanType: string }): void {
  spanCounter += 1;
  telemetry.push({
    id: `span-${spanCounter}`,
    orgId: overrides.orgId,
    executionId: overrides.executionId,
    requestId: overrides.requestId ?? `req-${overrides.executionId}`,
    traceId: overrides.traceId,
    spanType: overrides.spanType,
    status: overrides.status ?? "ok",
    durationMs: overrides.durationMs ?? 10,
    redaction: overrides.redaction ?? "metadata_only",
    costJson: overrides.costJson ?? null,
    metadataJson: overrides.metadataJson ?? {},
    createdAt: overrides.createdAt ?? new Date("2026-08-10T00:00:00.000Z"),
  });
}

describe("athena-observability traceService", () => {
  beforeEach(() => {
    executions.length = 0;
    transitions.length = 0;
    telemetry.length = 0;
    spanCounter = 0;
    jest.clearAllMocks();
  });

  it("getTrace returns null when no execution matches the (orgId, traceId) pair", async () => {
    seedExecution({ id: "exec-1", orgId: ORG_A, traceId: "trace-1" });
    const result = await getTrace(ORG_A, "trace-does-not-exist");
    expect(result).toBeNull();
  });

  it("getTrace reshapes the execution, transitions, and spans, and computes completeness", async () => {
    seedExecution({
      id: "exec-1",
      orgId: ORG_A,
      traceId: "trace-1",
      requestId: "req-1",
      state: "succeeded",
      createdAt: new Date("2026-08-10T00:00:00.000Z"),
      completedAt: new Date("2026-08-10T00:00:00.500Z"),
    });
    seedTransition({ orgId: ORG_A, executionId: "exec-1", fromState: null, toState: "created", reasonCode: "execution_created", createdAt: new Date("2026-08-10T00:00:00.000Z") });
    seedTransition({ orgId: ORG_A, executionId: "exec-1", fromState: "created", toState: "succeeded", reasonCode: "kernel_succeeded", createdAt: new Date("2026-08-10T00:00:00.400Z") });

    // A full "succeeded" trace per completeness.ts: kernel + context always
    // required, approval required for succeeded/denied, model required for
    // succeeded. None of these spans carry a stepId, so "action" is not
    // required.
    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-1", spanType: "context", status: "ok", durationMs: 20, createdAt: new Date("2026-08-10T00:00:00.100Z") });
    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-1", spanType: "approval", status: "ok", durationMs: 15, metadataJson: { planId: "plan-1", intent: "estimate" }, createdAt: new Date("2026-08-10T00:00:00.200Z") });
    seedSpan({
      orgId: ORG_A,
      executionId: "exec-1",
      traceId: "trace-1",
      spanType: "model",
      status: "ok",
      durationMs: 300,
      metadataJson: { provider: "anthropic", model: "claude" },
      costJson: { inputTokens: 100, outputTokens: 50, estimatedUsd: 0.02 },
      createdAt: new Date("2026-08-10T00:00:00.300Z"),
    });
    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-1", spanType: "kernel", status: "ok", durationMs: 5, createdAt: new Date("2026-08-10T00:00:00.400Z") });

    const result = await getTrace(ORG_A, "trace-1");
    expect(result).not.toBeNull();
    expect(result!.execution).toEqual({
      executionId: "exec-1",
      orgId: ORG_A,
      requestId: "req-1",
      traceId: "trace-1",
      actorUserId: "user-1",
      canonicalRole: "owner",
      requestSource: "http",
      state: "succeeded",
      roundTrips: 0,
      safeSummary: "ok",
      safeErrorCode: null,
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      completedAt: "2026-08-10T00:00:00.500Z",
    });

    expect(result!.transitions).toHaveLength(2);
    expect(result!.transitions[0]).toEqual({ fromState: null, toState: "created", reasonCode: "execution_created", createdAt: "2026-08-10T00:00:00.000Z" });

    expect(result!.spans).toHaveLength(4);
    // Ordered ascending by createdAt.
    expect(result!.spans.map((span) => span.spanType)).toEqual(["context", "approval", "model", "kernel"]);
    const modelSpan = result!.spans.find((span) => span.spanType === "model")!;
    expect(modelSpan.cost).toEqual({ inputTokens: 100, outputTokens: 50, estimatedUsd: 0.02 });
    expect(modelSpan.metadata).toEqual({ provider: "anthropic", model: "claude" });

    expect(result!.completeness.expectedSpanTypes.sort()).toEqual(["approval", "context", "kernel", "model"].sort());
    expect(result!.completeness.missingSpanTypes).toEqual([]);
    expect(result!.completeness.score).toBe(1);
  });

  it("getTraceByRequest looks up by (orgId, requestId) and returns null for an unknown requestId", async () => {
    seedExecution({ id: "exec-1", orgId: ORG_A, traceId: "trace-1", requestId: "req-1" });
    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-1", spanType: "kernel" });

    const found = await getTraceByRequest(ORG_A, "req-1");
    expect(found?.execution.executionId).toBe("exec-1");

    const missing = await getTraceByRequest(ORG_A, "req-does-not-exist");
    expect(missing).toBeNull();
  });

  it("cross-org isolation: a trace never resolves under the wrong orgId, even with the right traceId/requestId", async () => {
    seedExecution({ id: "exec-a", orgId: ORG_A, traceId: "trace-shared-name", requestId: "req-shared-name" });
    seedExecution({ id: "exec-b", orgId: ORG_B, traceId: "trace-b-only", requestId: "req-b-only" });

    expect(await getTrace(ORG_B, "trace-shared-name")).toBeNull();
    expect(await getTraceByRequest(ORG_B, "req-shared-name")).toBeNull();

    const crossOrgSearch = await searchTraces({ orgId: ORG_B, traceId: "trace-shared-name" });
    expect(crossOrgSearch.rows).toEqual([]);

    // Sanity check: the same lookups succeed for the owning org.
    expect(await getTrace(ORG_A, "trace-shared-name")).not.toBeNull();
  });

  it("searchTraces respects a bounded page size and paginates via cursor", async () => {
    seedExecution({ id: "exec-1", orgId: ORG_A, createdAt: new Date("2026-08-10T00:00:01.000Z") });
    seedExecution({ id: "exec-2", orgId: ORG_A, createdAt: new Date("2026-08-10T00:00:02.000Z") });
    seedExecution({ id: "exec-3", orgId: ORG_A, createdAt: new Date("2026-08-10T00:00:03.000Z") });

    const firstPage = await searchTraces({ orgId: ORG_A, limit: 2 });
    expect(firstPage.rows.map((row) => row.execution.executionId)).toEqual(["exec-3", "exec-2"]);
    expect(firstPage.nextCursor).toBe("exec-2");

    const secondPage = await searchTraces({ orgId: ORG_A, limit: 2, cursor: firstPage.nextCursor! });
    expect(secondPage.rows.map((row) => row.execution.executionId)).toEqual(["exec-1"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("searchTraces clamps an out-of-range limit to the documented max", async () => {
    // Seed more rows than the documented max (200) so the clamp actually
    // has an effect to observe here: with fewer rows than the max, this
    // test would still pass even if clampSearchLimit were deleted entirely.
    const seededCount = 205;
    for (let i = 0; i < seededCount; i += 1) {
      seedExecution({ id: `exec-${i}`, orgId: ORG_A, createdAt: new Date(2026, 7, 10, 0, 0, 0, i) });
    }
    const result = await searchTraces({ orgId: ORG_A, limit: 10_000 });
    expect(result.rows).toHaveLength(200);
    expect(result.nextCursor).not.toBeNull();
  });

  it("searchTraces filters by toolId (action span metadata), scoped to orgId", async () => {
    seedExecution({ id: "exec-a1", orgId: ORG_A, traceId: "trace-a1" });
    seedExecution({ id: "exec-a2", orgId: ORG_A, traceId: "trace-a2" });
    seedExecution({ id: "exec-b1", orgId: ORG_B, traceId: "trace-b1" });

    seedSpan({ orgId: ORG_A, executionId: "exec-a1", traceId: "trace-a1", spanType: "action", metadataJson: { toolId: "tradeos.estimate.prepareDraft" } });
    seedSpan({ orgId: ORG_A, executionId: "exec-a2", traceId: "trace-a2", spanType: "action", metadataJson: { toolId: "tradeos.job.schedule" } });
    // Same toolId, but a different org - must never leak into org A's results.
    seedSpan({ orgId: ORG_B, executionId: "exec-b1", traceId: "trace-b1", spanType: "action", metadataJson: { toolId: "tradeos.estimate.prepareDraft" } });

    const result = await searchTraces({ orgId: ORG_A, toolId: "tradeos.estimate.prepareDraft" });
    expect(result.rows.map((row) => row.execution.executionId)).toEqual(["exec-a1"]);
  });

  it("searchTraces filters by model and provider (model span metadata) independently and combined", async () => {
    seedExecution({ id: "exec-1", orgId: ORG_A });
    seedExecution({ id: "exec-2", orgId: ORG_A });
    seedExecution({ id: "exec-3", orgId: ORG_A });

    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-exec-1", spanType: "model", metadataJson: { provider: "anthropic", model: "claude" } });
    seedSpan({ orgId: ORG_A, executionId: "exec-2", traceId: "trace-exec-2", spanType: "model", metadataJson: { provider: "anthropic", model: "haiku" } });
    seedSpan({ orgId: ORG_A, executionId: "exec-3", traceId: "trace-exec-3", spanType: "model", metadataJson: { provider: "openai", model: "gpt-4" } });

    const byProvider = await searchTraces({ orgId: ORG_A, provider: "anthropic" });
    expect(byProvider.rows.map((row) => row.execution.executionId).sort()).toEqual(["exec-1", "exec-2"]);

    const byModel = await searchTraces({ orgId: ORG_A, model: "claude" });
    expect(byModel.rows.map((row) => row.execution.executionId)).toEqual(["exec-1"]);

    const byBoth = await searchTraces({ orgId: ORG_A, provider: "anthropic", model: "haiku" });
    expect(byBoth.rows.map((row) => row.execution.executionId)).toEqual(["exec-2"]);

    const noMatch = await searchTraces({ orgId: ORG_A, provider: "openai", model: "claude" });
    expect(noMatch.rows).toEqual([]);
  });

  it("searchTraces computes spanCount, errorSpanCount, and totalCostUsd per row via a single grouped query", async () => {
    seedExecution({ id: "exec-1", orgId: ORG_A });
    seedExecution({ id: "exec-2", orgId: ORG_A });

    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-exec-1", spanType: "kernel", status: "ok" });
    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-exec-1", spanType: "action", status: "error" });
    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-exec-1", spanType: "model", status: "ok", costJson: { estimatedUsd: 0.01 } });
    seedSpan({ orgId: ORG_A, executionId: "exec-1", traceId: "trace-exec-1", spanType: "model", status: "ok", costJson: { estimatedUsd: 0.02 } });
    // exec-2 has no telemetry at all.

    const result = await searchTraces({ orgId: ORG_A });
    const row1 = result.rows.find((row) => row.execution.executionId === "exec-1")!;
    const row2 = result.rows.find((row) => row.execution.executionId === "exec-2")!;

    expect(row1.spanCount).toBe(4);
    expect(row1.errorSpanCount).toBe(1);
    expect(row1.totalCostUsd).toBeCloseTo(0.03, 10);

    expect(row2.spanCount).toBe(0);
    expect(row2.errorSpanCount).toBe(0);
    expect(row2.totalCostUsd).toBeNull();
  });
});
