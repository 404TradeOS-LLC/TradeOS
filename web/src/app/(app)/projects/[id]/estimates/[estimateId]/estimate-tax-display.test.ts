import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

function pricingPanel(builder: string): string {
  const start = builder.indexOf("function PricingPanel(");
  assert.notEqual(start, -1, "PricingPanel must exist");
  return builder.slice(start);
}

test("price stage pricing summary renders the computed tax breakdown", async () => {
  const builder = await readSource("./builder.tsx");
  const panel = pricingPanel(builder);
  const summary = panel.slice(panel.indexOf("Current gross profit"));
  assert.notEqual(summary.indexOf("Current gross profit"), -1, "summary block must exist");
  // Pre-tax + tax = customer total, reading the saved server snapshot only.
  assert.match(summary, /Pre-tax total/);
  assert.match(summary, /formatCurrency\(preTaxTotalPrice\)/);
  assert.match(summary, /Tax\{estimate\.taxPct \? ` \(\$\{estimate\.taxPct\}%\)` : ""\}/);
  assert.match(summary, /formatCurrency\(estimate\.taxAmount \?\? 0\)/);
  assert.match(summary, /Customer total/);
  assert.match(summary, /formatCurrency\(estimate\.totalPrice\)/);
  // Display only: the panel must not recompute tax itself.
  assert.doesNotMatch(summary, /taxableJobCost|estimateTaxAmount|taxPct \/ 100/);
});

test("price stage tax row uses the existing summary row style", async () => {
  const builder = await readSource("./builder.tsx");
  const panel = pricingPanel(builder);
  const summary = panel.slice(panel.indexOf("Current gross profit"));
  assert.match(summary, /border-t border-border\/70 pt-2/);
  assert.match(summary, /<span className="text-muted-foreground">Tax/);
  assert.match(summary, /<span className="font-medium">\{formatCurrency\(estimate\.taxAmount \?\? 0\)\}<\/span>/);
});

test("review stage renders the same pre-tax, tax, and total breakdown", async () => {
  const builder = await readSource("./builder.tsx");
  const review = builder.slice(builder.indexOf('hidden={activeStage !== "review"}'));
  assert.match(review, /Pre-tax total/);
  assert.match(review, /formatCurrency\(runningTotals\.preTaxTotalPrice\)/);
  assert.match(review, /<span className="text-muted-foreground">Tax<\/span>/);
  assert.match(review, /formatCurrency\(runningTotals\.taxAmount\)/);
  assert.match(review, /Estimate total/);
  assert.match(review, /formatCurrency\(runningTotals\.totalPrice\)/);
  // The breakdown must read above the total row so pre-tax + tax = total reads in order.
  assert.ok(
    review.indexOf("Pre-tax total") < review.indexOf("Estimate total") &&
      review.indexOf(">Tax<") < review.indexOf("Estimate total"),
    "breakdown rows must precede the estimate total row",
  );
});

test("zero-tax estimates still render the breakdown without contradicting the taxable warning", async () => {
  const builder = await readSource("./builder.tsx");
  // The warning for "tax rate set but no line marked taxable" must survive unchanged.
  assert.match(
    builder,
    /A tax rate is set, but no estimate line is marked taxable\. Tax will calculate to \$0\.00 until you mark the applicable line items as taxable\./,
  );
  // The tax row is unconditional (no taxPct/taxable gate), so $0.00 renders
  // instead of the breakdown vanishing when nothing is taxable.
  const panel = pricingPanel(builder);
  const summary = panel.slice(panel.indexOf("Current gross profit"));
  const taxRow = summary.slice(summary.indexOf("Tax{"));
  assert.doesNotMatch(taxRow.slice(0, 200), /hasTaxableLineItems|estimate\.taxPct > 0/);
});
