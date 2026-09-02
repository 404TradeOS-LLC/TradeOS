import test from "node:test";
import assert from "node:assert/strict";
import { buildReceivablesSummary } from "./receivables-model.ts";
import type { AttentionInvoiceRow } from "./needs-attention-model.ts";

function invoiceRow(overrides: Partial<AttentionInvoiceRow>): AttentionInvoiceRow {
  return {
    projectId: "p1",
    projectName: "Project",
    customerName: "Customer",
    invoiceId: "i1",
    documentNumber: 100,
    status: "sent",
    amount: 500,
    paidAmount: 0,
    balanceDue: 500,
    dueDate: "2026-08-10T00:00:00.000Z",
    overdue: false,
    ...overrides,
  };
}

test("sums balanceDue (not amount) across loaded rows so partial payments are not double counted", () => {
  const rows = [
    invoiceRow({ invoiceId: "i1", amount: 1000, paidAmount: 400, balanceDue: 600 }),
    invoiceRow({ invoiceId: "i2", amount: 500, paidAmount: 0, balanceDue: 500 }),
  ];

  const summary = buildReceivablesSummary(rows, { overdueInvoiceTotal: 0, openInvoiceTotal: 2 });

  assert.equal(summary.loadedOutstanding, 1100);
});

test("overdue outstanding only sums rows flagged overdue, not every open row", () => {
  const rows = [
    invoiceRow({ invoiceId: "i1", balanceDue: 600, overdue: true }),
    invoiceRow({ invoiceId: "i2", balanceDue: 500, overdue: false }),
  ];

  const summary = buildReceivablesSummary(rows, { overdueInvoiceTotal: 1, openInvoiceTotal: 2 });

  assert.equal(summary.loadedOverdueOutstanding, 600);
  assert.equal(summary.loadedOutstanding, 1100);
});

test("counts come from the exact organization-wide totals, not the loaded row count", () => {
  const rows = [invoiceRow({ invoiceId: "i1" })];
  const summary = buildReceivablesSummary(rows, { overdueInvoiceTotal: 3, openInvoiceTotal: 25 });

  assert.equal(summary.openInvoiceTotal, 25);
  assert.equal(summary.overdueInvoiceTotal, 3);
  assert.equal(summary.loadedInvoiceCount, 1);
});

test("isPartial is true when fewer rows were loaded than the exact open total", () => {
  const rows = [invoiceRow({ invoiceId: "i1" })];
  const summary = buildReceivablesSummary(rows, { overdueInvoiceTotal: 0, openInvoiceTotal: 5 });
  assert.equal(summary.isPartial, true);
});

test("isPartial is false when every open invoice was loaded", () => {
  const rows = [invoiceRow({ invoiceId: "i1" }), invoiceRow({ invoiceId: "i2" })];
  const summary = buildReceivablesSummary(rows, { overdueInvoiceTotal: 0, openInvoiceTotal: 2 });
  assert.equal(summary.isPartial, false);
});

test("topInvoices ranks by balanceDue descending and respects topCount", () => {
  const rows = [
    invoiceRow({ invoiceId: "small", balanceDue: 100 }),
    invoiceRow({ invoiceId: "large", balanceDue: 900 }),
    invoiceRow({ invoiceId: "medium", balanceDue: 400 }),
  ];

  const summary = buildReceivablesSummary(rows, { overdueInvoiceTotal: 0, openInvoiceTotal: 3 }, 2);

  assert.deepEqual(
    summary.topInvoices.map((row) => row.invoiceId),
    ["large", "medium"],
  );
});

test("an empty invoice set produces zeroed totals, not a crash", () => {
  const summary = buildReceivablesSummary([], { overdueInvoiceTotal: 0, openInvoiceTotal: 0 });
  assert.equal(summary.loadedOutstanding, 0);
  assert.equal(summary.loadedOverdueOutstanding, 0);
  assert.equal(summary.isPartial, false);
  assert.deepEqual(summary.topInvoices, []);
});
