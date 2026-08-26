import { TraininglessEstimateDemoService } from "./service";

const DEFAULT_INPUT = "Remove a 60 foot oak tree, grind the stump, and haul away debris.";

export function runTraininglessEstimateDemo(scopeText = DEFAULT_INPUT) {
  const service = new TraininglessEstimateDemoService();
  return service.run(scopeText);
}

export function formatTraininglessEstimateDemo(result: ReturnType<typeof runTraininglessEstimateDemo>): string {
  const lines = [
    "Trainingless AI estimating demo",
    `Input: ${result.parsedScope.rawText}`,
    `Trade: ${result.parsedScope.trade}`,
    `Scope type: ${result.parsedScope.scopeType}`,
    `Action: ${result.parsedScope.action}`,
    `Confidence: ${(result.parsedScope.confidence * 100).toFixed(0)}%`,
    "",
    "Knowledge matches:",
    ...result.knowledgeMatches.map(
      (match) =>
        `- ${match.matchType}: ${match.name} [${match.category}] (${(match.relevance * 100).toFixed(0)}%) -> ${match.rationale}`
    ),
    "",
    "Suggested estimate draft:",
    ...result.lineItems.map(
      (item) =>
        `- ${item.name} x ${item.quantity} ${item.unitOfMeasure ?? ""} | confidence ${(item.confidence * 100).toFixed(0)}% | flags: ${item.reviewFlags.length ? item.reviewFlags.join("; ") : "none"}`
    ),
    "",
    "Assumptions:",
    ...result.assumptions.map((assumption) => `- ${assumption}`),
    "",
    "Exclusions:",
    ...result.exclusions.map((exclusion) => `- ${exclusion}`),
    "",
    "Safety notes:",
    ...result.safetyNotes.map((note) => `- ${note}`),
    "",
    "Missing information:",
    ...result.missingInformation.map((missing) => `- ${missing}`),
    "",
    `Next human action: ${result.nextHumanAction}`,
  ];

  return lines.join("\n");
}

if (require.main === module) {
  const result = runTraininglessEstimateDemo(process.argv.slice(2).join(" ") || DEFAULT_INPUT);
  console.log(formatTraininglessEstimateDemo(result));
  console.log("\nJSON:");
  console.log(JSON.stringify(result, null, 2));
}
