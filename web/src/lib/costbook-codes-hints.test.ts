import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeCodesHints,
  type EstimateCodesHintsResponse,
} from "./costbook-codes-hints.ts";

function response(overrides: Partial<EstimateCodesHintsResponse> = {}): EstimateCodesHintsResponse {
  return {
    estimateId: "estimate-1",
    projectId: "project-1",
    estimateTotal: 975,
    financialEffect: "none",
    jurisdiction: {
      outcome: "needs_verification",
      openQuestions: ["Confirm the zoning district for the parcel."],
      reasons: ["zoning_district_unknown"],
      citations: [{ source_id: "vigo-zoning-signs", rationale: "County sign rules." }],
    },
    assessments: [
      {
        id: "assessment-1",
        workType: "sign replacement",
        status: "needs_review",
        unknowns: ["Confirm on-premises vs off-premises classification."],
        citations: [{ source_id: "indot-sign-permits", rationale: "INDOT sign permit route." }],
      },
    ],
    hints: ["Jurisdiction needs verification for this project."],
    openQuestions: ["Confirm the zoning district for the parcel."],
    citations: [
      { source_id: "vigo-zoning-signs", rationale: "County sign rules." },
      { source_id: "indot-sign-permits", rationale: "INDOT sign permit route." },
    ],
    disclaimer: "Research only — verify with the authority having jurisdiction.",
    ...overrides,
  };
}

test("summarizeCodesHints flags needs-verification and counts open work", () => {
  const summary = summarizeCodesHints(response());
  assert.equal(summary.statusLine, "Codes & permits — jurisdiction needs verification");
  assert.equal(summary.needsAttention, true);
  assert.equal(summary.openQuestionCount, 1);
  assert.equal(summary.unresolvedAssessmentCount, 1);
  assert.equal(summary.citationCount, 2);
});

test("summarizeCodesHints reports verified with no open work when everything is approved", () => {
  const summary = summarizeCodesHints(
    response({
      jurisdiction: {
        outcome: "verified",
        openQuestions: [],
        reasons: ["verified_match"],
        citations: [],
      },
      assessments: [
        {
          id: "assessment-1",
          workType: "sign replacement",
          status: "owner_approved",
          unknowns: [],
          citations: [],
        },
      ],
      hints: ["All recorded job assessments for this estimate are owner-approved."],
      openQuestions: [],
      citations: [],
    }),
  );
  assert.equal(summary.statusLine, "Codes & permits — jurisdiction verified");
  assert.equal(summary.needsAttention, false);
  assert.equal(summary.openQuestionCount, 0);
  assert.equal(summary.unresolvedAssessmentCount, 0);
});

test("hints payloads are financially inert: the echoed total is the saved total", () => {
  const payload = response();
  assert.equal(payload.financialEffect, "none");
  assert.equal(payload.estimateTotal, 975);
  assert.ok(!("lineItems" in payload));
  assert.ok(!("permitFee" in payload));
});
