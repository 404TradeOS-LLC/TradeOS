// Unit coverage for modules/athena-observability/retention.ts. Same
// DB-mocking convention as the other athena-observability.*.test.ts files.

const mockPrisma = {
  athenaTelemetryRecordRow: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  athenaExecution: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  athenaGenerationRun: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const runWithBackgroundDatabaseSession = jest.fn((_client: unknown, _input: unknown, operation: () => unknown) => operation());

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: {} }));
jest.mock("../db/requestSession", () => ({ runWithBackgroundDatabaseSession }));

import { runAthenaObservabilityRetention } from "../modules/athena-observability/retention";

const ORG_A = "org-a";
const ORG_B = "org-b";

beforeEach(() => {
  jest.clearAllMocks();
  runWithBackgroundDatabaseSession.mockImplementation((_client: unknown, _input: unknown, operation: () => unknown) => operation());
  mockPrisma.athenaTelemetryRecordRow.findMany.mockResolvedValue([]);
  mockPrisma.athenaTelemetryRecordRow.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.athenaExecution.findMany.mockResolvedValue([]);
  mockPrisma.athenaExecution.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.athenaGenerationRun.findMany.mockResolvedValue([]);
  mockPrisma.athenaGenerationRun.deleteMany.mockResolvedValue({ count: 0 });
});

describe("runAthenaObservabilityRetention", () => {
  it("rejects misconfiguration where executions retain for less time than telemetry, before opening a session", async () => {
    await expect(
      runAthenaObservabilityRetention({ orgId: ORG_A, userId: "user-1", telemetryRetentionDays: 90, executionRetentionDays: 30 })
    ).rejects.toThrow(/must be >=/);
    expect(runWithBackgroundDatabaseSession).not.toHaveBeenCalled();
  });

  it("rejects a non-positive retention window", async () => {
    await expect(runAthenaObservabilityRetention({ orgId: ORG_A, userId: "user-1", telemetryRetentionDays: 0 })).rejects.toThrow(/positive/);
  });

  it("deletes old telemetry records and old executions in bounded batches, reporting scannedBatches/deletedCount/cutoff per table", async () => {
    // Telemetry: two batches of batchSize (2), then a final short batch -> loop stops.
    mockPrisma.athenaTelemetryRecordRow.findMany
      .mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }])
      .mockResolvedValueOnce([{ id: "t3" }]);
    mockPrisma.athenaTelemetryRecordRow.deleteMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 1 });

    mockPrisma.athenaExecution.findMany.mockResolvedValueOnce([{ id: "e1" }]);
    mockPrisma.athenaExecution.deleteMany.mockResolvedValueOnce({ count: 1 });

    const results = await runAthenaObservabilityRetention({ orgId: ORG_A, userId: "user-1", batchSize: 2, now: new Date("2026-08-10T12:00:00.000Z") });

    expect(runWithBackgroundDatabaseSession).toHaveBeenCalledWith(
      {},
      { jobName: "athena-observability-retention", orgId: ORG_A, userId: "user-1" },
      expect.any(Function)
    );

    const telemetryResult = results.find((r) => r.table === "athena_telemetry_records");
    expect(telemetryResult).toEqual({ table: "athena_telemetry_records", scannedBatches: 2, deletedCount: 3, cutoff: expect.any(String) });

    const executionResult = results.find((r) => r.table === "athena_executions");
    expect(executionResult).toEqual({ table: "athena_executions", scannedBatches: 1, deletedCount: 1, cutoff: expect.any(String) });

    // Default execution retention (400d) must produce a strictly earlier
    // cutoff than default telemetry retention (90d) for the same `now`.
    expect(new Date(executionResult!.cutoff).getTime()).toBeLessThan(new Date(telemetryResult!.cutoff).getTime());
  });

  it("deletes expired generation metadata in bounded organization-scoped batches", async () => {
    mockPrisma.athenaGenerationRun.findMany
      .mockResolvedValueOnce([{ id: "g1" }, { id: "g2" }])
      .mockResolvedValueOnce([{ id: "g3" }])
      .mockResolvedValueOnce([]);
    mockPrisma.athenaGenerationRun.deleteMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const now = new Date("2026-08-10T12:00:00.000Z");
    const results = await runAthenaObservabilityRetention({ orgId: ORG_A, userId: "user-1", batchSize: 2, now });

    const generationResult = results.find((result) => result.table === "athena_generation_runs");
    expect(generationResult).toEqual({
      table: "athena_generation_runs",
      scannedBatches: 3,
      deletedCount: 3,
      cutoff: now.toISOString(),
    });
    expect(mockPrisma.athenaGenerationRun.findMany).toHaveBeenNthCalledWith(1, {
      where: { orgId: ORG_A, retentionExpiresAt: { lt: now } },
      orderBy: [{ retentionExpiresAt: "asc" }, { id: "asc" }],
      take: 2,
      select: { id: true },
    });
    expect(mockPrisma.athenaGenerationRun.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { orgId: ORG_A, id: { in: ["g1", "g2"] } },
    });
    expect(mockPrisma.athenaGenerationRun.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { orgId: ORG_A, id: { in: ["g3"] } },
    });
  });

  it("is idempotent: running again after everything old is already deleted deletes nothing", async () => {
    mockPrisma.athenaTelemetryRecordRow.findMany.mockResolvedValue([]);
    mockPrisma.athenaExecution.findMany.mockResolvedValue([]);

    const results = await runAthenaObservabilityRetention({ orgId: ORG_A, userId: "user-1", batchSize: 500 });

    for (const result of results) {
      expect(result.deletedCount).toBe(0);
      expect(result.scannedBatches).toBe(1);
    }
    expect(mockPrisma.athenaTelemetryRecordRow.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.athenaExecution.deleteMany).not.toHaveBeenCalled();
  });

  it("never scopes a query to another org's id, even when called back-to-back for two orgs", async () => {
    await runAthenaObservabilityRetention({ orgId: ORG_A, userId: "user-1" });
    await runAthenaObservabilityRetention({ orgId: ORG_B, userId: "user-2" });

    const telemetryWhereClauses = mockPrisma.athenaTelemetryRecordRow.findMany.mock.calls.map((call) => call[0].where);
    const executionWhereClauses = mockPrisma.athenaExecution.findMany.mock.calls.map((call) => call[0].where);

    expect(telemetryWhereClauses.every((where) => where.orgId === ORG_A || where.orgId === ORG_B)).toBe(true);
    expect(executionWhereClauses.every((where) => where.orgId === ORG_A || where.orgId === ORG_B)).toBe(true);
    // No call for org-a's pass ever carries org-b's id or vice versa.
    expect(telemetryWhereClauses.filter((where) => where.orgId === ORG_A)).toHaveLength(1);
    expect(telemetryWhereClauses.filter((where) => where.orgId === ORG_B)).toHaveLength(1);
  });

  it("scopes deleteMany to only the ids returned by the matching findMany batch (never a broader delete)", async () => {
    mockPrisma.athenaTelemetryRecordRow.findMany.mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }]).mockResolvedValueOnce([]);
    mockPrisma.athenaTelemetryRecordRow.deleteMany.mockResolvedValueOnce({ count: 2 });
    mockPrisma.athenaExecution.findMany.mockResolvedValueOnce([]);

    await runAthenaObservabilityRetention({ orgId: ORG_A, userId: "user-1", batchSize: 2 });

    expect(mockPrisma.athenaTelemetryRecordRow.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["t1", "t2"] } } });
  });
});
