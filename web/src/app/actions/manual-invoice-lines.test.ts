import test from "node:test";
import assert from "node:assert/strict";
import {
  MANUAL_LINE_REQUIRED_ERROR,
  MANUAL_LINE_VALIDATION_ERROR,
  parseManualLineItems,
  scaleManualLinesForProgress,
} from "./manual-invoice-lines.ts";

// The manual-line transformation is pure and has no Next.js imports, so
// unlike createInvoiceAction itself it can be executed directly against
// real FormData. This is the testable-helper coverage CodeRabbit asked for
// on the manual invoice payload: a valid manual form parses to lineItems,
// and the action posts those lines with estimateId undefined (pinned by
// the shape test in invoices.test.ts, since the action cannot execute).

type Row = { description?: string; quantity?: string; unitPrice?: string };

function manualForm(rows: Row[]): FormData {
  const formData = new FormData();
  formData.set("lineCount", String(rows.length));
  rows.forEach((row, index) => {
    formData.set(`lineDescription${index}`, row.description ?? "");
    formData.set(`lineQuantity${index}`, row.quantity ?? "");
    formData.set(`lineUnitPrice${index}`, row.unitPrice ?? "");
  });
  return formData;
}

test("parseManualLineItems parses a valid manual form into line items", () => {
  const parsed = parseManualLineItems(
    manualForm([
      { description: "Deep clean bathtub", quantity: "1", unitPrice: "135" },
      { description: "Scrub tile flooring", quantity: "150", unitPrice: "1.17" },
    ]),
  );
  assert.ok(!("error" in parsed), "a valid manual form must parse without error");
  assert.deepEqual(parsed.lines, [
    { description: "Deep clean bathtub", quantity: 1, unitOfMeasure: "each", unitPrice: 135 },
    { description: "Scrub tile flooring", quantity: 150, unitOfMeasure: "each", unitPrice: 1.17 },
  ]);
});

test("parseManualLineItems skips an untouched row carrying the form default quantity", () => {
  // The form starts every manual editor with one EMPTY_LINE row
  // (description "", quantity "1", unitPrice ""). That row carries no
  // billable information, so it must be skipped rather than failing the
  // whole submission — the previous all-three-blank skip check missed it
  // because the default "1" quantity is truthy.
  const parsed = parseManualLineItems(
    manualForm([
      { description: "Install GFCI cover", quantity: "1", unitPrice: "25" },
      { description: "", quantity: "1", unitPrice: "" },
    ]),
  );
  assert.ok(!("error" in parsed), "an untouched trailing row must not fail parsing");
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.lines[0].description, "Install GFCI cover");
});

test("parseManualLineItems rejects a form of only untouched rows", () => {
  const parsed = parseManualLineItems(manualForm([{ description: "", quantity: "1", unitPrice: "" }]));
  assert.ok("error" in parsed);
  assert.equal(parsed.error, MANUAL_LINE_REQUIRED_ERROR);
});

test("parseManualLineItems rejects a description with a blank unit price instead of converting it to zero", () => {
  const parsed = parseManualLineItems(manualForm([{ description: "Paint ceiling fan", quantity: "1", unitPrice: "" }]));
  assert.ok("error" in parsed);
  assert.equal(parsed.error, MANUAL_LINE_VALIDATION_ERROR);
});

test("parseManualLineItems keeps an explicit zero unit price", () => {
  const parsed = parseManualLineItems(manualForm([{ description: "Warranty touch-up", quantity: "1", unitPrice: "0" }]));
  assert.ok(!("error" in parsed), "an explicit zero price stays allowed");
  assert.equal(parsed.lines[0].unitPrice, 0);
});

test("parseManualLineItems rejects a priced row with no description and a row with no quantity", () => {
  const pricedNoDescription = parseManualLineItems(manualForm([{ description: "", quantity: "1", unitPrice: "25" }]));
  assert.ok("error" in pricedNoDescription);
  assert.equal(pricedNoDescription.error, MANUAL_LINE_VALIDATION_ERROR);
  const noQuantity = parseManualLineItems(manualForm([{ description: "Paint fan", quantity: "", unitPrice: "25" }]));
  assert.ok("error" in noQuantity);
  assert.equal(noQuantity.error, MANUAL_LINE_VALIDATION_ERROR);
});

test("parseManualLineItems rejects more than 100 lines", () => {
  const rows: Row[] = Array.from({ length: 101 }, (_, index) => ({
    description: `Line ${index}`,
    quantity: "1",
    unitPrice: "1",
  }));
  const parsed = parseManualLineItems(manualForm(rows));
  assert.ok("error" in parsed);
  assert.equal(parsed.error, MANUAL_LINE_REQUIRED_ERROR);
});

test("scaleManualLinesForProgress scales a manual line by percent complete", () => {
  const parsed = parseManualLineItems(manualForm([{ description: "Clean windows", quantity: "1", unitPrice: "100" }]));
  assert.ok(!("error" in parsed));
  const scaled = scaleManualLinesForProgress(parsed.lines, "progress", "25");
  assert.equal(scaled[0].quantity, 0.25);
  assert.equal(scaled[0].lineTotal, 25);
});

test("scaleManualLinesForProgress keeps line totals summing exactly to the scaled total", () => {
  const parsed = parseManualLineItems(
    manualForm([
      { description: "A", quantity: "1", unitPrice: "10" },
      { description: "B", quantity: "1", unitPrice: "10" },
      { description: "C", quantity: "1", unitPrice: "10" },
    ]),
  );
  assert.ok(!("error" in parsed));
  const scaled = scaleManualLinesForProgress(parsed.lines, "progress", "33");
  const total = scaled.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  // Round the sum to cents before comparing: 3.30 + 3.30 + 3.30 is
  // 9.899999999999999 in binary floating point, not exactly 9.9.
  assert.equal(Math.round((total + Number.EPSILON) * 100) / 100, 9.9);
});

test("scaleManualLinesForProgress passes full invoices and invalid percentages through untouched", () => {
  const parsed = parseManualLineItems(manualForm([{ description: "Clean windows", quantity: "2", unitPrice: "50" }]));
  assert.ok(!("error" in parsed));
  assert.deepEqual(scaleManualLinesForProgress(parsed.lines, "full", "25"), parsed.lines);
  assert.deepEqual(scaleManualLinesForProgress(parsed.lines, "progress", "not-a-number"), parsed.lines);
});
