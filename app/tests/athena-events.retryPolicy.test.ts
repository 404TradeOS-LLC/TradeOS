import { ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS, ATHENA_EVENT_RETRY_BASE_DELAY_MS, computeNextRetry } from "../modules/athena-events/retryPolicy";

describe("athena-events retryPolicy", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("computes a deterministic exponential backoff schedule with no jitter", () => {
    for (let attemptCount = 1; attemptCount < ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS; attemptCount += 1) {
      const { nextAttemptAt, exhausted } = computeNextRetry(attemptCount, now);
      const expectedDelayMs = ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2 ** attemptCount;
      expect(exhausted).toBe(false);
      expect(nextAttemptAt.getTime()).toBe(now.getTime() + expectedDelayMs);
    }
  });

  it("produces the same nextAttemptAt for the same attemptCount every call (deterministic, no jitter)", () => {
    const first = computeNextRetry(2, now);
    const second = computeNextRetry(2, now);
    expect(first.nextAttemptAt.getTime()).toBe(second.nextAttemptAt.getTime());
  });

  it("is not exhausted the attempt before the max", () => {
    const decision = computeNextRetry(ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS - 1, now);
    expect(decision.exhausted).toBe(false);
  });

  it("flips exhausted true exactly at the max-attempts boundary", () => {
    const decision = computeNextRetry(ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS, now);
    expect(decision.exhausted).toBe(true);
  });

  it("stays exhausted beyond the max-attempts boundary", () => {
    const decision = computeNextRetry(ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS + 3, now);
    expect(decision.exhausted).toBe(true);
  });
});
