import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./page.tsx", import.meta.url);

async function readSource() {
  return readFile(sourceUrl, "utf8");
}

test("customer portal project is document-focused and uses only the existing public project DTO", async () => {
  const source = await readSource();

  assert.match(source, /getPortalProject\(id\)/);
  assert.match(source, /project\.proposals\[0\]/);
  assert.match(source, /project\.contracts\[0\]/);
  assert.match(source, /project\.invoices\.map/);
  assert.doesNotMatch(source, /clientFetch|apiFetch|fetch\(/);
  assert.doesNotMatch(source, /listJobs|listSchedule|changeOrder|sendMessage|createMessage|messageMutation/i);
});

test("proposal stays read-only while pending contract gets the real signature destination", async () => {
  const source = await readSource();

  assert.match(source, /Public proposal review is read-only in the current portal/);
  assert.match(source, /contractNeedsSignature/);
  assert.match(source, /Review & Sign Contract/);
  assert.match(source, /\/customer-portal\/contracts\/\$\{contract\.id\}/);
  assert.doesNotMatch(source, /Accept proposal|Decline proposal|proposal.*mutation/i);
});

test("portal money summary uses server-derived invoice truth and does not invent payment processing", async () => {
  const source = await readSource();

  assert.match(source, /invoice\.paidAmount/);
  assert.match(source, /invoice\.balanceDue/);
  assert.match(source, /invoice\.payments\.length/);
  assert.match(source, /Payment history is shown; public payment processing is not available/);
  assert.match(source, /Pay Now are not current public portal capabilities/);
  assert.doesNotMatch(source, /stripe|checkout|paymentIntent|createPayment|recordPaymentAction/i);
});

test("portal project explicitly communicates the current capability boundary", async () => {
  const source = await readSource();

  assert.match(source, /Secure customer session/);
  assert.match(source, /Only items your contractor has shared appear here/);
  assert.match(source, /Messaging, project progress\/photos, schedule updates, customer change-order approval, and Pay Now are not current public portal capabilities/);
});

test("portal project follows the canonical responsive document-workspace composition", async () => {
  const source = await readSource();

  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.match(source, /Shared documents/);
  assert.match(source, /Project documents/);
  assert.match(source, />Money</);
  assert.match(source, /TradeOS Customer Portal/);
});

test("voided invoices remain visible documents but are excluded from current Money totals", async () => {
  const source = await readSource();

  assert.match(source, /const activeInvoices = project\.invoices\.filter\(\(invoice\) => invoice\.status !== "voided"\)/);
  assert.match(source, /const balanceDue = activeInvoices\.reduce/);
  assert.match(source, /Voided invoices remain in document history but are excluded from the current Money totals/);
  assert.match(source, /project\.invoices\.map/);
});

test("voided contracts are never described as signed agreements", async () => {
  const source = await readSource();

  assert.match(source, /contract\.status === "signed"/);
  assert.match(source, /This contract was voided and is retained for document history/);
});
