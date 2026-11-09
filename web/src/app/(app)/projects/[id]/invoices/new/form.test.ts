import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No jest/vitest/RTL mock harness exists for `web/`'s client components (see
// actions/invoices.test.ts for the established precedent), so this pins the
// *shape* of NewInvoiceForm rather than rendering it. This is the regression
// pin for the 2026-10-31 staging finding: the new-invoice form required an
// estimate, so no manual invoice could be created through the UI.

function readNewInvoiceFormSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "form.tsx"), "utf8");
}

function readEstimateSelectSource(): string {
  const source = readNewInvoiceFormSource();
  const start = source.indexOf('label="Estimate"');
  assert.notEqual(start, -1, "expected an Estimate select field");
  const end = source.indexOf("</SelectField>", start);
  assert.notEqual(end, -1, "expected the Estimate select field to close");
  return source.slice(start, end);
}

test("NewInvoiceForm does not require an estimate selection", () => {
  const selectSource = readEstimateSelectSource();
  assert.ok(!selectSource.includes("required"), "the Estimate select must not carry required, or the browser blocks manual invoices");
  assert.match(readNewInvoiceFormSource(), /No estimate — manual invoice/);
});

test("NewInvoiceForm renders a manual line-item editor when no estimate is selected", () => {
  const source = readNewInvoiceFormSource();
  assert.match(source, /manualMode = estimateId === ""/);
  assert.match(source, /manualMode && \(/);
  for (const field of ['name="lineCount"', "lineDescription${index}", "lineQuantity${index}", "lineUnitPrice${index}"]) {
    assert.ok(source.includes(field), `expected the form to submit ${field}`);
  }
  assert.match(source, /Add line item/);
  assert.match(source, /Remove line/);
});

test("invoice creation and editing allow typed due dates instead of browser-only date controls", () => {
  const newForm = readNewInvoiceFormSource();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const editForm = fs.readFileSync(path.join(here, "../[invoiceId]/edit/form.tsx"), "utf8");
  for (const source of [newForm, editForm]) {
    assert.match(source, /name="dueDate" type="text" inputMode="text"/);
    assert.match(source, /MM\/DD\/YYYY or YYYY-MM-DD/);
    assert.doesNotMatch(source, /name="dueDate" type="date"/);
  }
});
