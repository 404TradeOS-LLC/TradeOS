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
      applied: [{ draftLineItemId: "reviewed-deck", lineItemId: "saved-line-1", quantity: 2, description: "Reviewed deck framing" }],
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
      quantity: 2,
      description: "Reviewed deck framing",
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
      applied: [{ draftLineItemId: "reviewed-deck", lineItemId: "saved-line-1", quantity: 2, description: "Reviewed deck framing" }],
      skipped: [],
    }, body, [{ ...savedLine, quantity: 3 }]),
    EstimateApplyVerificationError
  );
});

test("verifies the backend's effective description and persisted quantity precision", () => {
  const precisionBody = JSON.stringify({
    lineItems: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      targetKind: "assembly",
      targetId: "assembly-deck",
      quantity: 1.23456,
      description: "   ",
    }],
  });
  const verified = verifyEstimateApplyAcknowledgement({
    applied: [{
      draftLineItemId: "reviewed-deck",
      lineItemId: "saved-line-1",
      quantity: 1.2346,
      description: "Deck framing assembly",
    }],
    skipped: [],
  }, precisionBody, [{
    ...savedLine,
    description: "Deck framing assembly",
    quantity: 1.2346,
  }]);

  assert.equal(verified[0]?.description, "Deck framing assembly");
  assert.equal(verified[0]?.quantity, 1.2346);
});

test("does not claim rejected or unresolved review-only skips as saved lines", () => {
  const verified = verifyEstimateApplyAcknowledgement({
    applied: [],
    skipped: [{ draftLineItemId: "reviewed-deck", status: "rejected", reason: "Rejected during human review." }],
  }, body, []);
  assert.deepEqual(verified, []);
});

test("fails closed when an idempotent retry acknowledges a line edited after the apply", () => {
  // The server's sourceKey lookup finds the edited row (edits preserve
  // sourceKey) and the skip acknowledgement echoes its CURRENT values, so
  // saved-vs-acknowledgement agrees while both differ from the review.
  // The retained request is the only thing that catches it.
  const editedLine = { ...savedLine, quantity: 300, description: "Edited in another tab" };
  assert.throws(
    () => verifyEstimateApplyAcknowledgement({
      applied: [],
      skipped: [{
        draftLineItemId: "reviewed-deck",
        status: "accepted",
        reason: "Matching reviewed line already exists; skipped for idempotency.",
        lineItemId: "saved-line-1",
        quantity: 300,
        description: "Edited in another tab",
      }],
    }, body, [editedLine]),
    EstimateApplyVerificationError
  );
});

test("accepts an idempotent retry whose saved quantity differs only by persisted precision", () => {
  const precisionBody = JSON.stringify({
    lineItems: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      targetKind: "assembly",
      targetId: "assembly-deck",
      quantity: 1.23456,
      description: "   ",
    }],
  });
  const verified = verifyEstimateApplyAcknowledgement({
    applied: [],
    skipped: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      reason: "Matching reviewed line already exists; skipped for idempotency.",
      lineItemId: "saved-line-1",
      quantity: 1.2346,
      description: "Deck framing assembly",
    }],
  }, precisionBody, [{
    ...savedLine,
    description: "Deck framing assembly",
    quantity: 1.2346,
  }]);

  assert.equal(verified[0]?.quantity, 1.2346);
  assert.equal(verified[0]?.description, "Deck framing assembly");
});

test("accepts a four-decimal rounding midpoint whose floating-point difference exceeds the half-unit bound", () => {
  // Requested 100.00005 persists as 100.0001; comparing against the raw
  // request rejects it (the JavaScript difference is
  // 0.00005000000000165983, over the half-unit bound), so the comparison
  // must use the rounded request.
  const midpointBody = JSON.stringify({
    lineItems: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      targetKind: "assembly",
      targetId: "assembly-deck",
      quantity: 100.00005,
      description: "Deck framing assembly",
    }],
  });
  const verified = verifyEstimateApplyAcknowledgement({
    applied: [],
    skipped: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      reason: "Matching reviewed line already exists; skipped for idempotency.",
      lineItemId: "saved-line-1",
      quantity: 100.0001,
      description: "Deck framing assembly",
    }],
  }, midpointBody, [{
    ...savedLine,
    description: "Deck framing assembly",
    quantity: 100.0001,
  }]);

  assert.equal(verified[0]?.quantity, 100.0001);
  assert.equal(verified[0]?.description, "Deck framing assembly");
});

test("rejects a saved quantity that only matches the raw request, not its rounded value", () => {
  // Requested 1.00005 persists as 1.0001, so a saved 1 is an edited
  // line, not rounding: it sits within 0.00005 of the raw request but
  // 0.0001 away from the rounded request the server would have saved.
  const midpointBody = JSON.stringify({
    lineItems: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      targetKind: "assembly",
      targetId: "assembly-deck",
      quantity: 1.00005,
      description: "Deck framing assembly",
    }],
  });
  assert.throws(
    () => verifyEstimateApplyAcknowledgement({
      applied: [],
      skipped: [{
        draftLineItemId: "reviewed-deck",
        status: "accepted",
        reason: "Matching reviewed line already exists; skipped for idempotency.",
        lineItemId: "saved-line-1",
        quantity: 1,
        description: "Deck framing assembly",
      }],
    }, midpointBody, [{
      ...savedLine,
      description: "Deck framing assembly",
      quantity: 1,
    }]),
    EstimateApplyVerificationError
  );
});

test("accepts a midpoint whose binary double sits below the decimal (2.00005)", () => {
  // The backend Decimal rounding persists 2.00005 as 2.0001, but
  // (2.00005).toFixed(4) is "2.0000": toFixed rounds the binary double,
  // which is just below the decimal, so the comparison must round the
  // decimal value itself or this correctly saved line is rejected.
  const midpointBody = JSON.stringify({
    lineItems: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      targetKind: "assembly",
      targetId: "assembly-deck",
      quantity: 2.00005,
      description: "Deck framing assembly",
    }],
  });
  const verified = verifyEstimateApplyAcknowledgement({
    applied: [],
    skipped: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      reason: "Matching reviewed line already exists; skipped for idempotency.",
      lineItemId: "saved-line-1",
      quantity: 2.0001,
      description: "Deck framing assembly",
    }],
  }, midpointBody, [{
    ...savedLine,
    description: "Deck framing assembly",
    quantity: 2.0001,
  }]);

  assert.equal(verified[0]?.quantity, 2.0001);
  assert.equal(verified[0]?.description, "Deck framing assembly");
});

test("rejects a saved 2 against a requested 2.00005", () => {
  // With binary rounding, 2.00005 rounds to 2, so a saved 2 would be
  // wrongly accepted as the rounded request; with decimal rounding the
  // persisted value is 2.0001, so a saved 2 is an edited line.
  const midpointBody = JSON.stringify({
    lineItems: [{
      draftLineItemId: "reviewed-deck",
      status: "accepted",
      targetKind: "assembly",
      targetId: "assembly-deck",
      quantity: 2.00005,
      description: "Deck framing assembly",
    }],
  });
  assert.throws(
    () => verifyEstimateApplyAcknowledgement({
      applied: [],
      skipped: [{
        draftLineItemId: "reviewed-deck",
        status: "accepted",
        reason: "Matching reviewed line already exists; skipped for idempotency.",
        lineItemId: "saved-line-1",
        quantity: 2,
        description: "Deck framing assembly",
      }],
    }, midpointBody, [{
      ...savedLine,
      description: "Deck framing assembly",
      quantity: 2,
    }]),
    EstimateApplyVerificationError
  );
});
