import type { EstimateQueueItem, InvoiceQueueItem, ProposalQueueItem } from "../../lib/api";

// Owner-decided (2026-08-18): no canonical staleness age exists in product
// docs for proposals (docs/WORKFLOW_LIFECYCLES.md explicitly documents the
// `staleBefore` filter as having no fixed age). 14 days since `sentAt` is
// this dashboard's local UI constant, not a backend contract.
export const STALE_PROPOSAL_DAYS = 14;

/**
 * Calculates the ISO timestamp marking the start of the stale proposal period.
 *
 * @param now - The reference date used to calculate the cutoff
 * @returns The ISO timestamp from 14 days before `now`
 */
export function getStaleProposalCutoffIso(now: Date): string {
  return new Date(now.getTime() - STALE_PROPOSAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export interface AttentionEstimateRow {
  projectId: string;
  projectName: string;
  customerName: string;
  estimateId: string;
  version: number;
  status: string;
  totalPrice: number;
}

export interface AttentionProposalRow {
  projectId: string;
  projectName: string;
  customerName: string;
  proposalId: string;
  status: string;
  amount: number | null;
  sentAt: string | null;
  stale: boolean;
}

export interface AttentionInvoiceRow {
  projectId: string;
  projectName: string;
  customerName: string;
  invoiceId: string;
  documentNumber: number;
  status: string;
  amount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: string | null;
  overdue: boolean;
}

/**
 * Provides a display name for a customer.
 *
 * @param name - The customer's name, or `null` when no customer is linked
 * @returns The customer name, or `"No customer linked"` when `name` is `null`
 */
function toCustomerName(name: string | null): string {
  return name ?? "No customer linked";
}

/**
 * Compares records by update time, with the most recently updated record first.
 *
 * @param a - The first record to compare
 * @param b - The second record to compare
 * @returns A negative number when `b` is more recent, a positive number when `a` is more recent, or zero when their update times are equal
 */
function compareUpdatedAtDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

// Oldest-due-date-first — "due-date urgency clearly requires oldest overdue
/**
 * Orders records by due date, with earlier dates first and records without a due date last.
 *
 * @returns A negative number, zero, or a positive number when `a` is earlier than, equal to, or later than `b`.
 */
function compareDueDateAsc(a: { dueDate: string | null }, b: { dueDate: string | null }): number {
  const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  return aTime - bTime;
}

/**
 * Maps an estimate queue item to an attention-row representation.
 *
 * @param item - The estimate queue item to map
 * @returns The corresponding attention estimate row
 */
function toEstimateRow(item: EstimateQueueItem): AttentionEstimateRow {
  return {
    projectId: item.projectId,
    projectName: item.projectName,
    customerName: toCustomerName(item.customerName),
    estimateId: item.id,
    version: item.revision,
    status: item.status,
    totalPrice: item.amount,
  };
}

// Deterministic newest-activity-first ordering, independent of whatever
/**
 * Builds estimate attention rows ordered by most recent activity.
 *
 * @returns The mapped estimate attention rows.
 */
export function buildAttentionEstimateRows(items: EstimateQueueItem[]): AttentionEstimateRow[] {
  return [...items].sort(compareUpdatedAtDesc).map(toEstimateRow);
}

/**
 * Converts a proposal queue item into an attention-row model.
 *
 * @param item - The proposal queue item to convert
 * @param stale - Whether the proposal is considered stale
 * @returns The corresponding attention proposal row
 */
function toProposalRow(item: ProposalQueueItem, stale: boolean): AttentionProposalRow {
  return {
    projectId: item.projectId,
    projectName: item.projectName,
    customerName: toCustomerName(item.customerName),
    proposalId: item.id,
    status: item.status,
    amount: item.amount,
    sentAt: item.sentAt,
    stale,
  };
}

// `unsigned` is a strict superset of `stale` (every stale proposal is also
// unsigned) — dedupe by id so a stale proposal renders once, in the
/**
 * Builds proposal attention rows with stale unsigned proposals prioritized.
 *
 * Stale proposals are sorted by most recent activity, followed by remaining unsigned proposals in the same order. Duplicate proposals are excluded from the unsigned group.
 *
 * @param staleUnsigned - Proposals that have remained unsigned past the stale threshold
 * @param unsigned - All currently unsigned proposals
 * @returns Proposal attention rows with stale status applied to prioritized proposals
 */
export function buildAttentionProposalRows(staleUnsigned: ProposalQueueItem[], unsigned: ProposalQueueItem[]): AttentionProposalRow[] {
  const staleIds = new Set(staleUnsigned.map((item) => item.id));
  const staleRows = [...staleUnsigned].sort(compareUpdatedAtDesc).map((item) => toProposalRow(item, true));
  const otherRows = unsigned
    .filter((item) => !staleIds.has(item.id))
    .sort(compareUpdatedAtDesc)
    .map((item) => toProposalRow(item, false));
  return [...staleRows, ...otherRows];
}

/**
 * Converts an invoice queue item into an attention-row model.
 *
 * @param item - The invoice queue item to convert
 * @param overdue - Whether the invoice is overdue
 * @returns The corresponding attention invoice row
 */
function toInvoiceRow(item: InvoiceQueueItem, overdue: boolean): AttentionInvoiceRow {
  return {
    projectId: item.projectId,
    projectName: item.projectName,
    customerName: toCustomerName(item.customerName),
    invoiceId: item.id,
    documentNumber: item.documentNumber,
    status: item.status,
    amount: item.amount,
    paidAmount: item.paidAmount,
    balanceDue: item.balanceDue,
    dueDate: item.dueDate,
    overdue,
  };
}

// `unpaid` is a strict superset of `overdue` (every overdue invoice also has
// balanceDue > 0) — dedupe by id so an overdue invoice renders once, in the
// higher-priority overdue bucket (oldest due date first), ahead of the
/**
 * Builds invoice rows with overdue invoices prioritized before other unpaid invoices.
 *
 * @param overdue - Invoices past their due date
 * @param unpaid - Partially paid or unpaid invoices
 * @returns Overdue invoices ordered by oldest due date, followed by remaining unpaid invoices ordered by newest activity
 */
export function buildAttentionInvoiceRows(overdue: InvoiceQueueItem[], unpaid: InvoiceQueueItem[]): AttentionInvoiceRow[] {
  const overdueIds = new Set(overdue.map((item) => item.id));
  const overdueRows = [...overdue].sort(compareDueDateAsc).map((item) => toInvoiceRow(item, true));
  const otherRows = unpaid
    .filter((item) => !overdueIds.has(item.id))
    .sort(compareUpdatedAtDesc)
    .map((item) => toInvoiceRow(item, false));
  return [...overdueRows, ...otherRows];
}
