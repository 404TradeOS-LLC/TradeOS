/**
 * Adapter mappings — the acknowledged-state seams each motion adapter
 * wires into. Every function here is pure: it maps server-confirmed
 * records to primitive props and returns null when the record does not
 * support an exact mapping, so callers render the existing badge/status
 * UI alone instead of a promoted or invented stage.
 *
 * Job lifecycle: the field action model offers exactly one next
 * transition per status (dispatched -> traveling -> on_site ->
 * completed; paused -> resume), so stages before the current stage in
 * canonical order are confirmed by the workflow itself. Unscheduled,
 * paused, and cancelled have no progression position and map to null.
 *
 * Invoice lifecycle: completion is derived from the record's own
 * fields, not from stage order alone, because the product allows
 * bypasses the order does not capture (office-recorded offline
 * payments, mark-paid without a payment). Draft is confirmed by the
 * record existing, sent by sentAt, partially-paid by a recorded
 * payment; viewed has no timestamp or delivery vocabulary on the
 * record, so it is never claimed completed — it renders upcoming
 * (view not recorded) unless it is the current status. Paid renders
 * as current only on a reconciled zero balance; any other balance
 * (including negative or non-numeric) returns null.
 */

export const JOB_LIFECYCLE_STAGES = [
  { id: "scheduled", label: "Scheduled" },
  { id: "dispatched", label: "Dispatched" },
  { id: "traveling", label: "Traveling" },
  { id: "on_site", label: "On site" },
  { id: "completed", label: "Completed" },
] as const;

export type JobLifecycleStage = (typeof JOB_LIFECYCLE_STAGES)[number]["id"];

export function jobLifecycle(status: string): {
  current: JobLifecycleStage;
  completed: JobLifecycleStage[];
} | null {
  const index = JOB_LIFECYCLE_STAGES.findIndex((stage) => stage.id === status);
  if (index === -1) return null;
  return {
    current: JOB_LIFECYCLE_STAGES[index].id,
    completed: JOB_LIFECYCLE_STAGES.slice(0, index).map((stage) => stage.id),
  };
}

export const INVOICE_LIFECYCLE_STAGES = [
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "viewed", label: "Viewed" },
  { id: "partially_paid", label: "Partially paid" },
  { id: "paid", label: "Paid" },
] as const;

export type InvoiceLifecycleStage = (typeof INVOICE_LIFECYCLE_STAGES)[number]["id"];

export function invoiceLifecycle(input: {
  status: string;
  sentAt: string | null;
  payments: readonly unknown[];
  balanceDue: number;
}): {
  current: InvoiceLifecycleStage;
  completed: InvoiceLifecycleStage[];
} | null {
  if (input.status === "overdue" || input.status === "voided") return null;
  if (!INVOICE_LIFECYCLE_STAGES.some((stage) => stage.id === input.status)) return null;
  const current = input.status as InvoiceLifecycleStage;
  // Payment completion is gated on a reconciled zero balance from
  // backend truth. A paid status with any other balance is an
  // inconsistency the line must not present as complete.
  if (current === "paid" && input.balanceDue !== 0) return null;
  const completed: InvoiceLifecycleStage[] = [];
  if (current !== "draft") completed.push("draft");
  if (input.sentAt && current !== "sent") completed.push("sent");
  if (input.payments.length > 0 && current !== "partially_paid") completed.push("partially_paid");
  return { current, completed };
}

/**
 * Categories for ResolveSequence, taken verbatim from a received Athena
 * interpretation payload: the draft line-item descriptions, in payload
 * order. No categories are invented; a null draft yields no categories
 * and the caller keeps the unrevealed skeleton.
 */
export function draftCategories(draft: {
  lineItems: ReadonlyArray<{ description: string }>;
} | null): string[] {
  return draft ? draft.lineItems.map((line) => line.description) : [];
}
