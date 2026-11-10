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
  const unresolvedAssessmentCount = hints.assessments.filter(
    (assessment) => assessment.status !== "owner_approved",
  ).length;
  const needsAttention =
    hints.jurisdiction.outcome === "needs_verification" || unresolvedAssessmentCount > 0;
  return {
    statusLine:
      hints.jurisdiction.outcome === "verified"
        ? "Codes & permits — jurisdiction verified"
        : "Codes & permits — jurisdiction needs verification",
    needsAttention,
    openQuestionCount: hints.openQuestions.length,
    unresolvedAssessmentCount,
    citationCount: hints.citations.length,
  };
}
