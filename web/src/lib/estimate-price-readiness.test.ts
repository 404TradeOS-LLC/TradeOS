import assert from "node:assert/strict";
import test from "node:test";
import {
  LOW_GROSS_MARGIN_THRESHOLD_PCT,
  isLowGrossMargin,
  priceReadinessCountsFor,
  summarizePriceReadiness,
  type PriceReadinessLine,
} from "./estimate-price-readiness.ts";

const line = (partial: Partial<PriceReadinessLine>): PriceReadinessLine => ({
  priceReadiness: null,
  costType: "material",
  description: "Line",
  ...partial,
});

test("low-margin threshold is 10% gross margin", () => {
  assert.equal(LOW_GROSS_MARGIN_THRESHOLD_PCT, 10);
  assert.equal(isLowGrossMargin(9.9), true);
  assert.equal(isLowGrossMargin(0), true);
  assert.equal(isLowGrossMargin(-4), true);
  assert.equal(isLowGrossMargin(10), false);
  assert.equal(isLowGrossMargin(28.9), false);
  assert.equal(isLowGrossMargin(Number.NaN), false);
});

test("summary counts missing and to-review lines separately", () => {
  const summary = summarizePriceReadiness([
    line({ priceReadiness: "missing", description: "Sink" }),
    line({ priceReadiness: "missing", description: "Paint" }),
    line({ priceReadiness: "unverified", description: "Faucet" }),
    line({ priceReadiness: "warn", description: "Pipe" }),
    line({ priceReadiness: "reject", description: "Wire" }),
    line({ priceReadiness: "current", description: "Lumber" }),
    line({ priceReadiness: null, description: "Labor" }),
    line({ description: "Unevaluated custom" }),
    line({ priceReadiness: undefined, description: "Failed lookup" }),
  ]);
  assert.equal(summary.total, 9);
  assert.equal(summary.missing, 2);
  assert.equal(summary.unverified, 1);
  assert.equal(summary.stale, 2);
  assert.equal(summary.toReview, 3);
  assert.equal(summary.unchecked, 1);
  assert.deepEqual(summary.missingLines, ["Sink", "Paint"]);
  assert.deepEqual(summary.toReviewLines, ["Faucet", "Pipe", "Wire"]);
  assert.deepEqual(summary.uncheckedLines, ["Failed lookup"]);
});

test("summary distinguishes unchecked lines from lines with no supplier signal", () => {
  const summary = summarizePriceReadiness([
    // undefined: the readiness lookup failed, so the line was never checked.
    line({ priceReadiness: undefined, description: "Lookup failed", costType: "material" }),
    // null: no supplier price backs the line, so no signal applies.
    line({ priceReadiness: null, description: "Custom labor", costType: "labor" }),
  ]);
  assert.equal(summary.unchecked, 1);
  assert.deepEqual(summary.uncheckedLines, ["Lookup failed"]);
  assert.equal(summary.missing, 0);
  assert.equal(summary.toReview, 0);
  assert.deepEqual(priceReadinessCountsFor(summary, "material"), { missing: 0, toReview: 0, unchecked: 1 });
  assert.deepEqual(priceReadinessCountsFor(summary, "labor"), { missing: 0, toReview: 0, unchecked: 0 });
});

test("summary is empty when no line needs a review", () => {
  const summary = summarizePriceReadiness([
    line({ priceReadiness: "current" }),
    line({ priceReadiness: null }),
    line({}),
  ]);
  assert.equal(summary.missing, 0);
  assert.equal(summary.toReview, 0);
  assert.equal(summary.unchecked, 0);
  assert.deepEqual(summary.missingLines, []);
  assert.deepEqual(summary.toReviewLines, []);
  assert.deepEqual(summary.uncheckedLines, []);
  assert.deepEqual(summary.byCostType, {});
});

test("summary groups counts by cost type for the breakdown", () => {
  const summary = summarizePriceReadiness([
    line({ priceReadiness: "missing", costType: "material" }),
    line({ priceReadiness: "warn", costType: "material" }),
    line({ priceReadiness: "reject", costType: "labor" }),
    line({ priceReadiness: "current", costType: "labor" }),
  ]);
  assert.deepEqual(priceReadinessCountsFor(summary, "material"), { missing: 1, toReview: 1, unchecked: 0 });
  assert.deepEqual(priceReadinessCountsFor(summary, "labor"), { missing: 0, toReview: 1, unchecked: 0 });
  assert.deepEqual(priceReadinessCountsFor(summary, "equipment"), { missing: 0, toReview: 0, unchecked: 0 });
});
