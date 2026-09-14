import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancialIntelligenceSummary } from "./financial-intelligence-model.ts";

const receivables = {
  loadedOutstanding: 1600,
  loadedOverdueOutstanding: 600,
  openInvoiceTotal: 2,
  overdueInvoiceTotal: 1,
  loadedInvoiceCount: 2,
  isPartial: false,
  topInvoices: [],
};

test("uses recorded payments and backend-computed receivable balances", () => {
  const summary = buildFinancialIntelligenceSummary({
    paymentLedger: { period: "current_week", timezone: { timezone: "UTC", isFallback: false }, rangeUtc: { start: "", end: "" }, totalAmount: 900, paymentCount: 2, payments: [] },
    receivables,
    proposals: [],
    unsignedProposalTotal: 0,
  });
  assert.equal(summary.collectedThisWeek, 900);
  assert.equal(summary.outstandingReceivables, 1600);
  assert.equal(summary.overdueReceivables, 600);
});

test("proposal opportunity sums only known finite amounts and reports partial coverage", () => {
  const summary = buildFinancialIntelligenceSummary({
    paymentLedger: null,
    receivables,
    proposals: [
      { projectId: "p1", projectName: "A", customerName: "A", proposalId: "a", status: "sent", amount: 5000, sentAt: null, stale: false },
      { projectId: "p2", projectName: "B", customerName: "B", proposalId: "b", status: "sent", amount: null, sentAt: null, stale: false },
    ],
    unsignedProposalTotal: 3,
  });
  assert.equal(summary.unsignedProposalOpportunity, 5000);
  assert.equal(summary.proposalsPartial, true);
});

test("failed sources stay unknown instead of becoming zero", () => {
  const summary = buildFinancialIntelligenceSummary({
    paymentLedger: null,
    receivables,
    proposals: [],
    unsignedProposalTotal: 0,
    invoiceError: "unavailable",
    proposalError: "unavailable",
  });
  assert.equal(summary.collectedThisWeek, null);
  assert.equal(summary.outstandingReceivables, null);
  assert.equal(summary.unsignedProposalOpportunity, null);
  assert.equal(summary.projectedMarginPct, null);
  assert.equal(summary.exactOrganizationSummary, false);
});

test("prefers the exact backend summary and exposes projected margin without claiming actual job cost", () => {
  const summary = buildFinancialIntelligenceSummary({
    paymentLedger: null,
    receivables,
    proposals: [],
    unsignedProposalTotal: 0,
    backendSummary: {
      generatedAt: "2026-09-14T12:00:00.000Z",
      cashCollected: { period: "current_week", amount: 1200, paymentCount: 3, rangeUtc: null, timezone: null, coverage: { status: "complete", detail: "complete" } },
      receivables: { openAmount: 4200, overdueAmount: 700, openInvoiceCount: 4, overdueInvoiceCount: 1, coverage: { status: "complete", detail: "complete" } },
      unsignedOpportunity: { amount: 9000, proposalCount: 2, pricedProposalCount: 2, coverage: { status: "complete", detail: "complete" } },
      projectedCommittedMargin: { sellAmount: 10000, costAmount: 7000, grossProfit: 3000, marginPct: 30, estimateCount: 2, coverage: { status: "complete", detail: "estimate snapshots" } },
      actualJobCosts: { amount: null, coverage: { status: "unavailable", detail: "not persisted" } },
    },
  });

  assert.equal(summary.outstandingReceivables, 4200);
  assert.equal(summary.unsignedProposalOpportunity, 9000);
  assert.equal(summary.projectedMarginPct, 30);
  assert.equal(summary.projectedGrossProfit, 3000);
  assert.equal(summary.actualJobCostCoverage.status, "unavailable");
  assert.equal(summary.exactOrganizationSummary, true);
});
