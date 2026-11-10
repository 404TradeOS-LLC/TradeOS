/**
 * Read-only Estimate Scope/Review hints (issue #946, TODO 4).
 *
 * Pure builder: given the saved estimate total, the jurisdiction resolution,
 * and the project's job assessments, it produces the quiet, nonblocking
 * disclosure content for the Estimate Scope/Review screens.
 *
 * FINANCIAL NO-OP. This module never reads line items, never recomputes a
 * total, and never returns a price. The input total is echoed verbatim and
 * `financialEffect` is always `"none"`. Only quoted/verified permit fees or
 * explicitly selected labor/material Cost Items may ever affect cost — this
 * feature adds no cost effect at all. See the financial no-op test in
 * app/tests/costbook-codes-hints.test.ts.
 */
import type { CodesJobAssessmentDTO, EstimateHints, JurisdictionResolution } from "./types";

export const HINTS_DISCLAIMER =
  "Research only — verify current amendments, parcel jurisdiction, code edition, and permit applicability with the authority having jurisdiction before construction or pricing. Hints never change the estimate total.";

export function buildEstimateHints(input: {
  estimateId: string;
  projectId: string;
  /** Saved estimate total, echoed read-only. */
  estimateTotal: number;
  jurisdiction: JurisdictionResolution;
  assessments: CodesJobAssessmentDTO[];
}): EstimateHints {
  const { estimateId, projectId, estimateTotal, jurisdiction, assessments } = input;
  const hints: string[] = [];
  const openQuestions: string[] = [...jurisdiction.openQuestions];

  if (jurisdiction.outcome === "needs_verification") {
    hints.push(
      "Jurisdiction needs verification for this project. No governing rule, setback, or permit requirement has been determined — confirm the items below before quoting a firm compliant installation.",
    );
  } else {
    hints.push(
      `Jurisdiction verified for ${jurisdiction.workType}: ${jurisdiction.matched.map((record) => record.authority).join(", ")}. Still confirm the permit application and inspections with the issuing office before construction.`,
    );
  }

  const unresolved = assessments.filter((assessment) => assessment.status !== "owner_approved");
  for (const assessment of unresolved) {
    hints.push(
      `Unresolved permit review — ${assessment.workType} (${assessment.status.replace("_", " ")}): ${assessment.unknowns.length > 0 ? assessment.unknowns[0] : "open questions remain; see the job assessment."}`,
    );
    for (const unknown of assessment.unknowns) {
      if (!openQuestions.includes(unknown)) openQuestions.push(unknown);
    }
  }
  if (assessments.length > 0 && unresolved.length === 0) {
    hints.push("All recorded job assessments for this estimate are owner-approved.");
  }

  const citations = [
    ...jurisdiction.citations,
    ...assessments.flatMap((assessment) => assessment.citations),
  ];

  return {
    estimateId,
    projectId,
    estimateTotal,
    financialEffect: "none",
    jurisdiction,
    assessments,
    hints,
    openQuestions,
    citations,
    disclaimer: HINTS_DISCLAIMER,
  };
}
