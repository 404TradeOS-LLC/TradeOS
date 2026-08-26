import { buildTraininglessEstimateDemo } from "../modules/trainingless-estimate-demo/matcher";
import { formatTraininglessEstimateDemo, runTraininglessEstimateDemo } from "../modules/trainingless-estimate-demo/demo";

describe("trainingless estimate demo", () => {
  it("builds a tree-service estimate draft from local knowledge-engine data", () => {
    const result = buildTraininglessEstimateDemo("Remove a 60 foot oak tree, grind the stump, and haul away debris.");

    expect(result.parsedScope.trade).toBe("Tree Service");
    expect(result.knowledgeMatches.some((match) => match.name.includes("Tree Service Package"))).toBe(true);
    expect(result.knowledgeMatches.some((match) => match.name.includes("Tree Removal"))).toBe(true);
    expect(result.lineItems.some((item) => item.name.toLowerCase().includes("stump grinding"))).toBe(true);
    expect(result.lineItems.length).toBeGreaterThanOrEqual(3);
    expect(result.lineItems.some((item) => item.reviewFlags.length > 0)).toBe(true);
    expect(result.nextHumanAction).toContain("Confirm DBH");
  });

  it("renders readable console output with review flags and confidence", () => {
    const result = runTraininglessEstimateDemo();
    const output = formatTraininglessEstimateDemo(result);

    expect(output).toContain("Trainingless AI estimating demo");
    expect(output).toContain("Tree Service");
    expect(output).toContain("Suggested estimate draft");
    expect(output.toLowerCase()).toContain("confidence");
    expect(output.toLowerCase()).toContain("flags");
    expect(output).toContain("Next human action");
  });
});
