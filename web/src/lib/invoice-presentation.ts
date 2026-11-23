export interface InvoicePresentationInput {
  status: string;
  paidAmount: number;
  balanceDue: number;
  dueDate: string | null;
}

export function getInvoiceDisplayStatus(invoice: InvoicePresentationInput, now = Date.now()) {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "voided" || invoice.status === "void") return "voided";
  if (invoice.balanceDue <= 0 && invoice.paidAmount > 0) return "paid";
  if (invoice.dueDate && new Date(invoice.dueDate).getTime() < now) return "overdue";
  if (invoice.paidAmount > 0) return "partially_paid";
  return invoice.status;
}

export function getInvoiceRunningBalance(invoice: Pick<InvoicePresentationInput, "balanceDue">) {
  return invoice.balanceDue;
}

export interface PaymentFailureDisplay {
  reason: string;
  at: string;
}

interface PaymentFailureInput {
  deliveries?: Array<{
    eventType: string;
    occurredAt: string;
    metadata?: Record<string, unknown> | null;
  }>;
  payments?: Array<{ createdAt: string | Date }>;
}

/**
 * DES-7 (d): Payment Failure is a failed manual record-payment attempt —
 * there is no online payment flow to fail. A failed attempt records an
 * `invoice.payment_failed` delivery event carrying the reason; the detail
 * page shows this banner while that event is the latest payment outcome.
 * A later successful recorded payment (or a mark-paid, which emits
 * `invoice.paid`) supersedes it, so the invoice stops presenting the
 * failure instead of staying stuck in it.
 */
export function getLatestPaymentFailure(invoice: PaymentFailureInput): PaymentFailureDisplay | null {
  const failures = (invoice.deliveries ?? []).filter((delivery) => delivery.eventType === "invoice.payment_failed");
  if (failures.length === 0) return null;
  const latest = failures.reduce((current, next) =>
    new Date(next.occurredAt).getTime() > new Date(current.occurredAt).getTime() ? next : current
  );
  const latestAt = new Date(latest.occurredAt).getTime();
  const latestSuccessAt = Math.max(
    0,
    ...(invoice.payments ?? []).map((payment) => new Date(payment.createdAt).getTime()),
    ...(invoice.deliveries ?? [])
      .filter((delivery) => delivery.eventType === "invoice.paid")
      .map((delivery) => new Date(delivery.occurredAt).getTime())
  );
  if (latestAt <= latestSuccessAt) return null;
  const reason = typeof latest.metadata?.reason === "string" && latest.metadata.reason
    ? latest.metadata.reason
    : "The payment could not be recorded.";
  return { reason, at: latest.occurredAt };
}
