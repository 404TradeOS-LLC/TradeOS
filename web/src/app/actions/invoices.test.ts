import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No jest/vitest/RTL/mock harness exists for `web/`'s Server Actions (see
// actions/auth.test.ts and actions/projects.test.ts for the established
// precedent), so this pins the *shape* of recordInvoicePaymentAction rather
// than executing it. This is the beta-critical "record a payment" action:
// it had zero test coverage before this file, even though it is the last
// step of the estimate -> proposal -> contract -> invoice -> payment
// vertical a beta contractor completes.

function readInvoicesActionsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "invoices.ts"), "utf8");
}

function readRecordInvoicePaymentActionSource(): string {
  const source = readInvoicesActionsSource();
  const start = source.indexOf("export async function recordInvoicePaymentAction");
  assert.notEqual(start, -1, "expected recordInvoicePaymentAction to exist");
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("recordInvoicePaymentAction rejects a non-positive or missing amount before calling the API", () => {
  const fnSource = readRecordInvoicePaymentActionSource();
  const guardIndex = fnSource.indexOf("if (!Number.isFinite(amount) || amount <= 0)");
  const apiCallIndex = fnSource.indexOf("apiFetch(");
  assert.notEqual(guardIndex, -1, "expected an amount > 0 guard");
  assert.notEqual(apiCallIndex, -1, "expected a call to apiFetch");
  assert.ok(guardIndex < apiCallIndex, "the amount guard must run before the API call");
});

test("recordInvoicePaymentAction requires a payment date and a method before calling the API", () => {
  const fnSource = readRecordInvoicePaymentActionSource();
  const apiCallIndex = fnSource.indexOf("apiFetch(");

  const dateGuardIndex = fnSource.indexOf("if (!paymentDate)");
  const methodGuardIndex = fnSource.indexOf("if (!method)");
  assert.notEqual(dateGuardIndex, -1, "expected a paymentDate guard");
  assert.notEqual(methodGuardIndex, -1, "expected a method guard");
  assert.ok(dateGuardIndex < apiCallIndex && methodGuardIndex < apiCallIndex, "both guards must run before the API call");
});

test("recordInvoicePaymentAction posts to the invoice payments endpoint with the full payment payload", () => {
  const fnSource = readRecordInvoicePaymentActionSource();
  assert.match(fnSource, /apiFetch\(`\/api\/v1\/invoices\/\$\{id\}\/payments`,/);
  assert.match(fnSource, /method:\s*"POST"/);
  assert.match(fnSource, /token:\s*token\s*\?\?\s*undefined/);
  assert.match(fnSource, /amount,/);
  assert.match(fnSource, /paymentDate:\s*`\$\{paymentDate\}T00:00:00\.000Z`/);
  assert.match(fnSource, /method,/);
  assert.match(fnSource, /reference:\s*reference\s*\|\|\s*undefined/);
  assert.match(fnSource, /notes:\s*notes\s*\|\|\s*undefined/);
});

test("recordInvoicePaymentAction surfaces the backend's ApiClientError message instead of a generic failure", () => {
  const fnSource = readRecordInvoicePaymentActionSource();
  const catchIndex = fnSource.indexOf("} catch (err) {");
  assert.notEqual(catchIndex, -1, "expected a catch block around the payment API call");
  const catchBody = fnSource.slice(catchIndex);
  assert.match(catchBody, /return\s*\{\s*error:\s*err instanceof ApiClientError \? err\.message : "Something went wrong\."\s*\}/);
});

test("recordInvoicePaymentAction revalidates and redirects back to the invoice detail page only after a successful payment", () => {
  const fnSource = readRecordInvoicePaymentActionSource();
  const apiCallIndex = fnSource.indexOf("apiFetch(");
  const afterApiCall = fnSource.slice(apiCallIndex);

  // revalidatePath/redirect must appear after the try/catch, not inside it,
  // so a thrown ApiClientError returns { error } instead of redirecting.
  const catchCloseIndex = afterApiCall.indexOf("}\n\n  revalidatePath");
  assert.notEqual(catchCloseIndex, -1, "expected revalidatePath to run after the try/catch block, not inside it");
  assert.match(afterApiCall, /revalidatePath\(`\/projects\/\$\{projectId\}\/invoices\/\$\{id\}`\)/);
  assert.match(afterApiCall, /redirect\(`\/projects\/\$\{projectId\}\/invoices\/\$\{id\}`\)/);
});
