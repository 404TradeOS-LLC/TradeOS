import { matchScopeDeterministically } from "../modules/knowledge-runtime/matcher";
import { buildProjectIntake } from "../modules/project-intake/service";
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

  it("does not lower confidence for the informational provenance warning", () => {
    const scopeText = "Replace 100 sq ft of roof shingles with exterior access, staging, protection, and haul off.";
    const result = matchScopeDeterministically({
      scopeText,
      limit: 3,
    });

    expect(result.reviewWarnings.some((warning) => warning.startsWith("Matched pricing includes "))).toBe(true);
    const nonProvenanceWarningCount = result.reviewWarnings.filter(
      (warning) => !warning.startsWith("Matched pricing includes ")
    ).length;
    const bestAssembly = result.matchedAssemblies[0]?.confidence ?? 0;
    const bestCostItem = result.matchedCostItems[0]?.confidence ?? 0;
    const intakeConfidence = buildProjectIntake(scopeText).confidenceScore.score;
    const expected = Math.max(
      18,
      Math.min(99, intakeConfidence + Math.min(25, Math.round((bestAssembly + bestCostItem) / 10)) - nonProvenanceWarningCount * 4)
    );

    expect(result.confidenceScore).toBe(expected);
  });
});
