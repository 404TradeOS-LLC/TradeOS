// DES-7 (d) round-2: unconfirmed manual record-payment attempts.
//
// The payments POST commits the Payment before the backend writes its 201
// response, so a lost or unparseable response does not mean the payment
// failed — but the old catch recorded `invoice.payment_failed` for every
// error, and that newer failure event made the detail page claim the
// balance was unchanged and tell the contractor to record the payment
// again, which can duplicate the ledger entry (createPayment has no
// idempotency check). Transport/response uncertainty is UNCONFIRMED: the
// action reconciles the invoice's recorded payments before it records a
// definitive failure or recommends a retry.
//
// This module is intentionally self-contained (no `@/` imports): the web
// suite runs under plain `node --test`, where `@/` aliases do not resolve,
// so the classification and matching logic must be directly executable
// here rather than imported from `@/lib/api`.

export interface RecordedPaymentAttempt {
  amount: number;
  /** The form's payment date (YYYY-MM-DD). */
  paymentDate: string;
  method: string;
}

export interface RecordedPaymentRecord {
  amount: number;
  /** ISO date/datetime the payment was recorded for. */
  paymentDate: string;
  method: string;
  createdAt: string;
}

/**
 * How long after the attempt a recorded payment still counts as the same
 * attempt. The reconciliation read follows the POST immediately, so a
 * match created minutes ago is the attempt; an identical older payment is
 * a different (earlier) recording and must not mask an unconfirmed one.
 *
 * DES-7 round-3: the window alone cannot bind a match to this attempt —
 * the recorded payment carries no idempotency key or attempt identifier
 * (the API's InvoicePayment shape is { id, amount, paymentDate, method,
 * createdAt }, and the form's optional reference is neither stored nor
 * surfaced), so the tightest available bound is the attempt start: a
 * match must have been created after this attempt began. The window is
 * only the outer bound, used when the caller cannot supply a start.
 */
export const PAYMENT_RECONCILIATION_WINDOW_MS = 10 * 60 * 1000;

/**
 * Classify a failure of the payments POST as confirmed or unconfirmed.
 *
 * `apiFetch` throws `ApiClientError` — always carrying a numeric HTTP
 * status — for any response it receives, including a 2xx whose body
 * cannot be parsed, and lets transport failures (fetch throwing before
 * any response) propagate as status-less errors. A status-less error, or
 * a 2xx status with a malformed body, means the payment may already be
 * committed: the response was lost or unparseable after the write. A
 * non-2xx status is a confirmed rejection — the backend answered with an
 * error, so no payment was committed.
 */
export function isUnconfirmedPaymentError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return true;
  return status >= 200 && status < 300;
}

/**
 * Find the recorded payment matching an attempt: same amount (to the
 * cent), same payment date, same method, created inside the
 * reconciliation window — and, when the caller supplies it, created after
 * the attempt started. Returns null when nothing matches.
 *
 * The attempt-start bound is what ties a match to THIS attempt. Without
 * it, an earlier identical payment recorded inside the window would
 * falsely confirm a new attempt that actually failed before committing.
 */
export function findMatchingRecordedPayment(
  payments: readonly RecordedPaymentRecord[],
  attempt: RecordedPaymentAttempt,
  now: Date = new Date(),
  attemptStartedAt?: Date,
): RecordedPaymentRecord | null {
  const attemptDay = attempt.paymentDate.slice(0, 10);
  const attemptAmount = Number(attempt.amount.toFixed(2));
  const earliestCreatedAt = Math.max(
    now.getTime() - PAYMENT_RECONCILIATION_WINDOW_MS,
    attemptStartedAt ? attemptStartedAt.getTime() : 0,
  );
  return (
    payments.find(
      (payment) =>
        Number(Number(payment.amount).toFixed(2)) === attemptAmount &&
        payment.paymentDate.slice(0, 10) === attemptDay &&
        payment.method === attempt.method &&
        new Date(payment.createdAt).getTime() >= earliestCreatedAt,
    ) ?? null
  );
}

/**
 * Reconcile an unconfirmed payment attempt against the invoice's recorded
 * payments. `fetchInvoice` is injected so tests can stub the read. Returns
 * the matching payment, or null when no match exists or the reconciliation
 * read itself fails — null means "still unconfirmed", never "definitely
 * failed", so the caller must not record a failure event on it.
 */
export async function reconcileRecordedPayment(
  fetchInvoice: () => Promise<{ payments?: readonly RecordedPaymentRecord[] | null }>,
  attempt: RecordedPaymentAttempt,
  now: Date = new Date(),
  attemptStartedAt?: Date,
): Promise<RecordedPaymentRecord | null> {
  try {
    const invoice = await fetchInvoice();
    return findMatchingRecordedPayment(invoice.payments ?? [], attempt, now, attemptStartedAt);
  } catch {
    return null;
  }
}
