import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAttentionEstimateRows,
  buildAttentionInvoiceRows,
  buildAttentionProposalRows,
  getStaleProposalCutoffIso,
  STALE_PROPOSAL_DAYS,
} from "./needs-attention-model.ts";
import type { EstimateQueueItem, InvoiceQueueItem, ProposalQueueItem } from "../../lib/api.ts";

function estimate(overrides: Partial<EstimateQueueItem>): EstimateQueueItem {
  return {
    id: "e1",
    projectId: "p1",
    projectName: "Project",
    customerName: "Customer",
    status: "draft",
    amount: 1000,
    revision: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function proposal(overrides: Partial<ProposalQueueItem>): ProposalQueueItem {
  return {
    id: "pr1",
    projectId: "p1",
    projectName: "Project",
    customerName: "Customer",
    status: "sent",
    amount: 2000,
    contractId: null,
    sentAt: "2026-08-01T00:00:00.000Z",
    viewedAt: null,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function invoice(overrides: Partial<InvoiceQueueItem>): InvoiceQueueItem {
  return {
    id: "i1",
    documentNumber: 100,
    projectId: "p1",
    projectName: "Project",
    customerName: "Customer",
    status: "sent",
    amount: 500,
    paidAmount: 0,
    balanceDue: 500,
    dueDate: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("getStaleProposalCutoffIso subtracts the owner-decided 14-day threshold from `now`", () => {
  assert.equal(STALE_PROPOSAL_DAYS, 14);
  const now = new Date("2026-08-18T12:00:00.000Z");
  assert.equal(getStaleProposalCutoffIso(now), "2026-08-04T12:00:00.000Z");
});

test("buildAttentionEstimateRows maps queue fields onto attention-row fields and orders newest-activity-first", () => {
  const older = estimate({ id: "e-old", updatedAt: "2026-08-01T00:00:00.000Z" });
  const newer = estimate({ id: "e-new", updatedAt: "2026-08-05T00:00:00.000Z" });

  const rows = buildAttentionEstimateRows([older, newer]);

  assert.deepEqual(
    rows.map((row) => row.estimateId),
    ["e-new", "e-old"]
  );
  assert.equal(rows[0].totalPrice, newer.amount);
  assert.equal(rows[0].version, newer.revision);
  assert.equal(rows[0].customerName, "Customer");
});

test("buildAttentionEstimateRows falls back to 'No customer linked' when customerName is null", () => {
  const rows = buildAttentionEstimateRows([estimate({ customerName: null })]);
  assert.equal(rows[0].customerName, "No customer linked");
});

test("buildAttentionProposalRows puts stale-unsigned proposals first (newest-first within each bucket) and dedupes against the unsigned superset", () => {
  const stale = proposal({ id: "stale-1", sentAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" });
  // `unsigned` is a superset of `stale` — the same proposal is present in
  // both queue responses and must render exactly once, in the stale bucket.
  const unsignedNewer = proposal({ id: "unsigned-newer", updatedAt: "2026-08-10T00:00:00.000Z" });
  const unsignedOlder = proposal({ id: "unsigned-older", updatedAt: "2026-08-05T00:00:00.000Z" });

  const rows = buildAttentionProposalRows([stale], [stale, unsignedNewer, unsignedOlder]);

  assert.deepEqual(
    rows.map((row) => row.proposalId),
    ["stale-1", "unsigned-newer", "unsigned-older"]
  );
  assert.equal(rows[0].stale, true);
  assert.equal(rows[1].stale, false);
  assert.equal(rows[2].stale, false);
});

test("buildAttentionProposalRows marks a proposal stale=false when it only appears in the unsigned result", () => {
  const rows = buildAttentionProposalRows([], [proposal({ id: "only-unsigned" })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stale, false);
});

test("buildAttentionInvoiceRows puts overdue invoices first ordered oldest-due-date-first, then the remaining unpaid/partially-paid invoices newest-activity-first", () => {
  const overdueOlder = invoice({ id: "overdue-older", dueDate: "2026-07-01T00:00:00.000Z" });
  const overdueNewer = invoice({ id: "overdue-newer", dueDate: "2026-07-15T00:00:00.000Z" });
  // `unpaid` is a superset of `overdue` — both overdue invoices are also
  // present in the unpaid result and must not be duplicated.
  const partiallyPaid = invoice({ id: "partial-1", paidAmount: 100, balanceDue: 400, updatedAt: "2026-08-10T00:00:00.000Z" });
  const plainUnpaid = invoice({ id: "unpaid-1", updatedAt: "2026-08-05T00:00:00.000Z" });

  const rows = buildAttentionInvoiceRows(
    [overdueNewer, overdueOlder],
    [overdueNewer, overdueOlder, partiallyPaid, plainUnpaid]
  );

  assert.deepEqual(
    rows.map((row) => row.invoiceId),
    ["overdue-older", "overdue-newer", "partial-1", "unpaid-1"]
  );
  assert.equal(rows[0].overdue, true);
  assert.equal(rows[1].overdue, true);
  assert.equal(rows[2].overdue, false);
  assert.equal(rows[3].overdue, false);
});

test("buildAttentionInvoiceRows preserves paidAmount/balanceDue so the UI can distinguish partially-paid from fully-unpaid without recomputing eligibility", () => {
  const partiallyPaid = invoice({ id: "partial-1", paidAmount: 100, balanceDue: 400 });
  const rows = buildAttentionInvoiceRows([], [partiallyPaid]);

  assert.equal(rows[0].paidAmount, 100);
  assert.equal(rows[0].balanceDue, 400);
  assert.equal(rows[0].overdue, false);
});

test("buildAttentionInvoiceRows treats an empty overdue result as no overdue invoices, not an error", () => {
  const rows = buildAttentionInvoiceRows([], [invoice({ id: "i1" })]);
  assert.equal(rows.every((row) => !row.overdue), true);
});
