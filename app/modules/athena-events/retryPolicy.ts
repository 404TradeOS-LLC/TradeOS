// Bounded exponential backoff for A8 event delivery retries (plan doc
// "Versioning, Retries, Deduplication, Replay": "Fixed bounded max-attempts
// constant, exponential backoff with jitter-free deterministic delay
// (retryPolicy.ts), computed and persisted nextAttemptAt"). No jitter -
// deterministic so tests are reproducible without stubbing Math.random.

// A delivery that has failed this many times (attemptCount, post-increment)
// moves to 'dead_letter' instead of scheduling another attempt.
export const ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS = 5;

// delayMs = ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2^attemptCount, so a delivery
// that has failed once (attemptCount = 1) waits base*2, twice waits base*4,
// and so on - each retry backs off further than the last.
export const ATHENA_EVENT_RETRY_BASE_DELAY_MS = 1_000;

export interface AthenaEventRetryDecision {
  nextAttemptAt: Date;
  // True once attemptCount has reached ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS -
  // the caller (dispatch.ts) must dead-letter rather than reschedule.
  exhausted: boolean;
}

// `attemptCount` is the *post-increment* attempt count (i.e. the caller
// passes delivery.attemptCount + 1, the count this failure represents), so
// exhausted flips true exactly on the attempt that reaches the max, not one
// attempt early or late.
export function computeNextRetry(attemptCount: number, now: Date = new Date()): AthenaEventRetryDecision {
  if (attemptCount >= ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS) {
    return { nextAttemptAt: now, exhausted: true };
  }
  const delayMs = ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2 ** attemptCount;
  return { nextAttemptAt: new Date(now.getTime() + delayMs), exhausted: false };
}
