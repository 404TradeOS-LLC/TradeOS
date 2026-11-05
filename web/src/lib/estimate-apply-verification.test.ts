import test from "node:test";
import assert from "node:assert/strict";
import { EstimateApplyVerificationError, verifyEstimateApplyAcknowledgement } from "./estimate-apply-verification.ts";

const body = JSON.stringify({
  lineItems: [{
    draftLineItemId: "reviewed-deck",
    status: "accepted",
    targetKind: "assembly",
    targetId: "assembly-deck",
    quantity: 2,
    description: "Reviewed deck framing",
  }],
});

const savedLine = {
  id: "saved-line-1",
  costItemId: null,
  assemblyId: "assembly-deck",
  description: "Reviewed deck framing",
  quantity: 2,
  unitOfMeasure: "assembly",
  unitCost: 1200,
  lineCost: 2400,
  sourceKey: "ai-estimator:v1:fingerprint",
};

test("verifies a newly applied line against the authorized Estimate read", () => {
  assert.deepEqual(
    verifyEstimateApplyAcknowledgement({
      applied: [{ draftLineItemId: "reviewed-deck", lineItemId: "saved-line-1", quantity: 2 }],
      skipped: [],
    }, body, [savedLine]),
    [{
      draftLineItemId: "reviewed-deck",
      lineItemId: "saved-line-1",
      description: "Reviewed deck framing",
      quantity: 2,
      unitOfMeasure: "assembly",
      targetKind: "assembly",
      targetId: "assembly-deck",
      sourceKey: "ai-estimator:v1:fingerprint",
    }]
  );
});

test("verifies an idempotent retry when the skip acknowledgement identifies the existing line", () => {
  const verified = verifyEstimateApplyAcknowledgement({
    applied: [],
    skipped: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      reason: "Matching reviewed line already exists; skipped for idempotency.",
      lineItemId: "saved-line-1",
    }],
  }, body, [savedLine]);

  assert.equal(verified[0]?.lineItemId, "saved-line-1");
});

test("fails closed when an acknowledged saved line is absent or mismatched", () => {
  assert.throws(
    () => verifyEstimateApplyAcknowledgement({
      applied: [{ draftLineItemId: "reviewed-deck", lineItemId: "missing", quantity: 2 }],
      skipped: [],
    }, body, []),
    EstimateApplyVerificationError
  );
  assert.throws(
    () => verifyEstimateApplyAcknowledgement({
      applied: [{ draftLineItemId: "reviewed-deck", lineItemId: "saved-line-1", quantity: 2 }],
      skipped: [],
    }, body, [{ ...savedLine, quantity: 3 }]),
    EstimateApplyVerificationError
  );
});

test("does not claim rejected or unresolved review-only skips as saved lines", () => {
  const verified = verifyEstimateApplyAcknowledgement({
    applied: [],
    skipped: [{ draftLineItemId: "reviewed-deck", status: "rejected", reason: "Rejected during human review." }],
  }, body, []);
  assert.deepEqual(verified, []);
});
