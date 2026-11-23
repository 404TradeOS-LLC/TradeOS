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
  // DES-7 (c): the portal view is now recorded — the "not recorded" copy is
  // gone; the page shows the viewed time, or that it has not been viewed yet.
  assert.doesNotMatch(source, /Customer-view telemetry is not currently recorded/);
  assert.match(source, /Viewed by the customer \{formatDateTime\(invoice\.viewedAt\)\}\./);
  assert.match(source, /Not viewed by the customer yet/);
});

// DES-7 (a): Send + Open PDF sit near the top on mobile (390px). The top
// action row renders only below `xl`; the aside copies are hidden below
// `xl` so the actions are never rendered twice on the same screen.
test("mobile draft detail leads with Send invoice and Open PDF near the top", async () => {
  const source = await readSource("./page.tsx");
  const topActions = await readSource("./top-actions.tsx");

  assert.match(source, /<InvoiceTopActions isDraft=\{isDraft\} projectId=\{projectId\} invoiceId=\{invoice\.id\} \/>/);
  assert.match(topActions, /aria-label="Invoice actions"/);
  assert.match(topActions, /className="grid gap-2 sm:grid-cols-2 xl:hidden"/);
  assert.match(topActions, /Send invoice/);
  assert.match(topActions, /Open PDF/);
  assert.match(topActions, /\/api\/documents\/invoices\/\$\{invoiceId\}\/pdf/);
  // The top row comes before the financial summary in source order.
  assert.ok(source.indexOf("<InvoiceTopActions") < source.indexOf('aria-label="Invoice financial summary"'));
  // The aside keeps the same actions for desktop only.
  assert.match(source, /<div className="max-xl:hidden">\s*<form action=\{sendInvoiceAction\}>/);
  assert.match(source, /buttonVariants\(\{ variant: "outline", className: "max-xl:hidden" \}\)/);
});

// DES-7 (c): the Viewed state surfaces on the draft detail page once the
// customer has opened the invoice in the portal.
test("viewed invoices surface their viewed time on the detail page", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /invoice\.viewedAt \? \(/);
  assert.match(source, /Viewed \{formatDateTime\(invoice\.viewedAt\)\}/);
});

// DES-7 (d): a failed manual record-payment attempt is the Payment Failure
// state, shown with the recorded reason instead of silently keeping the
// prior state.
test("a failed manual record-payment attempt shows Payment Failure with its reason", async () => {
  const source = await readSource("./page.tsx");
  const form = await readSource("./record-payment-form.tsx");

  assert.match(source, /getLatestPaymentFailure\(invoice\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, />Payment Failure</);
  assert.match(source, /The last attempt to record a payment failed/);
  assert.match(source, /latestPaymentFailure\.reason/);
  assert.match(form, />Payment Failure</);
  assert.match(form, /The invoice balance is unchanged/);
});

test("invoice workspace keeps work performed and activity as the production record surface", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, />Work performed<\/CardTitle>/);
  assert.match(source, /invoice\.lineItems\.map/);
  assert.match(source, /<ActivityTimeline title="Invoice activity" items=\{timeline\} \/>/);
  assert.doesNotMatch(source, /Invoice center|Billing summary|Running balance/);
});


test("zero-dollar drafts keep Send invoice reachable independent of balance", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /const showNextActionPanel = isDraft \|\| \(hasOpenBalance && !isPaid && !isVoided\);/);
  // The aside Send form is desktop-only (the mobile top row carries it
  // below `xl`); the zero-dollar draft still reaches Send either way.
  assert.match(source, /\{isDraft \? \(\s*<div className="max-xl:hidden">\s*<form action=\{sendInvoiceAction\}>/);
  assert.match(source, /Zero-dollar drafts can still be sent/);
});

test("voided invoices never present a collection next action", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /const isVoided = invoice\.status === "voided";/);
  assert.match(source, /showNextActionPanel = isDraft \|\| \(hasOpenBalance && !isPaid && !isVoided\)/);
  assert.match(source, /Invoice voided/);
  assert.match(source, /not presented as money that still needs collection/);
});
