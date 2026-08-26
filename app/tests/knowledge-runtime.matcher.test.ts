import { matchScopeDeterministically } from "../modules/knowledge-runtime/matcher";
import { resetKnowledgeRepositoryCache } from "../modules/knowledge-runtime/repository";

describe("knowledge runtime matcher", () => {
  beforeEach(() => {
    resetKnowledgeRepositoryCache();
  });

  it("returns assumptions, missing information, and review warnings for incomplete scopes", () => {
    const result = matchScopeDeterministically({
      scopeText: "Replace damaged roof shingles over the back porch.",
      limit: 3,
    });

    expect(result.detectedTrade).toBe("Roofing");
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.missingInformation.length).toBeGreaterThan(0);
    expect(result.reviewWarnings.length).toBeGreaterThan(0);
  });

  it("preserves legacy warning aliases for compatibility", () => {
    const result = matchScopeDeterministically({
      scopeText: "Install a new 12x16 treated deck with rails.",
      limit: 3,
    });

    expect(result.missingInputs).toEqual(result.missingInformation);
    expect(result.humanReviewWarnings).toEqual(result.reviewWarnings);
  });
});
