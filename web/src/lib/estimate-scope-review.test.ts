import assert from "node:assert/strict";
import test from "node:test";
import { isEstimateScopeReviewCurrent } from "./estimate-scope-review.ts";

const reviewed = { projectId: "project-a", estimateId: "estimate-a", scope: "Replace a 12 by 16 foot deck." };

test("scope edits require another review before a suggestion can be applied", () => {
  assert.equal(isEstimateScopeReviewCurrent(reviewed, reviewed), true);
  assert.equal(isEstimateScopeReviewCurrent(reviewed, { ...reviewed, scope: "Repair the existing deck." }), false);
  assert.equal(isEstimateScopeReviewCurrent(reviewed, { ...reviewed, scope: "" }), false);
  assert.equal(isEstimateScopeReviewCurrent(null, reviewed), false);
});

test("late responses for an old scope or different estimate stay unusable", () => {
  assert.equal(isEstimateScopeReviewCurrent(reviewed, { ...reviewed, estimateId: "estimate-b" }), false);
  assert.equal(isEstimateScopeReviewCurrent(reviewed, { ...reviewed, projectId: "project-b" }), false);
  assert.equal(isEstimateScopeReviewCurrent(reviewed, { ...reviewed, scope: "Add stairs to a new deck." }), false);
});

test("surrounding whitespace does not invalidate identical reviewed work", () => {
  assert.equal(isEstimateScopeReviewCurrent(reviewed, { ...reviewed, scope: `  ${reviewed.scope}\n` }), true);
});
