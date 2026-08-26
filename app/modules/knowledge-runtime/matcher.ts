import { buildProjectIntake } from "../project-intake/service";
import { getKnowledgeRepositorySnapshot, searchKnowledgeRecords } from "./repository";
import { DeterministicMatchInput, ScopeMatchResult } from "./types";

export function matchScopeDeterministically(input: DeterministicMatchInput): ScopeMatchResult {
  const scopeText = input.scopeText.trim();
  const limit = input.limit ?? 5;
  const repository = getKnowledgeRepositorySnapshot();
  const intake = buildProjectIntake(scopeText);

  const assemblyCandidates = searchKnowledgeRecords(repository.assemblies, scopeText, 15);
  const costItemCandidates = searchKnowledgeRecords(repository.costItems, scopeText, 15);
  const detectedTrade = resolveDetectedTrade(intake.trade, assemblyCandidates, costItemCandidates);
  const matchedAssemblies = rerankByTradeAndScope(assemblyCandidates, detectedTrade, scopeText, limit);
  const matchedCostItems = rerankByTradeAndScope(costItemCandidates, detectedTrade, scopeText, limit);
  const missingInformation = intake.missingInformation.map((item) => item.field);
  const assumptions = buildAssumptions(scopeText, detectedTrade, matchedAssemblies, matchedCostItems);
  const reviewWarnings = buildReviewWarnings(scopeText, intake.confidenceScore.score, missingInformation, matchedAssemblies, matchedCostItems);
  const rationale = buildRationale(scopeText, intake.trade, matchedAssemblies, matchedCostItems, missingInformation);
  const confidenceScore = calculateConfidence(intake.confidenceScore.score, matchedAssemblies, matchedCostItems, reviewWarnings.length);

  return {
    detectedTrade,
    confidenceScore,
    assumptions,
    rationale,
    missingInformation,
    reviewWarnings,
    matchedAssemblies,
    matchedCostItems,
    missingInputs: missingInformation,
    humanReviewWarnings: reviewWarnings,
  };
}

function resolveDetectedTrade(
  intakeTrade: string | null,
  assemblies: ScopeMatchResult["matchedAssemblies"],
  costItems: ScopeMatchResult["matchedCostItems"]
) {
  if (intakeTrade) {
    return intakeTrade;
  }

  const bestTrade =
    assemblies.find((entry) => entry.trade)?.trade ??
    costItems.find((entry) => entry.trade)?.trade;

  return bestTrade ?? null;
}

function calculateConfidence(
  intakeConfidence: number,
  assemblies: ScopeMatchResult["matchedAssemblies"],
  costItems: ScopeMatchResult["matchedCostItems"],
  warningCount: number
) {
  const bestAssembly = assemblies[0]?.confidence ?? 0;
  const bestCostItem = costItems[0]?.confidence ?? 0;
  const baseScore = intakeConfidence;
  const retrievalLift = Math.min(25, Math.round((bestAssembly + bestCostItem) / 10));
  const warningPenalty = warningCount * 4;
  return Math.max(18, Math.min(99, baseScore + retrievalLift - warningPenalty));
}

function buildAssumptions(
  scopeText: string,
  detectedTrade: string | null,
  assemblies: ScopeMatchResult["matchedAssemblies"],
  costItems: ScopeMatchResult["matchedCostItems"]
) {
  const assumptions: string[] = [];

  if (detectedTrade) {
    assumptions.push(`Matching assumes this is a ${detectedTrade} scope and ranks Knowledge Engine records for that trade first.`);
  }

  if (!hasQuantityCue(scopeText)) {
    assumptions.push("No field quantity was detected, so assemblies and cost items are being matched as a single-job scope until measurements are confirmed.");
  }

  if (!hasDisposalCue(scopeText)) {
    assumptions.push("Disposal and haul-off are not explicit in the scope text and should be confirmed before pricing is finalized.");
  }

  if (!hasAccessCue(scopeText)) {
    assumptions.push("Site access, protection, and staging constraints were not explicit and may change labor or equipment assumptions.");
  }

  if (assemblies.length === 0 && costItems.length > 0) {
    assumptions.push("Assembly packaging is incomplete for this scope, so cost-item matches may need to be bundled manually by an estimator.");
  }

  return assumptions.slice(0, 4);
}

function buildReviewWarnings(
  scopeText: string,
  intakeConfidence: number,
  missingInformation: string[],
  assemblies: ScopeMatchResult["matchedAssemblies"],
  costItems: ScopeMatchResult["matchedCostItems"]
) {
  const warnings: string[] = [];
  if (intakeConfidence < 60) warnings.push("Low intake confidence. Confirm trade classification and field measurements before using these matches.");
  if (missingInformation.length > 0) warnings.push(`Missing estimating inputs: ${missingInformation.slice(0, 4).join(", ")}.`);
  if (assemblies.length === 0) warnings.push("No strong assembly match was found. Cost-item suggestions may need manual packaging.");
  if (costItems.length === 0) warnings.push("No strong cost-item match was found. Review the scope wording or fall back to manual estimate entry.");
  if (!hasQuantityCue(scopeText)) warnings.push("No clear quantity cue was detected in the scope. Suggested quantities should be treated as placeholders.");
  return warnings;
}

function buildRationale(
  scopeText: string,
  intakeTrade: string | null,
  assemblies: ScopeMatchResult["matchedAssemblies"],
  costItems: ScopeMatchResult["matchedCostItems"],
  missingInformation: string[]
) {
  const rationale = [
    intakeTrade
      ? `Deterministic intake classified this scope as ${intakeTrade}.`
      : "Deterministic intake could not confidently classify the trade, so repository matches were used as fallback context.",
  ];

  if (assemblies[0]) {
    rationale.push(`Top assembly match: ${assemblies[0].name}. ${assemblies[0].rationale}`);
  }

  if (costItems[0]) {
    rationale.push(`Top cost-item match: ${costItems[0].name}. ${costItems[0].rationale}`);
  }

  if (missingInformation.length > 0) {
    rationale.push(`The scope still needs ${missingInformation.slice(0, 3).join(", ")} before an estimator should trust the draft.`);
  }

  if (!hasQuantityCue(scopeText)) {
    rationale.push("No direct measurement or quantity phrase was found, so the match should be reviewed with field dimensions.");
  }

  return rationale;
}

function hasQuantityCue(scopeText: string) {
  return /(\d+(?:\.\d+)?)\s*(sq\s*ft|square\s*feet|sf|lf|linear\s*ft|linear\s*feet|ft|inch|inches|ea|each|yard|yards|cy|job)\b/i.test(scopeText);
}

function hasDisposalCue(scopeText: string) {
  return /\b(haul|disposal|remove|dumpster|cleanup|debris)\b/i.test(scopeText);
}

function hasAccessCue(scopeText: string) {
  return /\b(access|staging|protection|interior|exterior|gate|driveway|traffic|occupied)\b/i.test(scopeText);
}

function rerankByTradeAndScope(
  results: ScopeMatchResult["matchedAssemblies"] | ScopeMatchResult["matchedCostItems"],
  detectedTrade: string | null,
  scopeText: string,
  limit: number
) {
  const normalizedScope = scopeText.toLowerCase();

  return [...results]
    .map((result) => {
      let score = result.confidence;
      if (detectedTrade && result.trade === detectedTrade) score += 30;
      if (detectedTrade && result.category.toLowerCase().includes(detectedTrade.toLowerCase())) score += 12;
      if (normalizedScope.includes("driveway") && result.name.toLowerCase().includes("driveway")) score += 18;
      if (normalizedScope.includes("tree") && result.name.toLowerCase().includes("tree")) score += 18;
      if (normalizedScope.includes("stump") && result.name.toLowerCase().includes("stump")) score += 12;
      if (normalizedScope.includes("haul") && (result.name.toLowerCase().includes("haul") || result.name.toLowerCase().includes("disposal"))) score += 10;
      return { result, score };
    })
    .sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name))
    .map(({ result }) => result)
    .slice(0, limit);
}
