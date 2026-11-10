/**
 * Codes & Permits Estimate hints — response shape and summary (issue #946, TODO 4).
 * Pure helpers for the Estimate Scope/Review disclosure. The hints payload is
 * read-only and financially inert: it echoes the saved estimate total and
 * never recomputes it.
 */

export interface CodesHintCitation {
  source_id: string;
  rationale: string;
}

export interface CodesHintAssessment {
  id: string;
  workType: string;
  status: "needs_review" | "in_review" | "owner_approved" | "needs_verification";
  unknowns: string[];
  citations: CodesHintCitation[];
}

export interface EstimateCodesHintsResponse {
  estimateId: string;
  projectId: string;
  estimateTotal: number;
  financialEffect: "none";
  jurisdiction: {
    outcome: "verified" | "needs_verification";
    openQuestions: string[];
    reasons: string[];
    citations: CodesHintCitation[];
  };
  assessments: CodesHintAssessment[];
  hints: string[];
  openQuestions: string[];
  citations: CodesHintCitation[];
  disclaimer: string;
}

export interface CodesHintsSummary {
  /** Short status line for the disclosure summary element. */
  statusLine: string;
  /** Whether anything needs a human decision before quoting firm compliance. */
  needsAttention: boolean;
  openQuestionCount: number;
  unresolvedAssessmentCount: number;
  citationCount: number;
}

export function summarizeCodesHints(hints: EstimateCodesHintsResponse): CodesHintsSummary {
  // Defensive: the hints payload crosses a network boundary, so a malformed
  // payload must degrade to "needs verification", never throw during render
  // (a render throw unmounts the whole estimate stage — see PR #961).
  const assessments = Array.isArray(hints?.assessments) ? hints.assessments : [];
  const openQuestions = Array.isArray(hints?.openQuestions) ? hints.openQuestions : [];
  const citations = Array.isArray(hints?.citations) ? hints.citations : [];
  const unresolvedAssessmentCount = assessments.filter(
    (assessment) => assessment?.status !== "owner_approved",
  ).length;
  const verified = hints?.jurisdiction?.outcome === "verified";
  const needsAttention = !verified || unresolvedAssessmentCount > 0;
  return {
    statusLine: verified
      ? "Codes & permits — jurisdiction verified"
      : "Codes & permits — jurisdiction needs verification",
    needsAttention,
    openQuestionCount: openQuestions.length,
    unresolvedAssessmentCount,
    citationCount: citations.length,
  };
}

/**
 * Runtime shape check for the hints payload. `clientFetch` returns whatever
 * the transport delivers, and a truthy-but-malformed payload (notably the
 * `[]` a generic list transport returns for an unknown GET) must render
 * nothing instead of throwing inside `summarizeCodesHints` or the disclosure.
 * Anything uncertain fails closed to "not a hints payload".
 */
export function isEstimateCodesHintsResponse(data: unknown): data is EstimateCodesHintsResponse {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  const candidate = data as Partial<EstimateCodesHintsResponse>;
  if (
    typeof candidate.jurisdiction !== "object" ||
    candidate.jurisdiction === null ||
    (candidate.jurisdiction.outcome !== "verified" &&
      candidate.jurisdiction.outcome !== "needs_verification")
  ) {
    return false;
  }
  if (
    !Array.isArray(candidate.hints) ||
    !candidate.hints.every((hint) => typeof hint === "string") ||
    !Array.isArray(candidate.openQuestions) ||
    !candidate.openQuestions.every((question) => typeof question === "string") ||
    !Array.isArray(candidate.citations) ||
    !candidate.citations.every(
      (citation) =>
        typeof citation === "object" &&
        citation !== null &&
        typeof citation.source_id === "string" &&
        typeof citation.rationale === "string",
    ) ||
    !Array.isArray(candidate.assessments) ||
    !candidate.assessments.every(
      (assessment) =>
        typeof assessment === "object" &&
        assessment !== null &&
        typeof assessment.id === "string" &&
        typeof assessment.workType === "string" &&
        (assessment.status === "needs_review" ||
          assessment.status === "in_review" ||
          assessment.status === "owner_approved" ||
          assessment.status === "needs_verification"),
    ) ||
    typeof candidate.disclaimer !== "string"
  ) {
    return false;
  }
  return true;
}
