import { ConfidenceLevel, IntakeConfidence, MissingInformationItem, Trade } from "./types";

const CRITICAL_PENALTY = 20;
const RECOMMENDED_PENALTY = 8;
const OPTIONAL_PENALTY = 3;

function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 85) return "Very High";
  if (score >= 65) return "High";
  if (score >= 45) return "Moderate";
  if (score >= 25) return "Low";
  return "Very Low";
}

function countByImportance(missingInformation: MissingInformationItem[], importance: MissingInformationItem["importance"]): number {
  return missingInformation.filter((item) => item.importance === importance).length;
}

export function calculateConfidence(trade: Trade | null, missingInformation: MissingInformationItem[]): IntakeConfidence {
  const missingCritical = countByImportance(missingInformation, "Critical");
  const missingRecommended = countByImportance(missingInformation, "Recommended");
  const missingOptional = countByImportance(missingInformation, "Optional");

  if (!trade) {
    return {
      score: 5,
      level: "Very Low",
      missingCritical,
      missingRecommended,
      reasoning: "The trade could not be determined from the scope provided, so no other field can be scored until a trade is identified.",
    };
  }

  const rawScore =
    100 - missingCritical * CRITICAL_PENALTY - missingRecommended * RECOMMENDED_PENALTY - missingOptional * OPTIONAL_PENALTY;
  const score = Math.max(0, Math.min(100, rawScore));
  const level = scoreToLevel(score);

  const reasoning = buildReasoning(trade, missingCritical, missingRecommended, missingOptional, score);

  return { score, level, missingCritical, missingRecommended, reasoning };
}

function buildReasoning(
  trade: Trade,
  missingCritical: number,
  missingRecommended: number,
  missingOptional: number,
  score: number
): string {
  if (missingCritical === 0 && missingRecommended === 0 && missingOptional === 0) {
    return `Classified as ${trade} with every relevant field addressed in the scope provided.`;
  }

  const parts: string[] = [];
  if (missingCritical > 0) parts.push(`${missingCritical} critical`);
  if (missingRecommended > 0) parts.push(`${missingRecommended} recommended`);
  if (missingOptional > 0) parts.push(`${missingOptional} optional`);

  return `Classified as ${trade} with ${parts.join(", ")} item${parts.length === 1 && (missingCritical + missingRecommended + missingOptional) === 1 ? "" : "s"} still missing, yielding a confidence score of ${score}.`;
}
