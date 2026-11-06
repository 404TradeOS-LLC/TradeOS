import assert from "node:assert/strict";
import test from "node:test";
import { formatApprovedMoney, readApprovedJobBaseline } from "./job-approved-baseline.ts";

test("renders the frozen approved price and scope without recomputing from Costbook", () => {
  const source = {
    version: 1,
    proposalId: "proposal-1",
    estimateId: "estimate-1",
    scopeOfWork: "Cabinets and trim",
    assumptions: "Oak substrate",
    exclusions: "Countertop",
    timeline: "Five days",
    finalPrice: "7125.37",
    priceLow: "6500.00",
    priceHigh: "7500.00",
    paymentScheduleJson: [{ label: "Finish", amountPercent: 100 }],
    termsAndConditions: "Net 15",
  };
  const approved = readApprovedJobBaseline(source);
  assert.equal(approved?.scopeOfWork, "Cabinets and trim");
  assert.equal(approved?.finalPrice, "7125.37");
  assert.equal(formatApprovedMoney(approved?.finalPrice ?? null), "$7,125.37");
  assert.equal(approved?.paymentMilestones[0].label, "Finish");
  assert.equal(source.finalPrice, "7125.37");
});
test("standalone jobs or invalid versions cannot invent an accepted baseline", () => {
  for (const input of [null, {}, [], { proposalId: "proposal-1", version: 2 }, { version: 1, proposalId: "" }]) {
    assert.equal(readApprovedJobBaseline(input), null);
  }
});
test("missing or invalid approved money remains unavailable, not zero", () => {
  const input = { version: 1, proposalId: "proposal-1", finalPrice: "Infinity", priceLow: "-1000", priceHigh: "NaN" };
  const output = readApprovedJobBaseline(input);
  assert.equal(output?.finalPrice, null);
  assert.equal(output?.priceLow, null);
  assert.equal(output?.priceHigh, null);
  assert.equal(formatApprovedMoney(output?.finalPrice ?? null), "Not finalized");
});
test("only valid milestone percentages are presented", () => {
  const output = readApprovedJobBaseline({
    version: 1, proposalId: "proposal-1",
    paymentScheduleJson: [
      { label: "Start", amountPercent: 50 },
      { label: "Bad", amountPercent: -200 },
      { label: "", amountPercent: 50 },
      { label: "Finish", amountPercent: 50 },
    ],
  });
  assert.deepEqual(output?.paymentMilestones, [
    { label: "Start", amountPercent: 50 },
    { label: "Finish", amountPercent: 50 },
  ]);
});
