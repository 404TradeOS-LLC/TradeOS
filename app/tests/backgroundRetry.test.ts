import { BACKGROUND_RETRY_MAX_ATTEMPTS, executeBackgroundAttempt } from "../modules/background/retry";

describe("background retry contract", () => {
  it("returns stable attempt metadata and a bounded next-attempt time", async () => {
    const outcome = await executeBackgroundAttempt(
      { orgId: "org-1", jobName: "supplier-price-sync", workerId: "worker-1", correlationId: "corr-1", attempt: 1 },
      async (context) => {
        expect(context).toEqual({ orgId: "org-1", jobName: "supplier-price-sync", workerId: "worker-1", correlationId: "corr-1", attempt: 1 });
        throw new Error("transient dependency failure");
      },
      new Date("2026-01-01T00:00:00.000Z")
    );

    expect(outcome).toMatchObject({
      status: "retryable_failure",
      failure: {
        code: "background_job_failed",
        retryable: true,
        attempt: 1,
        correlationId: "corr-1",
        nextAttemptAt: "2026-01-01T00:00:02.000Z",
      },
    });
  });

  it("classifies inactive worker identity as terminal without exposing the error", async () => {
    const outcome = await executeBackgroundAttempt(
      { orgId: "org-1", jobName: "supplier-price-sync", workerId: "worker-1", correlationId: "corr-2" },
      async () => { throw new Error("Background job identity must have an active organization membership"); }
    );

    expect(outcome).toMatchObject({ status: "terminal_failure", failure: { code: "background_identity_invalid", retryable: false, nextAttemptAt: null } });
    expect(JSON.stringify(outcome)).not.toContain("active organization membership");
  });

  it("does not schedule an attempt after the retry budget is exhausted", async () => {
    const outcome = await executeBackgroundAttempt(
      { orgId: "org-1", jobName: "supplier-price-sync", workerId: "worker-1", correlationId: "corr-3", attempt: BACKGROUND_RETRY_MAX_ATTEMPTS },
      async () => { throw Object.assign(new Error("provider unavailable"), { retryable: true, code: "provider_unavailable" }); }
    );

    expect(outcome).toMatchObject({ status: "terminal_failure", failure: { code: "provider_unavailable", retryable: false, attempt: BACKGROUND_RETRY_MAX_ATTEMPTS, nextAttemptAt: null } });
  });
});
