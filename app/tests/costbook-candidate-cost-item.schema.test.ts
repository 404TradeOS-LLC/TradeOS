import {
  costbookResearchCandidateSchema,
  isEligibleForCostbookPromotion,
  parseCostbookResearchCandidate,
  safeParseCostbookResearchCandidate,
} from "../modules/costbook/candidateCostItem";

function validCandidateInput(overrides: Record<string, unknown> = {}) {
  return {
    trade: "Roofing",
    category: "Roofing",
    itemName: "30-Year Architectural Shingle Installation",
    unitOfMeasure: "SQ",
    materialCostTypical: 95,
    equipmentCost: 15,
    sourceName: "Manufacturer published price sheet",
    sourceUrl: "https://example.com/pricing/asphalt-shingles",
    sourceDate: "2026-08-01",
    retrievedAt: "2026-09-08T00:00:00.000Z",
    regionalBasis: "US national average",
    confidence: "medium",
    ...overrides,
  };
}

describe("costbookResearchCandidateSchema", () => {
  it("parses a well-formed candidate and applies safe defaults", () => {
    const candidate = parseCostbookResearchCandidate(validCandidateInput());

    expect(candidate.provenanceStatus).toBe("unverified-legacy");
    expect(candidate.reviewStatus).toBe("candidate");
    expect(candidate.equipmentCost).toBe(15);
  });

  it("never defaults reviewStatus to approved", () => {
    const candidate = parseCostbookResearchCandidate(validCandidateInput());
    expect(candidate.reviewStatus).not.toBe("approved");
  });

  it.each(["trade", "category", "itemName", "unitOfMeasure", "sourceName", "sourceDate", "retrievedAt", "regionalBasis"])(
    "rejects a candidate missing required field %s",
    (field) => {
      const input = validCandidateInput();
      delete (input as Record<string, unknown>)[field];

      const result = safeParseCostbookResearchCandidate(input);
      expect(result.success).toBe(false);
    }
  );

  it("rejects malformed sourceDate and retrievedAt values", () => {
    expect(safeParseCostbookResearchCandidate(validCandidateInput({ sourceDate: "2026-02-30" })).success).toBe(false);
    expect(safeParseCostbookResearchCandidate(validCandidateInput({ sourceDate: "2026/08/01" })).success).toBe(false);
    expect(safeParseCostbookResearchCandidate(validCandidateInput({ retrievedAt: "2026-09-08" })).success).toBe(false);
    expect(safeParseCostbookResearchCandidate(validCandidateInput({ retrievedAt: "not-a-timestamp" })).success).toBe(false);
  });

  it("rejects a malformed reviewedAt timestamp", () => {
    expect(
      safeParseCostbookResearchCandidate(
        validCandidateInput({
          reviewStatus: "approved",
          reviewedBy: "user-42",
          reviewedAt: "not-a-timestamp",
        })
      ).success
    ).toBe(false);
  });
  it("rejects a candidate with neither sourceUrl nor sourceIdentifier", () => {
    const input = validCandidateInput({ sourceUrl: undefined });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("sourceUrl"))).toBe(true);
    }
  });

  it("accepts sourceIdentifier as an alternative to sourceUrl", () => {
    const input = validCandidateInput({ sourceUrl: undefined, sourceIdentifier: "vendor-catalog-2026-q3#page-14" });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(true);
  });

  it("rejects an inverted materialCostLow/materialCostTypical range", () => {
    const input = validCandidateInput({ materialCostTypical: 50, materialCostLow: 75 });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(false);
  });

  it("rejects an inverted materialCostHigh/materialCostTypical range", () => {
    const input = validCandidateInput({ materialCostTypical: 50, materialCostHigh: 25 });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(false);
  });

  it("accepts a valid materialCostLow/Typical/High range", () => {
    const input = validCandidateInput({ materialCostLow: 80, materialCostTypical: 95, materialCostHigh: 120 });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(true);
  });

  it("rejects an approved candidate that omits reviewedBy/reviewedAt", () => {
    const input = validCandidateInput({ reviewStatus: "approved" });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("reviewedBy"))).toBe(true);
    }
  });

  it("rejects a rejected candidate that omits reviewedBy/reviewedAt", () => {
    const input = validCandidateInput({ reviewStatus: "rejected" });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(false);
  });

  it("accepts an approved candidate that records reviewedBy and reviewedAt", () => {
    const input = validCandidateInput({
      reviewStatus: "approved",
      reviewedBy: "user-42",
      reviewedAt: "2026-09-08T12:00:00.000Z",
    });
    const result = safeParseCostbookResearchCandidate(input);

    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized reviewStatus value rather than coercing it", () => {
    const input = validCandidateInput({ reviewStatus: "auto-approved" });
    const result = costbookResearchCandidateSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized provenanceStatus value rather than coercing it", () => {
    const input = validCandidateInput({ provenanceStatus: "verified" });
    const result = costbookResearchCandidateSchema.safeParse(input);

    expect(result.success).toBe(false);
  });
});

describe("isEligibleForCostbookPromotion", () => {
  it("returns false for a freshly parsed candidate with default reviewStatus", () => {
    const candidate = parseCostbookResearchCandidate(validCandidateInput());
    expect(isEligibleForCostbookPromotion(candidate)).toBe(false);
  });

  it.each(["candidate", "needs-review", "rejected"] as const)(
    "returns false when reviewStatus is %s even if reviewedBy/reviewedAt are set",
    (reviewStatus) => {
      const candidate = parseCostbookResearchCandidate(
        validCandidateInput({
          reviewStatus,
          reviewedBy: reviewStatus === "candidate" || reviewStatus === "needs-review" ? undefined : "user-1",
          reviewedAt: reviewStatus === "candidate" || reviewStatus === "needs-review" ? undefined : "2026-09-08T00:00:00.000Z",
        })
      );

      expect(isEligibleForCostbookPromotion(candidate)).toBe(false);
    }
  );

  it("returns true only for an approved candidate with a named reviewer and timestamp", () => {
    const candidate = parseCostbookResearchCandidate(
      validCandidateInput({
        reviewStatus: "approved",
        reviewedBy: "user-42",
        reviewedAt: "2026-09-08T12:00:00.000Z",
      })
    );

    expect(isEligibleForCostbookPromotion(candidate)).toBe(true);
  });

  it("returns false when reviewedBy is only whitespace, even with reviewStatus approved bypassed via direct object construction", () => {
    // Simulates a caller that builds the object by hand instead of going through
    // the schema (e.g. deserializing a partially-trusted record) - the runtime
    // gate must not trust a non-schema-validated reviewedBy value either.
    expect(
      isEligibleForCostbookPromotion({
        ...parseCostbookResearchCandidate(validCandidateInput()),
        reviewStatus: "approved",
        reviewedBy: "   ",
        reviewedAt: "2026-09-08T12:00:00.000Z",
      })
    ).toBe(false);
  });
});
