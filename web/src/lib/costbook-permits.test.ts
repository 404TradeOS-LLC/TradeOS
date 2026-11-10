import assert from "node:assert/strict";
import test from "node:test";
import {
  feeReviewStatusLabel,
  formatFeeCents,
  normalizePermitsSearchParams,
  permitStatusLabel,
} from "./costbook-permits.ts";

test("permit statuses use explicit labels and never guess an unknown status", () => {
  assert.equal(permitStatusLabel("not_submitted"), "Not submitted");
  assert.equal(permitStatusLabel("inspection_passed"), "Inspection passed");
  assert.equal(permitStatusLabel("probably_fine"), "Unknown status");
  assert.equal(permitStatusLabel(""), "Unknown status");
});

test("fee review statuses use explicit labels", () => {
  assert.equal(feeReviewStatusLabel("pending"), "Pending review");
  assert.equal(feeReviewStatusLabel("approved"), "Approved");
  assert.equal(feeReviewStatusLabel("rejected"), "Rejected");
  assert.equal(feeReviewStatusLabel("auto_approved"), "Unknown status");
});

test("fee amounts format from integer cents and handle an unstated fee", () => {
  assert.equal(formatFeeCents(12500), "$125.00");
  assert.equal(formatFeeCents(0), "$0.00");
  assert.equal(formatFeeCents(null), "No fee stated");
});

test("projectId is required and multiple values are ignored", () => {
  assert.deepEqual(normalizePermitsSearchParams({}), { projectId: "" });
  assert.deepEqual(normalizePermitsSearchParams({ projectId: ["a", "b"] }), { projectId: "" });
  assert.deepEqual(normalizePermitsSearchParams({ projectId: "  project-1 " }), { projectId: "project-1" });
});
