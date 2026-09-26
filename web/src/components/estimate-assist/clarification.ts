/** Preserve numeric item counts in the same contractor phrasing the estimator parses. */
export function appendClarification(scope: string, question: string, answer: string): string {
  const countQuestion = question.match(/^How many (.+) are included\?$/i);
  const clarification = countQuestion && /^\d+(?:\.\d+)?$/.test(answer.trim())
    ? `${answer.trim()} ${countQuestion[1]}`
    : `${question}: ${answer.trim()}`;
  return `${scope.trim()}\n${clarification}`.trim();
}

/** Ask one missing-information question per draft round, in server-provided order. */
export function getActiveClarification(missingInformation: readonly string[]): string | null {
  return missingInformation[0] ?? null;
}

/** Selecting Other opens the free-text path instead of submitting the label. */
export function answerForClarificationChoice(choice: string): string {
  return choice === "Other" ? "" : choice;
}

/** Return the next scope only when the contractor supplied a usable answer. */
export function submitClarification(scope: string, question: string | null, answer: string): string | null {
  const normalizedAnswer = answer.trim();
  if (!question || !normalizedAnswer || normalizedAnswer === "Other") return null;
  return appendClarification(scope, question, normalizedAnswer);
}

export function buildDraftRequestBody(scope: string): { scopeOfWork: string } {
  return { scopeOfWork: scope.trim() };
}
