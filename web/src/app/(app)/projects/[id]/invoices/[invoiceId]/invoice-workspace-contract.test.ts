import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("invoice workspace leads with canonical financial truth", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /label="Invoice total"/);
  assert.match(source, /value=\{formatInvoiceCurrency\(invoice\.amount\)\}/);
  assert.match(source, /label="Paid"/);
  assert.match(source, /value=\{formatInvoiceCurrency\(invoice\.paidAmount\)\}/);
  assert.match(source, /label="Balance due"/);
  assert.match(source, /value=\{formatInvoiceCurrency\(invoice\.balanceDue\)\}/);
  assert.doesNotMatch(source, /getInvoiceRunningBalance/);
});

test("invoice workspace keeps Record Payment as the primary open-balance action", async () => {
  const source = await readSource("./page.tsx");
  const form = await readSource("./record-payment-form.tsx");

  assert.match(source, /<CardTitle className="text-base">Next action<\/CardTitle>/);
  assert.match(source, /<RecordPaymentForm projectId=\{projectId\} invoiceId=\{invoice\.id\} balanceDue=\{invoice\.balanceDue\} \/>/);
  assert.match(form, />Record Payment<\/h3>/);
  assert.match(form, /money you have already received/);
  assert.match(form, /pending \? "Recording…" : "Record Payment"/);
});

test("payment recording is explicitly distinct from payment processing", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /Record Payment tracks money received/);
  assert.match(source, /It does not mean TradeOS processed the customer&apos;s payment/);
  assert.doesNotMatch(source, /Pay Now|checkout|paymentIntent|Stripe/);
});

test("manual close and void actions are progressively disclosed", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /<details className=/);
  assert.match(source, />More billing actions<\/summary>/);
  assert.match(source, /Mark paid without recording a payment/);
  assert.match(source, /Void invoice/);
});

test("invoice document actions use the real PDF and staff portal destinations", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /\/api\/documents\/invoices\/\$\{invoice\.id\}\/pdf/);
  assert.match(source, /\/portal\/invoices\/\$\{invoice\.id\}/);
  assert.match(source, /Open PDF/);
  assert.match(source, /Customer Portal/);
  assert.match(source, /Customer-view telemetry is not currently recorded/);
});

test("invoice workspace keeps work performed and activity as the production record surface", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, />Work performed<\/CardTitle>/);
  assert.match(source, /invoice\.lineItems\.map/);
  assert.match(source, /<ActivityTimeline title="Invoice activity" items=\{timeline\} \/>/);
  assert.doesNotMatch(source, /Invoice center|Billing summary|Running balance/);
});
