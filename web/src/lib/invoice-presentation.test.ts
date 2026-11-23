import test from "node:test";
import assert from "node:assert/strict";
import { getInvoiceDisplayStatus, getInvoiceRunningBalance, getLatestPaymentFailure } from "./invoice-presentation.ts";

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

// DES-7 (d): Payment Failure is a failed manual record-payment attempt,
// surfaced while it is the latest payment outcome.
test("a failed manual record-payment attempt surfaces Payment Failure with its reason", () => {
  const invoice = {
    deliveries: [
      { eventType: "invoice.sent", occurredAt: "2026-11-20T12:00:00.000Z", metadata: null },
      {
        eventType: "invoice.payment_failed",
        occurredAt: "2026-11-21T12:00:00.000Z",
        metadata: { reason: "Invoice must be sent before a payment can be recorded" },
      },
    ],
    payments: [],
  };

  assert.deepEqual(getLatestPaymentFailure(invoice), {
    reason: "Invoice must be sent before a payment can be recorded",
    at: "2026-11-21T12:00:00.000Z",
  });
});

test("a later successful recorded payment supersedes Payment Failure", () => {
  const invoice = {
    deliveries: [
      { eventType: "invoice.payment_failed", occurredAt: "2026-11-21T12:00:00.000Z", metadata: { reason: "Something went wrong." } },
      { eventType: "invoice.paid", occurredAt: "2026-11-22T12:00:00.000Z", metadata: null },
    ],
    payments: [{ createdAt: "2026-11-22T12:00:00.000Z" }],
  };

  assert.equal(getLatestPaymentFailure(invoice), null);
});

test("no payment failure is shown when no record attempt failed", () => {
  assert.equal(getLatestPaymentFailure({ deliveries: [], payments: [] }), null);
  assert.equal(getLatestPaymentFailure({}), null);
});

test("the latest failed attempt wins when several record attempts failed", () => {
  const invoice = {
    deliveries: [
      { eventType: "invoice.payment_failed", occurredAt: "2026-11-21T12:00:00.000Z", metadata: { reason: "First failure." } },
      { eventType: "invoice.payment_failed", occurredAt: "2026-11-22T12:00:00.000Z", metadata: { reason: "Second failure." } },
    ],
    payments: [],
  };

  assert.deepEqual(getLatestPaymentFailure(invoice), { reason: "Second failure.", at: "2026-11-22T12:00:00.000Z" });
});
