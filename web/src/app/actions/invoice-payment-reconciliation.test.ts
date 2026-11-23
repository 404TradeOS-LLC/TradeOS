import test from "node:test";
import assert from "node:assert/strict";
import {
  findMatchingRecordedPayment,
  isUnconfirmedPaymentError,
  reconcileRecordedPayment,
  PAYMENT_RECONCILIATION_WINDOW_MS,
  type RecordedPaymentAttempt,
  type RecordedPaymentRecord,
} from "./invoice-payment-reconciliation.ts";

// DES-7 (d) round-2: a payment POST that commits and then loses its
// response must not produce a persisted `invoice.payment_failed`. These
// tests execute the classification + reconciliation the action uses,
// with the committed-payment read stubbed.

const attempt: RecordedPaymentAttempt = { amount: 150, paymentDate: "2026-11-23", method: "card" };
const now = new Date("2026-11-23T12:00:00.000Z");

function committedPayment(overrides: Partial<RecordedPaymentRecord> = {}): RecordedPaymentRecord {
  return {
    amount: 150,
    paymentDate: "2026-11-23T00:00:00.000Z",
    method: "card",
    createdAt: "2026-11-23T11:59:30.000Z",
    ...overrides,
  };
}

test("isUnconfirmedPaymentError: a transport failure (no HTTP status) is unconfirmed", () => {
  assert.equal(isUnconfirmedPaymentError(new TypeError("fetch failed")), true);
  assert.equal(isUnconfirmedPaymentError(new Error("socket hang up")), true);
});

test("isUnconfirmedPaymentError: a 2xx with an unparseable body is unconfirmed — the payment may have committed", () => {
  // apiFetch throws ApiClientError("Invalid response from server", 201)
  // when a committed payment's 201 body cannot be parsed.
  const malformed201 = new Error("Invalid response from server") as Error & { status: number };
  malformed201.status = 201;
  assert.equal(isUnconfirmedPaymentError(malformed201), true);
});

test("isUnconfirmedPaymentError: a non-2xx HTTP rejection is a confirmed failure — no payment was committed", () => {
  for (const status of [400, 401, 403, 404, 409, 422, 500]) {
    const err = new Error(`HTTP ${status}`) as Error & { status: number };
    err.status = status;
    assert.equal(isUnconfirmedPaymentError(err), false, `status ${status} must be a confirmed failure`);
  }
});

test("findMatchingRecordedPayment matches a just-recorded payment for the same amount, date, and method", () => {
  const match = findMatchingRecordedPayment([committedPayment()], attempt, now);
  assert.ok(match, "expected the committed payment to reconcile");
  assert.equal(match?.createdAt, "2026-11-23T11:59:30.000Z");
});

test("findMatchingRecordedPayment rejects a payment with a different amount, date, or method", () => {
  assert.equal(findMatchingRecordedPayment([committedPayment({ amount: 149.99 })], attempt, now), null);
  assert.equal(findMatchingRecordedPayment([committedPayment({ paymentDate: "2026-11-22T00:00:00.000Z" })], attempt, now), null);
  assert.equal(findMatchingRecordedPayment([committedPayment({ method: "check" })], attempt, now), null);
  assert.equal(findMatchingRecordedPayment([], attempt, now), null);
});

test("findMatchingRecordedPayment rejects an identical payment recorded before the reconciliation window", () => {
  const stale = committedPayment({
    createdAt: new Date(now.getTime() - PAYMENT_RECONCILIATION_WINDOW_MS - 1000).toISOString(),
  });
  assert.equal(findMatchingRecordedPayment([stale], attempt, now), null);
});

test("findMatchingRecordedPayment rejects an earlier identical payment created inside the window but before the attempt started", () => {
  // DES-7 round-3: an earlier payment with the same amount, date, and
  // method must not confirm the current attempt — the recorded payment
  // carries no idempotency key, so the attempt start is the binding.
  const attemptStartedAt = new Date("2026-11-23T11:59:00.000Z");
  const earlier = committedPayment({ createdAt: "2026-11-23T11:58:00.000Z" });
  assert.equal(findMatchingRecordedPayment([earlier], attempt, now, attemptStartedAt), null);
});

test("findMatchingRecordedPayment matches an identical payment created after the attempt started", () => {
  const attemptStartedAt = new Date("2026-11-23T11:59:00.000Z");
  const match = findMatchingRecordedPayment([committedPayment()], attempt, now, attemptStartedAt);
  assert.ok(match, "expected the payment committed by this attempt to reconcile");
  assert.equal(match?.createdAt, "2026-11-23T11:59:30.000Z");
});

test("reconcileRecordedPayment returns null for an earlier identical payment inside the window", async () => {
  const attemptStartedAt = new Date("2026-11-23T11:59:00.000Z");
  const earlier = committedPayment({ createdAt: "2026-11-23T11:58:00.000Z" });
  const recorded = await reconcileRecordedPayment(
    async () => ({ payments: [earlier] }),
    attempt,
    now,
    attemptStartedAt,
  );
  assert.equal(recorded, null);
});

test("reconcileRecordedPayment returns the committed payment from a stubbed invoice read", async () => {
  const recorded = await reconcileRecordedPayment(
    async () => ({ payments: [committedPayment()] }),
    attempt,
    now,
  );
  assert.ok(recorded, "expected the stubbed committed payment to reconcile");
});

test("reconcileRecordedPayment returns null when no payment matches the attempt", async () => {
  const recorded = await reconcileRecordedPayment(async () => ({ payments: [] }), attempt, now);
  assert.equal(recorded, null);
});

test("reconcileRecordedPayment returns null when the reconciliation read itself fails — still unconfirmed, never a failure", async () => {
  const recorded = await reconcileRecordedPayment(
    async () => {
      throw new TypeError("fetch failed");
    },
    attempt,
    now,
  );
  assert.equal(recorded, null);
});
