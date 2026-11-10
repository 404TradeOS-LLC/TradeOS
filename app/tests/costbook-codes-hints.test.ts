/**
 * Estimate Scope/Review hints — financial no-op proof (issue #946, TODO 4).
 *
 * Research is financially inert: building hints must never change estimated
 * cost. These tests prove the estimate total is identical with and without
 * hints, the input estimate is never mutated, and the hints payload carries
 * no price-changing fields.
 */
import { buildEstimateHints, HINTS_DISCLAIMER } from "../modules/costbook/codes/hints";
import type { CodesJobAssessmentDTO, JurisdictionResolution } from "../modules/costbook/codes/types";

function needsVerificationResolution(): JurisdictionResolution {
  return {
    outcome: "needs_verification",
    matched: [],
    citations: [{ source_id: "vigo-zoning-signs", rationale: "Reviewed source consulted." }],
    openQuestions: ["Confirm the zoning district for the parcel."],
    reasons: ["zoning_district_unknown"],
    distinctions: {
      parcelBoundary: "verified",
      rightOfWay: "unknown",
      incorporatedStatus: "unknown",
      zoningOverlays: "unknown",
      signCategory: "unknown",
    },
    workType: "sign replacement",
  };
}

function assessment(overrides: Partial<CodesJobAssessmentDTO> = {}): CodesJobAssessmentDTO {
  return {
    id: "assessment-1",
    orgId: "org-1",
    projectId: "project-1",
    estimateId: "estimate-1",
    workType: "sign replacement",
    status: "needs_review",
    citations: [{ source_id: "indot-sign-permits", rationale: "INDOT sign permit route must be confirmed." }],
    unknowns: ["Confirm on-premises vs off-premises classification."],
    ownerSignoff: false,
    signedOffBy: null,
    signedOffAt: null,
    createdBy: "user-1",
    createdAt: "2026-11-09T12:00:00.000Z",
    updatedAt: "2026-11-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildEstimateHints financial no-op", () => {
  it("returns the saved estimate total identical with hints, and never recomputes it", () => {
    const total = 975.0;
    const withHints = buildEstimateHints({
      estimateId: "estimate-1",
      projectId: "project-1",
      estimateTotal: total,
      jurisdiction: needsVerificationResolution(),
      assessments: [assessment()],
    });
    expect(withHints.estimateTotal).toBe(total);
    expect(withHints.financialEffect).toBe("none");

    const withoutAssessments = buildEstimateHints({
      estimateId: "estimate-1",
      projectId: "project-1",
      estimateTotal: total,
      jurisdiction: needsVerificationResolution(),
      assessments: [],
    });
    expect(withoutAssessments.estimateTotal).toBe(total);
    expect(withoutAssessments.estimateTotal).toBe(withHints.estimateTotal);
  });

  it("does not mutate its inputs", () => {
    const jurisdiction = needsVerificationResolution();
    const assessments = [assessment()];
    const before = JSON.stringify({ jurisdiction, assessments });
    buildEstimateHints({
      estimateId: "estimate-1",
      projectId: "project-1",
      estimateTotal: 975,
      jurisdiction,
      assessments,
    });
    expect(JSON.stringify({ jurisdiction, assessments })).toBe(before);
  });

  it("carries no price-changing fields", () => {
    const hints = buildEstimateHints({
      estimateId: "estimate-1",
      projectId: "project-1",
      estimateTotal: 975,
      jurisdiction: needsVerificationResolution(),
      assessments: [assessment()],
    });
    for (const key of ["lineItems", "subtotalCost", "totalPrice", "taxAmount", "permitFee", "adjustment", "markup"]) {
      expect(Object.keys(hints)).not.toContain(key);
    }
    expect(hints.disclaimer).toBe(HINTS_DISCLAIMER);
    expect(hints.disclaimer).toMatch(/Hints never change the estimate total/);
  });

  it("surfaces the jurisdiction status, unresolved permits, and open questions as quiet hints", () => {
    const hints = buildEstimateHints({
      estimateId: "estimate-1",
      projectId: "project-1",
      estimateTotal: 975,
      jurisdiction: needsVerificationResolution(),
      assessments: [assessment()],
    });
    expect(hints.hints.join(" ")).toMatch(/Jurisdiction needs verification/);
    expect(hints.hints.join(" ")).toMatch(/Unresolved permit review/);
    expect(hints.openQuestions).toEqual(
      expect.arrayContaining([
        "Confirm the zoning district for the parcel.",
        "Confirm on-premises vs off-premises classification.",
      ]),
    );
    expect(hints.citations.map((citation) => citation.source_id)).toEqual(
      expect.arrayContaining(["vigo-zoning-signs", "indot-sign-permits"]),
    );
  });

  it("reports owner-approved assessments as resolved instead of repeating them as open work", () => {
    const hints = buildEstimateHints({
      estimateId: "estimate-1",
      projectId: "project-1",
      estimateTotal: 975,
      jurisdiction: {
        ...needsVerificationResolution(),
        outcome: "verified",
        matched: [],
        reasons: ["verified_match"],
        openQuestions: [],
      },
      assessments: [assessment({ status: "owner_approved", ownerSignoff: true })],
    });
    expect(hints.hints.join(" ")).toMatch(/owner-approved/);
    expect(hints.hints.join(" ")).not.toMatch(/Unresolved permit review/);
  });
});
