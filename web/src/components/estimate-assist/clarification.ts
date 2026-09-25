/** Preserve numeric item counts in the same contractor phrasing the estimator parses. */
export function appendClarification(scope: string, question: string, answer: string): string {
  const countQuestion = question.match(/^How many (.+) are included\?$/i);
  const clarification = countQuestion && /^\d+(?:\.\d+)?$/.test(answer.trim())
    ? `${answer.trim()} ${countQuestion[1]}`
    : `${question}: ${answer.trim()}`;
  return `${scope.trim()}\n${clarification}`.trim();
}
