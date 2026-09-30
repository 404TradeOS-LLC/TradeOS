import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPriceDelta,
  freshnessInDays,
  freshnessLabel,
  getResearchReviewCapabilities,
  isOpenForReview,
  isPromotable,
  matchStatusLabel,
  provenanceExplanation,
  provenanceLabel,
  reviewStatusBadgeToken,
  reviewStatusLabel,
} from "./research-review-model.ts";

test("read-only Costbook roles get no review or promote controls", () => {
  assert.deepEqual(getResearchReviewCapabilities(false, false), {
    canIngest: false,
    canReview: false,
    canPromote: false,
    showActions: false,
  });
});

test("costbook.write alone may submit a candidate but never decide on one", () => {
  assert.deepEqual(getResearchReviewCapabilities(true, false), {
    canIngest: true,
    canReview: false,
    canPromote: false,
    showActions: false,
  });
});

test("costbook.manage may review and promote", () => {
  assert.deepEqual(getResearchReviewCapabilities(true, true), {
    canIngest: true,
    canReview: true,
    canPromote: true,
    showActions: true,
  });
});

test("only undecided candidates are open for review", () => {
  assert.equal(isOpenForReview({ reviewStatus: "candidate" }), true);
  assert.equal(isOpenForReview({ reviewStatus: "needs-review" }), true);
  assert.equal(isOpenForReview({ reviewStatus: "approved" }), false);
  assert.equal(isOpenForReview({ reviewStatus: "rejected" }), false);
});

test("only an approved, not-yet-promoted candidate is promotable", () => {
  assert.equal(isPromotable({ reviewStatus: "approved", promotedCostItemId: null }), true);
  assert.equal(isPromotable({ reviewStatus: "approved", promotedCostItemId: "cost-item-1" }), false);
  assert.equal(isPromotable({ reviewStatus: "candidate", promotedCostItemId: null }), false);
  assert.equal(isPromotable({ reviewStatus: "rejected", promotedCostItemId: null }), false);
});

test("a rejected candidate is never promotable, which keeps rejection durable in the UI", () => {
  assert.equal(isPromotable({ reviewStatus: "rejected", promotedCostItemId: null }), false);
  assert.equal(isOpenForReview({ reviewStatus: "rejected" }), false);
});

test("provenance labels never claim a price is verified or current", () => {
  for (const status of ["documented", "unverified-legacy", "placeholder"] as const) {
    const label = provenanceLabel(status);
    const explanation = provenanceExplanation(status);
    assert.doesNotMatch(label, /\bverified\b/i, `${status} label must not read as verified`);
    assert.doesNotMatch(explanation, /current market pricing\b(?!\.)/i);
  }
  assert.match(provenanceLabel("unverified-legacy"), /Unverified/);
  assert.match(provenanceExplanation("documented"), /Not a claim of current local market pricing/);
  assert.match(provenanceExplanation("placeholder"), /stand-in/);
});

test("review statuses map onto contractor-legible labels", () => {
  assert.equal(reviewStatusLabel("candidate"), "New");
  assert.equal(reviewStatusLabel("needs-review"), "Needs review");
  assert.equal(reviewStatusLabel("approved"), "Approved");
  assert.equal(reviewStatusLabel("rejected"), "Rejected");
});

test("review statuses map onto known StatusBadge tones", () => {
  assert.equal(reviewStatusBadgeToken("approved"), "approved");
  assert.equal(reviewStatusBadgeToken("rejected"), "rejected");
  assert.equal(reviewStatusBadgeToken("needs-review"), "needs_attention");
  assert.equal(reviewStatusBadgeToken("candidate"), "pending");
});

test("match statuses are stated plainly, including the ones that block promotion", () => {
  assert.equal(matchStatusLabel("new-candidate"), "No existing match");
  assert.equal(matchStatusLabel("probable-match"), "Probable match");
  assert.equal(matchStatusLabel("ambiguous-match"), "Ambiguous match");
  assert.equal(matchStatusLabel("conflict"), "Unit conflict");
});

test("price deltas are signed and show a percentage when one exists", () => {
  assert.equal(formatPriceDelta(0.5, 25), "+$0.50 (+25.0%)");
  assert.equal(formatPriceDelta(-0.5, -25), "-$0.50 (-25.0%)");
});

test("a delta with no comparable percentage omits it rather than inventing one", () => {
  assert.equal(formatPriceDelta(3, null), "+$3.00");
});

test("nothing is shown when there is no current price to compare against", () => {
  assert.equal(formatPriceDelta(null, null), null);
});

test("freshness is measured in whole days from the source's own observation date", () => {
  const now = new Date("2026-09-12T00:00:00.000Z");
  assert.equal(freshnessInDays("2026-09-12", now), 0);
  assert.equal(freshnessInDays("2026-09-11", now), 1);
  assert.equal(freshnessInDays("2026-09-01", now), 11);
});

test("freshness reports unknown rather than guessing for an unparseable date", () => {
  assert.equal(freshnessInDays("not-a-date"), null);
  assert.equal(freshnessLabel("not-a-date"), "Unknown");
});

test("stale research is labelled in plain language", () => {
  const now = new Date("2026-09-12T00:00:00.000Z");
  assert.equal(freshnessLabel("2026-09-12", now), "Today");
  assert.equal(freshnessLabel("2026-09-11", now), "1 day old");
  assert.equal(freshnessLabel("2026-06-01", now), "103 days old");
  assert.equal(freshnessLabel("2024-01-01", now), "Over 2 years old");
});
