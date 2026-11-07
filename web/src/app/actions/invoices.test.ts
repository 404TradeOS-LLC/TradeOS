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
//
// Manual-line parsing itself moved to manual-invoice-lines.ts, where it is
// executed directly (see manual-invoice-lines.test.ts); the tests below pin
// the action's delegation to that helper and its POST-body contract.

function readInvoicesActionsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "invoices.ts"), "utf8");
}

function readCreateInvoiceActionSource(): string {
  const source = readInvoicesActionsSource();
  const start = source.indexOf("export async function createInvoiceAction");
  assert.notEqual(start, -1, "expected createInvoiceAction to exist");
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function readManualInvoiceLinesSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "manual-invoice-lines.ts"), "utf8");
}

test("createInvoiceAction no longer requires an estimate before calling the API", () => {
  const fnSource = readCreateInvoiceActionSource();
  assert.ok(!fnSource.includes("Select an estimate to bill against."), "the estimate-required guard must be gone");
});

test("createInvoiceAction builds manual line items from indexed form fields when no estimate is selected", () => {
  const fnSource = readCreateInvoiceActionSource();
  const apiCallIndex = fnSource.indexOf("apiFetch");
  assert.notEqual(apiCallIndex, -1, "expected a call to apiFetch");
  // Parsing lives in the testable helper (executed directly by
  // manual-invoice-lines.test.ts); the action delegates to it, then posts
  // the parsed lines with estimateId undefined when no estimate is selected.
  const delegateIndex = fnSource.indexOf("parseManualLineItems(formData)");
  assert.notEqual(delegateIndex, -1, "expected the action to delegate manual parsing to parseManualLineItems");
  assert.ok(delegateIndex < apiCallIndex, "manual parsing must run before the API call");
  const helperSource = readManualInvoiceLinesSource();
  for (const field of ["lineCount", "lineDescription", "lineQuantity", "lineUnitPrice"]) {
    assert.notEqual(helperSource.indexOf(field), -1, `expected the helper to parse the manual ${field} form field`);
  }
  assert.match(fnSource, /lineItems,/);
  assert.match(fnSource, /estimateId:\s*estimateId \|\| undefined/);
});

test("createInvoiceAction requires at least one valid manual line item when no estimate is selected", () => {
  const fnSource = readCreateInvoiceActionSource();
  const apiCallIndex = fnSource.indexOf("apiFetch");
  const errorReturnIndex = fnSource.indexOf('if ("error" in parsed) return { error: parsed.error };');
  assert.notEqual(errorReturnIndex, -1, "expected the action to return the helper's parse error");
  assert.ok(errorReturnIndex < apiCallIndex, "the parse error must return before the API call");
  assert.ok(
    readManualInvoiceLinesSource().includes("Add at least one line item for a manual invoice."),
    "expected a manual line-item required guard in the helper",
  );
});

test("createInvoiceAction validates manual line quantity and unit price before calling the API", () => {
  const helperSource = readManualInvoiceLinesSource();
  const guardIndex = helperSource.indexOf(
    "Enter a description, a quantity greater than zero, and a unit price of zero or more for each line item.",
  );
  assert.notEqual(guardIndex, -1, "expected a manual line-item validation guard in the helper");
  assert.match(helperSource, /quantity <= 0/);
  assert.match(helperSource, /unitPrice < 0/);
});

test("createInvoiceAction keeps the bill-against-estimate path intact", () => {
  const fnSource = readCreateInvoiceActionSource();
  assert.match(fnSource, /proposalId:\s*estimateId && proposalId \? proposalId : undefined/);
  assert.match(fnSource, /Enter a percent complete for a progress invoice\./);
});

function readScaleManualLinesForProgressSource(): string {
  const source = readManualInvoiceLinesSource();
  const start = source.indexOf("function scaleManualLinesForProgress");
  assert.notEqual(start, -1, "expected scaleManualLinesForProgress to exist");
  const next = source.indexOf("export function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("createInvoiceAction rejects a blank manual unit price instead of converting it to zero", () => {
  const helperSource = readManualInvoiceLinesSource();
  const blankPriceIndex = helperSource.indexOf("!unitPriceRaw");
  assert.notEqual(blankPriceIndex, -1, "expected a blank unit price guard in the manual line validation");
  // An explicit zero stays allowed: the guard rejects blank input, not a zero price.
  assert.ok(!helperSource.includes("unitPrice <= 0"), "an explicit zero unit price must remain allowed");
  assert.match(helperSource, /a unit price of zero or more/);
});

test("createInvoiceAction scales manual line quantities and totals by percent complete for progress invoices", () => {
  const fnSource = readCreateInvoiceActionSource();
  const apiCallIndex = fnSource.indexOf("apiFetch");
  const scaleIndex = fnSource.indexOf("scaleManualLinesForProgress(parsed.lines, type, percentComplete)");
  assert.notEqual(scaleIndex, -1, "expected manual lines to pass through progress scaling");
  assert.ok(scaleIndex < apiCallIndex, "progress scaling must run before the API call");
  const helperSource = readScaleManualLinesForProgressSource();
  assert.match(helperSource, /type !== "progress"/);
  assert.match(helperSource, /Number\(percentComplete\) \/ 100/);
  assert.match(helperSource, /quantity \* scale/);
  assert.match(helperSource, /lineTotal: roundCurrency\(quantity \* line\.unitPrice\)/);
});

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
  const apiCallIndex = fnSource.indexOf("apiFetch");
  assert.notEqual(guardIndex, -1, "expected an amount > 0 guard");
  assert.notEqual(apiCallIndex, -1, "expected a call to apiFetch");
  assert.ok(guardIndex < apiCallIndex, "the amount guard must run before the API call");
});

test("recordInvoicePaymentAction requires a payment date and a method before calling the API", () => {
  const fnSource = readRecordInvoicePaymentActionSource();
  const apiCallIndex = fnSource.indexOf("apiFetch");

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

function readUpdateInvoiceActionSource(): string {
  const source = readInvoicesActionsSource();
  const start = source.indexOf("export async function updateInvoiceAction");
  assert.notEqual(start, -1, "expected updateInvoiceAction to exist");
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("updateInvoiceAction parses manual lines only in lines mode and PATCHes the invoice", () => {
  const fnSource = readUpdateInvoiceActionSource();
  assert.match(fnSource, /if \(editMode === "lines"\) \{/);
  assert.match(fnSource, /parseManualLineItems\(formData\)/);
  assert.match(fnSource, /apiFetch\(`\/api\/v1\/invoices\/\$\{invoiceId\}`/);
  assert.match(fnSource, /method:\s*"PATCH"/);
});

test("updateInvoiceAction sends a blank due date as null so it can be cleared", () => {
  const fnSource = readUpdateInvoiceActionSource();
  assert.match(fnSource, /dueDate:\s*dueDate \|\| null/);
});

test("updateInvoiceAction revalidates and redirects back to the invoice detail page only after a successful edit", () => {
  const fnSource = readUpdateInvoiceActionSource();
  const apiCallIndex = fnSource.indexOf("apiFetch");
  const afterApiCall = fnSource.slice(apiCallIndex);
  const catchCloseIndex = afterApiCall.indexOf("}\n\n  revalidatePath");
  assert.notEqual(catchCloseIndex, -1, "expected revalidatePath to run after the try/catch block, not inside it");
  assert.match(afterApiCall, /revalidatePath\(`\/projects\/\$\{projectId\}\/invoices\/\$\{invoiceId\}`\)/);
  assert.match(afterApiCall, /redirect\(`\/projects\/\$\{projectId\}\/invoices\/\$\{invoiceId\}`\)/);
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
  const apiCallIndex = fnSource.indexOf("apiFetch");
  const afterApiCall = fnSource.slice(apiCallIndex);

  // revalidatePath/redirect must appear after the try/catch, not inside it,
  // so a thrown ApiClientError returns { error } instead of redirecting.
  const catchCloseIndex = afterApiCall.indexOf("}\n\n  revalidatePath");
  assert.notEqual(catchCloseIndex, -1, "expected revalidatePath to run after the try/catch block, not inside it");
  assert.match(afterApiCall, /revalidatePath\(`\/projects\/\$\{projectId\}\/invoices\/\$\{id\}`\)/);
  assert.match(afterApiCall, /redirect\(`\/projects\/\$\{projectId\}\/invoices\/\$\{id\}`\)/);
});

test("invoice create and edit actions normalize and reject invalid typed due dates before the API", () => {
  const source = readInvoicesActionsSource();
  const occurrences = source.match(/parseInvoiceDueDate\(String\(formData.get\("dueDate"\)/g) ?? [];
  assert.equal(occurrences.length, 2, "create and edit must both normalize the due date");
  assert.match(source, /if \("error" in parsedDueDate\) return \{ error: parsedDueDate.error \};/);
});
