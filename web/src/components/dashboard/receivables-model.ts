import type { AttentionInvoiceRow } from "./needs-attention-model";

export interface ReceivablesTotals {
  overdueInvoiceTotal: number;
  openInvoiceTotal: number;
}

export interface ReceivablesSummary {
  /** Sum of balanceDue across the rows actually loaded — not necessarily every open invoice, see isPartial. */
  loadedOutstanding: number;
  loadedOverdueOutstanding: number;
  /** Exact organization-wide counts from the work-queue APIs, independent of how many rows were loaded. */
  openInvoiceTotal: number;
  overdueInvoiceTotal: number;
  loadedInvoiceCount: number;
  /** True when fewer invoices were loaded than exist, so the dollar totals above are a floor, not the full figure. */
  isPartial: boolean;
  topInvoices: AttentionInvoiceRow[];
}

/**
 * Aggregates already-loaded, already-deduped invoice attention rows into an
 * outstanding-money summary. Reuses each row's backend-computed `balanceDue`
 * (amount minus recorded payments) rather than recomputing invoice math, and
 * is explicit about the totals being partial when the loaded page doesn't
 * cover every open invoice for the organization — see `isPartial`.
 */
export function buildReceivablesSummary(rows: AttentionInvoiceRow[], totals: ReceivablesTotals, topCount = 5): ReceivablesSummary {
  const loadedOutstanding = rows.reduce((sum, row) => sum + row.balanceDue, 0);
  const loadedOverdueOutstanding = rows.filter((row) => row.overdue).reduce((sum, row) => sum + row.balanceDue, 0);
  const topInvoices = [...rows].sort((a, b) => b.balanceDue - a.balanceDue).slice(0, topCount);

  return {
    loadedOutstanding,
    loadedOverdueOutstanding,
    openInvoiceTotal: totals.openInvoiceTotal,
    overdueInvoiceTotal: totals.overdueInvoiceTotal,
    loadedInvoiceCount: rows.length,
    isPartial: rows.length < totals.openInvoiceTotal,
    topInvoices,
  };
}
