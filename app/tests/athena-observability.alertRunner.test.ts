// Unit coverage for modules/athena-observability/alertRunner.ts: the
// evaluate -> apply -> deliver pipeline runs per job, a hard per-job error
// is isolated to that job, and email delivery is best-effort (failures
// recorded, never thrown). The database session, the rules engine, and the
// email delivery are all mocked; the orchestration is what is under test.

const runWithBackgroundDatabaseSession = jest.fn((_client: unknown, _input: unknown, operation: () => unknown) => operation());
const mockEvaluateAthenaAlerts = jest.fn();
const mockApplyAthenaAlertEvaluations = jest.fn();
const mockDeliverAthenaAlertEmails = jest.fn();
const mockResolveAlertEmailRecipient = jest.fn();

jest.mock("../db/client", () => ({ basePrisma: {} }));
jest.mock("../db/requestSession", () => ({ runWithBackgroundDatabaseSession }));
jest.mock("../modules/athena-observability/alerts", () => ({
  evaluateAthenaAlerts: mockEvaluateAthenaAlerts,
  applyAthenaAlertEvaluations: mockApplyAthenaAlertEvaluations,
}));
jest.mock("../modules/athena-observability/alertEmail", () => ({
  deliverAthenaAlertEmails: mockDeliverAthenaAlertEmails,
  resolveAlertEmailRecipient: mockResolveAlertEmailRecipient,
}));

import { runAthenaAlertJobs } from "../modules/athena-observability/alertRunner";
import type { AthenaAlertRecord } from "../modules/athena-observability/types";

const ORG = "org-1";
const USER = "user-1";
const RECIPIENT = "hello@404tradeos.com";

function alertRecord(overrides: Partial<AthenaAlertRecord> = {}): AthenaAlertRecord {
  return {
    id: "alert-1",
    orgId: ORG,
    ruleId: "daily_spend_cap_reached",
    dedupeKey: "daily_spend_cap_reached",
    severity: "high",
    status: "active",
    summary: "Daily spend cap of $1.00 reached",
    metadata: {},
    firstSeenAt: "2026-11-27T07:00:00.000Z",
    lastSeenAt: "2026-11-27T07:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  runWithBackgroundDatabaseSession.mockImplementation((_client: unknown, _input: unknown, operation: () => unknown) => operation());
  mockResolveAlertEmailRecipient.mockReturnValue(RECIPIENT);
  mockEvaluateAthenaAlerts.mockResolvedValue([]);
  mockApplyAthenaAlertEvaluations.mockResolvedValue([]);
  mockDeliverAthenaAlertEmails.mockResolvedValue({ emailed: 0, skipped: 0, failures: [] });
});

describe("runAthenaAlertJobs", () => {
  it("evaluates, applies, and delivers per job and aggregates the run", async () => {
    const applied = [
      alertRecord(),
      alertRecord({ id: "alert-2", dedupeKey: "cost_spike", ruleId: "cost_spike", status: "resolved", resolvedAt: "2026-11-27T07:00:00.000Z" }),
    ];
    mockApplyAthenaAlertEvaluations.mockResolvedValue(applied);
    mockDeliverAthenaAlertEmails.mockResolvedValue({ emailed: 2, skipped: 0, failures: [] });

    const run = await runAthenaAlertJobs([{ orgId: ORG, userId: USER }]);

    expect(run.recipient).toBe(RECIPIENT);
    expect(run.jobs).toHaveLength(1);
    expect(run.jobs[0]).toMatchObject({ orgId: ORG, firing: 1, resolved: 1, emailed: 2, recipientConfigured: true });
    expect(run.jobs[0].applied).toEqual(applied);
    expect(mockEvaluateAthenaAlerts).toHaveBeenCalledWith(ORG);
    expect(mockApplyAthenaAlertEvaluations).toHaveBeenCalledWith(ORG, USER, []);
    expect(mockDeliverAthenaAlertEmails).toHaveBeenCalledWith({
      orgId: ORG,
      recipient: RECIPIENT,
      alerts: applied,
      emailService: undefined,
    });
  });

  it("skips delivery when no recipient is configured but still evaluates and applies", async () => {
    mockResolveAlertEmailRecipient.mockReturnValue(null);
    mockApplyAthenaAlertEvaluations.mockResolvedValue([alertRecord()]);

    const run = await runAthenaAlertJobs([{ orgId: ORG, userId: USER }]);

    expect(run.recipient).toBeNull();
    expect(run.jobs[0]).toMatchObject({ firing: 1, emailed: 0, recipientConfigured: false });
    expect(mockDeliverAthenaAlertEmails).not.toHaveBeenCalled();
  });

  it("isolates a hard per-job error to that job and keeps running the rest", async () => {
    mockEvaluateAthenaAlerts
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue([]);
    mockApplyAthenaAlertEvaluations.mockResolvedValue([alertRecord()]);

    const run = await runAthenaAlertJobs([
      { orgId: "org-bad", userId: "user-bad" },
      { orgId: ORG, userId: USER },
    ]);

    expect(run.jobs).toHaveLength(2);
    expect(run.jobs[0]).toMatchObject({ orgId: "org-bad", error: "database unavailable" });
    expect(run.jobs[1]).toMatchObject({ orgId: ORG, firing: 1 });
    expect(run.jobs[1].error).toBeUndefined();
  });

  it("records email failures on the job without failing it", async () => {
    mockApplyAthenaAlertEvaluations.mockResolvedValue([alertRecord()]);
    mockDeliverAthenaAlertEmails.mockResolvedValue({
      emailed: 0,
      skipped: 0,
      failures: [{ ruleId: "daily_spend_cap_reached", dedupeKey: "daily_spend_cap_reached", status: "active", error: "Resend email request failed (500)" }],
    });

    const run = await runAthenaAlertJobs([{ orgId: ORG, userId: USER }]);

    expect(run.jobs[0].emailed).toBe(0);
    expect(run.jobs[0].emailFailures).toHaveLength(1);
    expect(run.jobs[0].error).toBeUndefined();
  });
});
