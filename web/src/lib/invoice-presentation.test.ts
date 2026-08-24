import test from "node:test";
import assert from "node:assert/strict";
import { getInvoiceDisplayStatus, getInvoiceRunningBalance } from "./invoice-presentation.ts";

const now = Date.parse("2026-08-24T12:00:00.000Z");

test("uses server-derived paid amount and balance for a partial invoice", () => {
  const invoice = { status: "sent", paidAmount: 400, balanceDue: 600, dueDate: "2026-09-01T00:00:00.000Z" };

  assert.equal(getInvoiceRunningBalance(invoice), 600);
  assert.equal(getInvoiceDisplayStatus(invoice, now), "partially_paid");
});

test("overdue is derived only when a positive server balance remains", () => {
  const invoice = { status: "sent", paidAmount: 1000, balanceDue: 0, dueDate: "2026-08-01T00:00:00.000Z" };

  assert.equal(getInvoiceDisplayStatus(invoice, now), "paid");
});

test("persisted paid remains authoritative even when no payment row is present", () => {
  const invoice = { status: "paid", paidAmount: 0, balanceDue: 0, dueDate: "2026-08-01T00:00:00.000Z" };

  assert.equal(getInvoiceDisplayStatus(invoice, now), "paid");
  assert.equal(getInvoiceRunningBalance(invoice), 0);
});

test("zero-dollar draft does not become paid from a zero balance", () => {
  const invoice = { status: "draft", paidAmount: 0, balanceDue: 0, dueDate: null };

  assert.equal(getInvoiceDisplayStatus(invoice, now), "draft");
});

test("overpayment remains paid only when recorded payment exists and displays zero due", () => {
  const invoice = { status: "voided", paidAmount: 125, balanceDue: 0, dueDate: null };

  assert.equal(getInvoiceDisplayStatus(invoice, now), "voided");
  assert.equal(getInvoiceRunningBalance(invoice), 0);
});

test("raw void status remains voided instead of becoming overdue", () => {
  const invoice = { status: "void", paidAmount: 0, balanceDue: 100, dueDate: "2026-08-01T00:00:00.000Z" };

  assert.equal(getInvoiceDisplayStatus(invoice, now), "voided");
});
