import test from "node:test";
import assert from "node:assert/strict";
import { buildEstimateQueueSearchParams, buildInvoiceQueueSearchParams, buildProposalQueueSearchParams } from "./work-queue-params.ts";

test("buildEstimateQueueSearchParams sets status/updatedAfter/updatedBefore/limit/cursor and omits anything unset", () => {
  const params = buildEstimateQueueSearchParams({ status: "draft,ready", updatedAfter: "2026-08-01T00:00:00.000Z", limit: 15, cursor: "abc" });

  assert.equal(params.get("status"), "draft,ready");
  assert.equal(params.get("updatedAfter"), "2026-08-01T00:00:00.000Z");
  assert.equal(params.get("limit"), "15");
  assert.equal(params.get("cursor"), "abc");
  assert.equal(params.has("updatedBefore"), false);
});

test("buildEstimateQueueSearchParams with no filters produces an empty query", () => {
  assert.equal(buildEstimateQueueSearchParams({}).toString(), "");
});

test("buildProposalQueueSearchParams requests unsigned + staleBefore together for the stale-proposal bucket", () => {
  const params = buildProposalQueueSearchParams({ unsigned: true, staleBefore: "2026-08-04T00:00:00.000Z", limit: 10 });

  assert.equal(params.get("unsigned"), "true");
  assert.equal(params.get("staleBefore"), "2026-08-04T00:00:00.000Z");
  assert.equal(params.get("limit"), "10");
  assert.equal(params.has("sent"), false);
  assert.equal(params.has("viewed"), false);
});

test("buildProposalQueueSearchParams requests unsigned alone (no staleBefore) for the general unsigned bucket", () => {
  const params = buildProposalQueueSearchParams({ unsigned: true, limit: 15 });

  assert.equal(params.get("unsigned"), "true");
  assert.equal(params.has("staleBefore"), false);
});

test("buildProposalQueueSearchParams encodes sent=false explicitly rather than dropping a false boolean filter", () => {
  const params = buildProposalQueueSearchParams({ sent: false });
  assert.equal(params.get("sent"), "false");
});

test("buildInvoiceQueueSearchParams requests overdue=true alone for the overdue bucket", () => {
  const params = buildInvoiceQueueSearchParams({ overdue: true, limit: 10 });

  assert.equal(params.get("overdue"), "true");
  assert.equal(params.has("unpaid"), false);
  assert.equal(params.has("partiallyPaid"), false);
});

test("buildInvoiceQueueSearchParams requests unpaid=true (a superset including partially-paid) for the unpaid bucket", () => {
  const params = buildInvoiceQueueSearchParams({ unpaid: true, limit: 15 });

  assert.equal(params.get("unpaid"), "true");
  assert.equal(params.has("overdue"), false);
});

test("buildInvoiceQueueSearchParams never invents an unrequested filter", () => {
  assert.equal(buildInvoiceQueueSearchParams({}).toString(), "");
});
