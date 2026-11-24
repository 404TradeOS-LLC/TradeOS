import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

function priceStage(builder: string): string {
  const start = builder.indexOf('hidden={activeStage !== "price"}');
  assert.notEqual(start, -1, "Price stage must exist");
  const end = builder.indexOf('hidden={activeStage !== "review"}', start);
  assert.notEqual(end, -1, "Review stage must follow the Price stage");
  return builder.slice(start, end);
}

function readinessSignals(builder: string): string {
  const start = builder.indexOf("function PriceReadinessSignals(");
  assert.notEqual(start, -1, "PriceReadinessSignals must exist");
  const end = builder.indexOf("function EstimateDirectCostBreakdown(", start);
  assert.notEqual(end, -1, "EstimateDirectCostBreakdown must follow PriceReadinessSignals");
  return builder.slice(start, end);
}

test("price stage renders the readiness signals above the cost breakdown", async () => {
  const builder = await readSource("./builder.tsx");
  const stage = priceStage(builder);
  assert.match(stage, /<PriceReadinessSignals/);
  assert.match(stage, /lineItems=\{estimate\.lineItems\}/);
  assert.match(stage, /marginPct=\{runningTotals\.marginPct\}/);
  assert.ok(
    stage.indexOf("<PriceReadinessSignals") < stage.indexOf("<EstimateDirectCostBreakdown"),
    "readiness signals must render above the direct-cost breakdown",
  );
  // One responsive stage serves desktop and mobile; the signals live in it.
  assert.match(stage, /onReviewPrices=\{\(\) => void goToStage\("items"\)\}/);
});

test("readiness signals show missing, to-review, and low-margin chips", async () => {
  const builder = await readSource("./builder.tsx");
  const signals = readinessSignals(builder);
  assert.match(signals, /aria-label="Pricing readiness"/);
  assert.match(signals, /aria-label="Price readiness signals"/);
  assert.match(signals, /<Badge variant="destructive">\{summary\.missing\} missing/);
  assert.match(signals, /<Badge variant="outline">\{summary\.toReview\} to review/);
  assert.match(signals, /isLowGrossMargin\(marginPct\)/);
  assert.match(signals, /Low margin: \{formatPercent\(marginPct\)\}/);
  // Chips render only when something needs attention; the omission line always renders.
  // Unchecked lines (readiness lookup never ran) also surface as chips.
  assert.match(signals, /attentionCount > 0 \|\| summary\.unchecked > 0 \|\| lowMargin/);
});

test("readiness attention item names the lines and links back to Items", async () => {
  const builder = await readSource("./builder.tsx");
  const signals = readinessSignals(builder);
  assert.match(signals, /Supplier prices need action/);
  assert.match(signals, /no recorded supplier cost\./);
  assert.match(signals, /summary\.toReview === 1 \? "needs" : "need"/);
  assert.match(signals, /a price review\./);
  assert.match(signals, /role="alert"/);
  assert.match(signals, /Review in Items/);
  assert.match(signals, /onClick=\{onReviewPrices\}/);
});

test("omission check line summarizes the counts, or reports completion", async () => {
  const builder = await readSource("./builder.tsx");
  const signals = readinessSignals(builder);
  assert.match(signals, /Omission check: \$\{summary\.missing\} missing · \$\{summary\.toReview\} to review\./);
  assert.match(signals, /Omission check complete · no missing or stale prices\./);
});

test("omission check reports incomplete when the readiness lookup never ran", async () => {
  const builder = await readSource("./builder.tsx");
  const signals = readinessSignals(builder);
  // Lines without a priceReadiness signal (lookup failed) must not read as
  // a completed check: they surface as an unchecked count and badge.
  assert.match(signals, /summary\.unchecked/);
  assert.match(signals, /\{summary\.unchecked\} unchecked/);
  assert.match(signals, /Omission check incomplete ·/);
  assert.match(signals, /could not be checked/);
  // The completion claim is only the fallback when nothing is unchecked.
  assert.match(signals, /summary\.unchecked > 0\s*\n?\s*\? `Omission check incomplete/);
});

test("direct-cost breakdown carries per-type readiness counts", async () => {
  const builder = await readSource("./builder.tsx");
  const breakdown = builder.slice(builder.indexOf("function EstimateDirectCostBreakdown("));
  assert.match(breakdown, /summarizePriceReadiness\(lineItems\)/);
  assert.match(breakdown, /priceReadinessCountsFor\(readiness, item\.type\)/);
  assert.match(breakdown, /\$\{counts\.missing\} missing/);
  assert.match(breakdown, /\$\{counts\.toReview\} to review/);
  // A failed readiness lookup must not read as complete in the breakdown
  // either: unchecked lines surface per cost type.
  assert.match(breakdown, /\$\{counts\.unchecked\} unchecked/);
});

test("price stage low-margin flag uses the shared 10% threshold, not a local number", async () => {
  const builder = await readSource("./builder.tsx");
  assert.match(builder, /import \{ isLowGrossMargin, priceReadinessCountsFor, summarizePriceReadiness \} from "@\/lib\/estimate-price-readiness";/);
  assert.doesNotMatch(priceStage(builder), /marginPct < 10/);
  const lib = await readSource("../../../../../../lib/estimate-price-readiness.ts");
  assert.match(lib, /LOW_GROSS_MARGIN_THRESHOLD_PCT = 10/);
});

test("line items carry the backend price-readiness signal into the builder", async () => {
  const builder = await readSource("./builder.tsx");
  assert.match(builder, /priceReadiness\?: EstimateLinePriceReadiness;/);
  assert.match(builder, /import type \{ Estimate, EstimateLinePriceReadiness \} from "@\/lib\/api";/);
});

test("tax warning is untouched by the readiness signals", async () => {
  const builder = await readSource("./builder.tsx");
  assert.match(
    builder,
    /A tax rate is set, but no estimate line is marked taxable\. Tax will calculate to \$0\.00 until you mark the applicable line items as taxable\./,
  );
  // The readiness section must not mention tax: it is a separate signal.
  const signals = readinessSignals(builder);
  assert.doesNotMatch(signals, /tax/i);
});
