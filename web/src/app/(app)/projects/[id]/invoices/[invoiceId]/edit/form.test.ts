import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No jest/vitest/RTL mock harness exists for `web/`'s client components (see
// actions/invoices.test.ts for the established precedent), so this pins the
// *shape* of EditInvoiceForm rather than rendering it. This is the
// regression pin for the 2026-11-01 staging finding: no invoice edit
// surface existed at all, so a saved draft invoice could only be voided and
// recreated when a line was wrong.

function readEditInvoiceFormSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "form.tsx"), "utf8");
}

test("EditInvoiceForm offers line editing only for manual full drafts", () => {
  const source = readEditInvoiceFormSource();
  assert.match(source, /linesEditable = invoice\.type === "full" && invoice\.estimateId === null/);
  assert.match(source, /linesEditable \? \(/);
  assert.match(source, /name="editMode" value=\{linesEditable \? "lines" : "dueDate"\}/);
});

test("EditInvoiceForm renders the manual line editor with the create form's indexed fields", () => {
  const source = readEditInvoiceFormSource();
  for (const field of ['name="lineCount"', "lineDescription${index}", "lineQuantity${index}", "lineUnitPrice${index}"]) {
    assert.ok(source.includes(field), `expected the edit form to submit ${field}`);
  }
  assert.match(source, /Add line item/);
  assert.match(source, /Remove line/);
  assert.match(source, /updateInvoiceAction/);
});

test("EditInvoiceForm keeps progress and estimate-linked lines read-only with an explanation", () => {
  const source = readEditInvoiceFormSource();
  assert.match(source, /Progress invoice lines are scaled from the percent complete and can't be edited directly/);
  assert.match(source, /Line items on this invoice come from its estimate, so they can't be edited here/);
});

test("EditInvoiceForm always offers the due date and saves through the update action", () => {
  const source = readEditInvoiceFormSource();
  assert.match(source, /name="dueDate"/);
  assert.match(source, /Save changes/);
});
