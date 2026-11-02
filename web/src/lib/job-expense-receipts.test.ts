import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildExpenseReceiptPath, isExpenseReceiptPath,
  validateExpenseReceiptBytes,
} from "./job-expense-receipts.ts";

const ORG = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const EXPENSE = "33333333-3333-4333-8333-333333333333";
const OBJECT = "44444444-4444-4444-8444-444444444444";

test("receipt path is confined to exact organization, job and expense", () => {
  const path = buildExpenseReceiptPath(ORG, JOB, EXPENSE, "application/pdf", OBJECT);
  assert.ok(isExpenseReceiptPath(ORG, JOB, EXPENSE, "application/pdf", path));
  assert.equal(isExpenseReceiptPath(ORG, JOB, OBJECT, "application/pdf", path), false);
  assert.equal(isExpenseReceiptPath(JOB, JOB, EXPENSE, "application/pdf", path), false);
  assert.equal(isExpenseReceiptPath(ORG, JOB, EXPENSE, "image/png", path), false);
  assert.equal(isExpenseReceiptPath(ORG, JOB, EXPENSE, "application/pdf", path + "/extra"), false);
});

test("accepts a small PDF with real PDF magic bytes", () => {
  const file = validateExpenseReceiptBytes("receipt.pdf", "application/pdf", new Uint8Array([37, 80, 68, 70, 45, 49]));
  assert.equal(file.contentType, "application/pdf");
  assert.equal(file.sizeBytes, 6);
});

test("rejects mismatched formats and executable files", () => {
  assert.throws(() => validateExpenseReceiptBytes("receipt.pdf", "application/pdf", new Uint8Array([1,2,3,4,5,6])), /content/);
  assert.throws(() => validateExpenseReceiptBytes("receipt.html", "text/html", new Uint8Array([37,80,68,70,45])), /JPEG/);
  assert.throws(() => validateExpenseReceiptBytes("receipt.jpg", "application/pdf", new Uint8Array([37,80,68,70,45])), /extension/);
});

test("Next server-action body limit permits a full receipt plus multipart overhead", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /bodySizeLimit:\\s*["']7mb["']/);
});
