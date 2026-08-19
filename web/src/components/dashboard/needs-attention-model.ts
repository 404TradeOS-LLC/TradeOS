import type { EstimateQueueItem, InvoiceQueueItem, ProposalQueueItem } from "../../lib/api";

// Owner-decided (2026-08-18): no canonical staleness age exists in product
// docs for proposals (docs/WORKFLOW_LIFECYCLES.md explicitly documents the
// `staleBefore` filter as having no fixed age). 14 days since `sentAt` is
// this dashboard's local UI constant, not a backend contract.
export const STALE_PROPOSAL_DAYS = 14;

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

function toCustomerName(name: string | null): string {
  return name ?? "No customer linked";
}

function compareUpdatedAtDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

// Oldest-due-date-first — "due-date urgency clearly requires oldest overdue
// first" takes priority over newest-activity-first for this one bucket.
function compareDueDateAsc(a: { dueDate: string | null }, b: { dueDate: string | null }): number {
  const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  return aTime - bTime;
}

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
// order the queue response arrived in.
export function buildAttentionEstimateRows(items: EstimateQueueItem[]): AttentionEstimateRow[] {
  return [...items].sort(compareUpdatedAtDesc).map(toEstimateRow);
}

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
// higher-priority stale bucket, ahead of the remaining unsigned proposals.
export function buildAttentionProposalRows(staleUnsigned: ProposalQueueItem[], unsigned: ProposalQueueItem[]): AttentionProposalRow[] {
  const staleIds = new Set(staleUnsigned.map((item) => item.id));
  const staleRows = [...staleUnsigned].sort(compareUpdatedAtDesc).map((item) => toProposalRow(item, true));
  const otherRows = unsigned
    .filter((item) => !staleIds.has(item.id))
    .sort(compareUpdatedAtDesc)
    .map((item) => toProposalRow(item, false));
  return [...staleRows, ...otherRows];
}

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
// remaining partially-paid/unpaid invoices (newest activity first).
export function buildAttentionInvoiceRows(overdue: InvoiceQueueItem[], unpaid: InvoiceQueueItem[]): AttentionInvoiceRow[] {
  const overdueIds = new Set(overdue.map((item) => item.id));
  const overdueRows = [...overdue].sort(compareDueDateAsc).map((item) => toInvoiceRow(item, true));
  const otherRows = unpaid
    .filter((item) => !overdueIds.has(item.id))
    .sort(compareUpdatedAtDesc)
    .map((item) => toInvoiceRow(item, false));
  return [...overdueRows, ...otherRows];
}
