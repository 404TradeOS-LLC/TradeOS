import assert from "node:assert/strict";
import { test } from "node:test";
import { generationIdForReviewer, selectAcceptedDraftLines, toggleDraftLineSelection } from "./review-selection.ts";

const lines = [
  { draftLineItemId: "paint", targetId: "cost-1", reviewToken: "token-1", lineCost: 125.5 },
  { draftLineItemId: "prep", targetId: "cost-2", reviewToken: "token-2", lineCost: 44.25 },
  { draftLineItemId: "unresolved", targetId: null, reviewToken: null, lineCost: 80 },
];

test("draft lines require individual inclusion and preview and apply share the same selection", () => {
  const initiallyIncluded: string[] = [];
  assert.deepEqual(selectAcceptedDraftLines(lines, initiallyIncluded), []);

  const includedPaint = toggleDraftLineSelection(initiallyIncluded, "paint", true);
  const selectedForReview = selectAcceptedDraftLines(lines, includedPaint);
  assert.deepEqual(selectedForReview.map((line) => line.draftLineItemId), ["paint"]);

  const previewCost = selectedForReview.reduce((sum, line) => sum + line.lineCost, 0);
  const applyIds = selectedForReview.map((line) => line.draftLineItemId);
  assert.equal(previewCost, 125.5);
  assert.deepEqual(applyIds, ["paint"]);

  const rejectedPaint = toggleDraftLineSelection(includedPaint, "paint", false);
  assert.deepEqual(selectAcceptedDraftLines(lines, rejectedPaint), []);
});

test("only owners and admins send generation-linked review provenance", () => {
  assert.deepEqual(generationIdForReviewer("owner", "generation-1"), { generationId: "generation-1" });
  assert.deepEqual(generationIdForReviewer("admin", "generation-1"), { generationId: "generation-1" });
  assert.deepEqual(generationIdForReviewer("dispatcher", "generation-1"), {});
  assert.deepEqual(generationIdForReviewer("owner", undefined), {});
});
