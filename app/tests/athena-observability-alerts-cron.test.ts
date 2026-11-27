// Route coverage for backend/routes/athenaObservabilityAlertsCron.routes.ts.
// Follows tests/davis-bacon-sync-cron.test.ts: the handler is called
// directly with mocked req/res and the runner is mocked, so no database or
// email is involved. Authorization itself is the shared CRON_SECRET helper
// imported from the Davis-Bacon route (covered by its own tests).
import { Request, Response } from "express";

const mockRunAthenaAlertJobs = jest.fn();

jest.mock("../modules/athena-observability/alertRunner", () => ({
  runAthenaAlertJobs: mockRunAthenaAlertJobs,
}));

import { handleAthenaObservabilityAlertsCron } from "../backend/routes/athenaObservabilityAlertsCron.routes";

function mockRequest(): Request {
  return {} as unknown as Request;
}

interface MockCronResponse {
  statusCode: number;
  body: unknown;
  status(code: number): MockCronResponse;
  json(payload: unknown): MockCronResponse;
}

function mockResponse(): Response & MockCronResponse {
  const res: MockCronResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & MockCronResponse;
}

const OLD_JOBS = process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS;

afterEach(() => {
  jest.clearAllMocks();
  if (OLD_JOBS === undefined) delete process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS;
  else process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS = OLD_JOBS;
});

describe("handleAthenaObservabilityAlertsCron configuration", () => {
  it("returns 500 for invalid jobs configuration", async () => {
    process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS = "not-a-job-spec";
    const res = mockResponse();
    await handleAthenaObservabilityAlertsCron(mockRequest(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "athena_observability_alerts_configuration_invalid" });
    expect(mockRunAthenaAlertJobs).not.toHaveBeenCalled();
  });

  it("returns 503 when no jobs are configured", async () => {
    delete process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS;
    const res = mockResponse();
    await handleAthenaObservabilityAlertsCron(mockRequest(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "athena_observability_alerts_not_configured" });
    expect(mockRunAthenaAlertJobs).not.toHaveBeenCalled();
  });
});

describe("handleAthenaObservabilityAlertsCron run", () => {
  beforeEach(() => {
    process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS = "org-1:user-1";
  });

  it("returns 200 with the run summary when all jobs succeed", async () => {
    mockRunAthenaAlertJobs.mockResolvedValue({
      recipient: "hello@404tradeos.com",
      jobs: [
        {
          orgId: "org-1",
          applied: [{ ruleId: "daily_spend_cap_reached", dedupeKey: "daily_spend_cap_reached", status: "active", severity: "high" }],
          firing: 1,
          resolved: 0,
          emailed: 1,
          emailFailures: [],
          recipientConfigured: true,
        },
      ],
    });

    const res = mockResponse();
    await handleAthenaObservabilityAlertsCron(mockRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      jobs: 1,
      emailed: 1,
      emailFailures: [],
      alerts: [{ orgId: "org-1", ruleId: "daily_spend_cap_reached", dedupeKey: "daily_spend_cap_reached", status: "active", severity: "high" }],
    });
  });

  it("returns 200 when the recipient is unset (evaluation ran, delivery skipped)", async () => {
    mockRunAthenaAlertJobs.mockResolvedValue({
      recipient: null,
      jobs: [
        { orgId: "org-1", applied: [], firing: 0, resolved: 0, emailed: 0, emailFailures: [], recipientConfigured: false },
      ],
    });

    const res = mockResponse();
    await handleAthenaObservabilityAlertsCron(mockRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: "ok", emailed: 0 }));
  });

  it("returns 500 when a job hard-fails, including the email failures in the summary", async () => {
    mockRunAthenaAlertJobs.mockResolvedValue({
      recipient: "hello@404tradeos.com",
      jobs: [
        {
          orgId: "org-1",
          applied: [],
          firing: 0,
          resolved: 0,
          emailed: 0,
          emailFailures: [{ ruleId: "cost_spike", dedupeKey: "cost_spike", status: "active", error: "Resend email request failed (500)" }],
          recipientConfigured: true,
          error: "database unavailable",
        },
      ],
    });

    const res = mockResponse();
    await handleAthenaObservabilityAlertsCron(mockRequest(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ status: "failed", jobs: 1, failedJobs: 1, emailed: 0 }));
    expect((res.body as { emailFailures: unknown[] }).emailFailures).toHaveLength(1);
  });
});
