// Unit coverage for modules/athena-observability/alerts.ts. Follows the
// same DB-mocking convention as tests/cost-database.service.test.ts
// (jest.mock("../db/client", ...) with a hand-rolled mockPrisma) and
// tests/supplier-integration.worker.test.ts (jest.mock("../db/requestSession",
// ...) so runWithBackgroundDatabaseSession just invokes the operation) -
// alerts.ts talks to Prisma directly rather than through a repository
// abstraction, so there is no in-memory fixture to reuse here. The
// metricsService dependency is also mocked so each rule can be exercised
// against a precise, hand-picked window of metrics without needing a real
// Postgres instance.

const mockPrisma = {
  athenaAlert: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  athenaTelemetryRecordRow: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

const runWithBackgroundDatabaseSession = jest.fn((_client: unknown, _input: unknown, operation: () => unknown) => operation());

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: {} }));
jest.mock("../db/requestSession", () => ({ runWithBackgroundDatabaseSession }));
jest.mock("../modules/athena-observability/metricsService", () => ({
  getOverviewMetrics: jest.fn(),
  getToolMetrics: jest.fn(),
  getModelMetrics: jest.fn(),
  getEventHealth: jest.fn(),
}));

import { getEventHealth, getModelMetrics, getOverviewMetrics, getToolMetrics } from "../modules/athena-observability/metricsService";
import { applyAthenaAlertEvaluations, evaluateAthenaAlerts, listAthenaAlerts } from "../modules/athena-observability/alerts";
import type { AthenaAlertEvaluation, AthenaEventHealthSummary, AthenaModelMetric, AthenaOverviewMetrics, AthenaToolMetric } from "../modules/athena-observability/types";

const mockGetOverviewMetrics = getOverviewMetrics as jest.Mock;
const mockGetToolMetrics = getToolMetrics as jest.Mock;
const mockGetModelMetrics = getModelMetrics as jest.Mock;
const mockGetEventHealth = getEventHealth as jest.Mock;

const ORG = "org-1";

function healthyOverview(overrides: Partial<AthenaOverviewMetrics> = {}): AthenaOverviewMetrics {
  return {
    window: { from: "2026-08-10T11:45:00.000Z", to: "2026-08-10T12:00:00.000Z" },
    requestCount: 20,
    successRate: 0.95,
    errorRate: 0.05,
    degradedRate: 0,
    deniedRate: 0,
    latencyMsP50: 100,
    latencyMsP95: 300,
    latencyMsP99: 400,
    totalCostUsd: 1,
    averageTraceCompleteness: 0.95,
    ...overrides,
  };
}

function healthyEventHealth(overrides: Partial<AthenaEventHealthSummary> = {}): AthenaEventHealthSummary {
  return {
    window: { from: "2026-08-10T11:45:00.000Z", to: "2026-08-10T12:00:00.000Z" },
    eventCount: 0,
    deliveryCount: 0,
    deliverySuccessRate: 1,
    pendingRetryCount: 0,
    deadLetterCount: 0,
    deadLetterCountByType: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  runWithBackgroundDatabaseSession.mockImplementation((_client: unknown, _input: unknown, operation: () => unknown) => operation());
  mockPrisma.athenaAlert.findMany.mockResolvedValue([]);
  mockPrisma.athenaTelemetryRecordRow.count.mockResolvedValue(0);
  mockPrisma.athenaTelemetryRecordRow.findMany.mockResolvedValue([]);
  mockGetOverviewMetrics.mockResolvedValue(healthyOverview());
  mockGetToolMetrics.mockResolvedValue([]);
  mockGetModelMetrics.mockResolvedValue([]);
  mockGetEventHealth.mockResolvedValue(healthyEventHealth());
});

describe("listAthenaAlerts", () => {
  it("reshapes rows to AthenaAlertRecord and filters by orgId/status", async () => {
    mockPrisma.athenaAlert.findMany.mockResolvedValue([
      {
        id: "alert-1",
        orgId: ORG,
        ruleId: "athena_error_spike",
        dedupeKey: "athena_error_spike",
        severity: "high",
        status: "active",
        summary: "Error rate over threshold",
        metadataJson: { errorRate: 0.5 },
        firstSeenAt: new Date("2026-08-10T10:00:00.000Z"),
        lastSeenAt: new Date("2026-08-10T11:00:00.000Z"),
        resolvedAt: null,
      },
    ]);

    const result = await listAthenaAlerts({ orgId: ORG, status: "active" });

    expect(mockPrisma.athenaAlert.findMany).toHaveBeenCalledWith({
      where: { orgId: ORG, status: "active" },
      orderBy: { lastSeenAt: "desc" },
    });
    expect(result).toEqual([
      {
        id: "alert-1",
        orgId: ORG,
        ruleId: "athena_error_spike",
        dedupeKey: "athena_error_spike",
        severity: "high",
        status: "active",
        summary: "Error rate over threshold",
        metadata: { errorRate: 0.5 },
        firstSeenAt: "2026-08-10T10:00:00.000Z",
        lastSeenAt: "2026-08-10T11:00:00.000Z",
        resolvedAt: null,
      },
    ]);
  });

  it("omits the status filter when none is given", async () => {
    mockPrisma.athenaAlert.findMany.mockResolvedValue([]);
    await listAthenaAlerts({ orgId: ORG });
    expect(mockPrisma.athenaAlert.findMany).toHaveBeenCalledWith({
      where: { orgId: ORG },
      orderBy: { lastSeenAt: "desc" },
    });
  });
});

describe("evaluateAthenaAlerts", () => {
  it("never emits telemetry_write_failure (documented as not implementable from current signals)", async () => {
    const evaluations = await evaluateAthenaAlerts(ORG);
    expect(evaluations.some((evaluation) => evaluation.ruleId === "telemetry_write_failure")).toBe(false);
  });

  it("fires athena_error_spike when error rate exceeds threshold with enough samples", async () => {
    mockGetOverviewMetrics.mockResolvedValue(healthyOverview({ requestCount: 20, errorRate: 0.5 }));
    const evaluations = await evaluateAthenaAlerts(ORG);
    const evaluation = evaluations.find((e) => e.ruleId === "athena_error_spike");
    expect(evaluation?.firing).toBe(true);
    expect(evaluation?.dedupeKey).toBe("athena_error_spike");
  });

  it("does not fire athena_error_spike below the minimum sample size even at 100% error rate", async () => {
    mockGetOverviewMetrics.mockResolvedValue(healthyOverview({ requestCount: 2, errorRate: 1 }));
    const evaluations = await evaluateAthenaAlerts(ORG);
    const evaluation = evaluations.find((e) => e.ruleId === "athena_error_spike");
    expect(evaluation?.firing).toBe(false);
  });

  it("fires tool_failure_spike per over-threshold tool with a dedupeKey scoped to that tool", async () => {
    const tools: AthenaToolMetric[] = [
      { toolId: "tradeos.estimate.prepareDraft", invocationCount: 10, successCount: 4, failureCount: 6, successRate: 0.4, latencyMsP50: 10, latencyMsP95: 20 },
      { toolId: "tradeos.estimate.healthy", invocationCount: 10, successCount: 10, failureCount: 0, successRate: 1, latencyMsP50: 10, latencyMsP95: 20 },
    ];
    mockGetToolMetrics.mockResolvedValue(tools);

    const evaluations = await evaluateAthenaAlerts(ORG);
    const failing = evaluations.find((e) => e.dedupeKey === "tool_failure_spike:tradeos.estimate.prepareDraft");
    const healthy = evaluations.find((e) => e.dedupeKey === "tool_failure_spike:tradeos.estimate.healthy");
    expect(failing?.firing).toBe(true);
    expect(healthy?.firing).toBe(false);
  });

  it("resolves a tool_failure_spike alert whose tool is no longer observed in the window", async () => {
    mockGetToolMetrics.mockResolvedValue([]);
    mockPrisma.athenaAlert.findMany.mockImplementation(({ where }: { where: { ruleId: string } }) => {
      if (where.ruleId === "tool_failure_spike") {
        return Promise.resolve([{ dedupeKey: "tool_failure_spike:gone-tool" }]);
      }
      return Promise.resolve([]);
    });

    const evaluations = await evaluateAthenaAlerts(ORG);
    const stale = evaluations.find((e) => e.dedupeKey === "tool_failure_spike:gone-tool");
    expect(stale?.firing).toBe(false);
  });

  it("fires provider_failure_spike per over-threshold provider/model pair", async () => {
    const models: AthenaModelMetric[] = [
      { provider: "fake", model: "fake-1", invocationCount: 10, failureCount: 8, inputTokens: 0, outputTokens: 0, estimatedUsd: 0, latencyMsP50: 1, latencyMsP95: 2 },
    ];
    mockGetModelMetrics.mockResolvedValue(models);
    const evaluations = await evaluateAthenaAlerts(ORG);
    const evaluation = evaluations.find((e) => e.dedupeKey === "provider_failure_spike:fake:fake-1");
    expect(evaluation?.firing).toBe(true);
  });

  it("fires latency_regression when p95 exceeds threshold", async () => {
    mockGetOverviewMetrics.mockResolvedValue(healthyOverview({ requestCount: 10, latencyMsP95: 999999 }));
    const evaluations = await evaluateAthenaAlerts(ORG);
    expect(evaluations.find((e) => e.ruleId === "latency_regression")?.firing).toBe(true);
  });

  it("fires trace_completeness_drop when average completeness is below threshold", async () => {
    mockGetOverviewMetrics.mockResolvedValue(healthyOverview({ requestCount: 10, averageTraceCompleteness: 0.1 }));
    const evaluations = await evaluateAthenaAlerts(ORG);
    expect(evaluations.find((e) => e.ruleId === "trace_completeness_drop")?.firing).toBe(true);
  });

  it("fires event_dlq_growth on dead-letter count or pending-retry count", async () => {
    mockGetEventHealth.mockResolvedValue(healthyEventHealth({ deadLetterCount: 999 }));
    const evaluations = await evaluateAthenaAlerts(ORG);
    expect(evaluations.find((e) => e.ruleId === "event_dlq_growth")?.firing).toBe(true);
  });

  it("fires cost_spike when total cost exceeds threshold", async () => {
    mockGetOverviewMetrics.mockResolvedValue(healthyOverview({ totalCostUsd: 999999 }));
    const evaluations = await evaluateAthenaAlerts(ORG);
    expect(evaluations.find((e) => e.ruleId === "cost_spike")?.firing).toBe(true);
  });

  it("fires unauthorized_execution when denied approval spans exceed threshold", async () => {
    mockPrisma.athenaTelemetryRecordRow.count.mockResolvedValue(999);
    const evaluations = await evaluateAthenaAlerts(ORG);
    expect(evaluations.find((e) => e.ruleId === "unauthorized_execution")?.firing).toBe(true);
  });

  it("does not fire approval_bypass_attempt when every action span has a matching allowed approval span", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    mockPrisma.athenaTelemetryRecordRow.findMany.mockImplementation(({ where }: { where: { spanType: string } }) => {
      if (where.spanType === "action") {
        return Promise.resolve([{ id: "span-action-1", executionId: "exec-1", metadataJson: { stepId: "step-1" }, createdAt: now }]);
      }
      return Promise.resolve([{ executionId: "exec-1", metadataJson: { stepId: "step-1", decision: "allow" }, createdAt: new Date(now.getTime() - 1000) }]);
    });
    const evaluations = await evaluateAthenaAlerts(ORG, now);
    expect(evaluations.find((e) => e.ruleId === "approval_bypass_attempt")?.firing).toBe(false);
  });

  it("flags approval_bypass_attempt when an action span has no matching authorizing approval span", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    mockPrisma.athenaTelemetryRecordRow.findMany.mockImplementation(({ where }: { where: { spanType: string } }) => {
      if (where.spanType === "action") {
        return Promise.resolve([{ id: "span-action-1", executionId: "exec-1", metadataJson: { stepId: "step-1" }, createdAt: now }]);
      }
      return Promise.resolve([]); // no approval span at all for this execution/stepId
    });
    const evaluations = await evaluateAthenaAlerts(ORG, now);
    const evaluation = evaluations.find((e) => e.ruleId === "approval_bypass_attempt");
    expect(evaluation?.firing).toBe(true);
    expect(evaluation?.metadata.suspectCount).toBe(1);
  });

  it("skips action spans with no stepId in metadata rather than treating them as suspects (documented gap)", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    mockPrisma.athenaTelemetryRecordRow.findMany.mockImplementation(({ where }: { where: { spanType: string } }) => {
      if (where.spanType === "action") {
        return Promise.resolve([{ id: "span-action-1", executionId: "exec-1", metadataJson: {}, createdAt: now }]);
      }
      return Promise.resolve([]);
    });
    const evaluations = await evaluateAthenaAlerts(ORG, now);
    expect(evaluations.find((e) => e.ruleId === "approval_bypass_attempt")?.firing).toBe(false);
  });
});

describe("applyAthenaAlertEvaluations", () => {
  function firingEvaluation(overrides: Partial<AthenaAlertEvaluation> = {}): AthenaAlertEvaluation {
    return {
      ruleId: "athena_error_spike",
      dedupeKey: "athena_error_spike",
      firing: true,
      severity: "high",
      summary: "Error rate over threshold",
      metadata: { errorRate: 0.5 },
      ...overrides,
    };
  }

  it("creates a new active alert the first time a rule fires", async () => {
    mockPrisma.athenaAlert.findUnique.mockResolvedValueOnce(null);
    mockPrisma.athenaAlert.upsert.mockResolvedValueOnce({
      id: "alert-1",
      orgId: ORG,
      ruleId: "athena_error_spike",
      dedupeKey: "athena_error_spike",
      severity: "high",
      status: "active",
      summary: "Error rate over threshold",
      metadataJson: { errorRate: 0.5 },
      firstSeenAt: new Date("2026-08-10T12:00:00.000Z"),
      lastSeenAt: new Date("2026-08-10T12:00:00.000Z"),
      resolvedAt: null,
    });

    const result = await applyAthenaAlertEvaluations(ORG, "user-1", [firingEvaluation()]);

    expect(runWithBackgroundDatabaseSession).toHaveBeenCalledWith(
      {},
      { jobName: "athena-observability-alerts-apply", orgId: ORG, userId: "user-1" },
      expect.any(Function)
    );
    expect(mockPrisma.athenaAlert.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.athenaAlert.update).not.toHaveBeenCalled();
    expect(result[0].status).toBe("active");
  });

  it("deduplicates: evaluating 'firing' twice does not create two rows, and only bumps lastSeenAt (not firstSeenAt)", async () => {
    const firstSeen = new Date("2026-08-10T10:00:00.000Z");
    const secondSeen = new Date("2026-08-10T12:00:00.000Z");

    // Second evaluation cycle: the alert is already active from a prior run.
    mockPrisma.athenaAlert.findUnique.mockResolvedValueOnce({
      id: "alert-1",
      orgId: ORG,
      ruleId: "athena_error_spike",
      dedupeKey: "athena_error_spike",
      severity: "high",
      status: "active",
      summary: "Error rate over threshold",
      metadataJson: { errorRate: 0.5 },
      firstSeenAt: firstSeen,
      lastSeenAt: firstSeen,
      resolvedAt: null,
    });
    mockPrisma.athenaAlert.update.mockResolvedValueOnce({
      id: "alert-1",
      orgId: ORG,
      ruleId: "athena_error_spike",
      dedupeKey: "athena_error_spike",
      severity: "high",
      status: "active",
      summary: "Error rate over threshold",
      metadataJson: { errorRate: 0.6 },
      firstSeenAt: firstSeen, // unchanged
      lastSeenAt: secondSeen,
      resolvedAt: null,
    });

    const result = await applyAthenaAlertEvaluations(ORG, "user-1", [firingEvaluation({ metadata: { errorRate: 0.6 } })]);

    expect(mockPrisma.athenaAlert.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.athenaAlert.update).toHaveBeenCalledTimes(1);
    const updateCall = mockPrisma.athenaAlert.update.mock.calls[0][0];
    expect(updateCall.data).toEqual({ lastSeenAt: expect.any(Date), metadataJson: { errorRate: 0.6 } });
    expect(updateCall.data.firstSeenAt).toBeUndefined();
    expect(result[0].firstSeenAt).toBe(firstSeen.toISOString());
    expect(result[0].lastSeenAt).toBe(secondSeen.toISOString());
  });

  it("resolves an active alert when the rule stops firing, setting resolvedAt", async () => {
    const firstSeen = new Date("2026-08-10T10:00:00.000Z");
    mockPrisma.athenaAlert.findUnique.mockResolvedValueOnce({
      id: "alert-1",
      orgId: ORG,
      ruleId: "athena_error_spike",
      dedupeKey: "athena_error_spike",
      severity: "high",
      status: "active",
      summary: "Error rate over threshold",
      metadataJson: {},
      firstSeenAt: firstSeen,
      lastSeenAt: firstSeen,
      resolvedAt: null,
    });
    const resolvedAt = new Date("2026-08-10T13:00:00.000Z");
    mockPrisma.athenaAlert.update.mockResolvedValueOnce({
      id: "alert-1",
      orgId: ORG,
      ruleId: "athena_error_spike",
      dedupeKey: "athena_error_spike",
      severity: "high",
      status: "resolved",
      summary: "Error rate over threshold",
      metadataJson: {},
      firstSeenAt: firstSeen,
      lastSeenAt: firstSeen,
      resolvedAt,
    });

    const result = await applyAthenaAlertEvaluations(ORG, "user-1", [firingEvaluation({ firing: false, summary: "Error rate within threshold" })]);

    expect(mockPrisma.athenaAlert.update).toHaveBeenCalledWith({
      where: { orgId_dedupeKey: { orgId: ORG, dedupeKey: "athena_error_spike" } },
      data: { status: "resolved", resolvedAt: expect.any(Date) },
    });
    expect(result[0].status).toBe("resolved");
    expect(result[0].resolvedAt).toBe(resolvedAt.toISOString());
  });

  it("no-ops when a rule that never fired stays not-firing (no write at all)", async () => {
    mockPrisma.athenaAlert.findUnique.mockResolvedValueOnce(null);

    const result = await applyAthenaAlertEvaluations(ORG, "user-1", [firingEvaluation({ firing: false })]);

    expect(mockPrisma.athenaAlert.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.athenaAlert.update).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
