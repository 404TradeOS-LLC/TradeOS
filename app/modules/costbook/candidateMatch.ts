import { round2 } from "../estimate-engine/formulas";

/**
 * Stage 3 (matching) of docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md:
 * deterministic duplicate analysis between a research candidate and the
 * organization's existing Costbook, so a reviewer can see what a promotion
 * would collide with before deciding.
 *
 * This module is pure. It takes rows a caller already fetched through the
 * canonical CostDatabaseService (search + getUnitCost) and returns an
 * assessment. It performs no I/O, holds no Prisma reference, and - most
 * importantly - **mutates nothing**. A "probable-match" is a recommendation
 * for a human, never an instruction to overwrite: name similarity alone must
 * never rewrite a tenant's price.
 */

/**
 * - "new-candidate": nothing in the catalog looks like this item.
 * - "probable-match": exactly one existing item matches by normalized name
 *   AND unit of measure. Still requires the reviewer's explicit decision.
 * - "ambiguous-match": several existing items match equally well. Promotion
 *   must not guess which one; the reviewer picks or creates.
 * - "conflict": an item with the same normalized name exists but its unit of
 *   measure differs, so the two numbers are not comparable at all.
 */
export const candidateMatchStatus = ["new-candidate", "probable-match", "ambiguous-match", "conflict"] as const;
export type CandidateMatchStatus = (typeof candidateMatchStatus)[number];

export interface CandidateMatchSubject {
  itemName: string;
  unitOfMeasure: string;
  /** The candidate's proposed unit cost - materialCostTypical on the contract. */
  proposedUnitCost: number;
}

/**
 * An existing Costbook cost item plus its computed unit cost. The caller
 * resolves currentUnitCost through CostDatabaseService.getUnitCost() so this
 * module never reimplements the pricing formula.
 */
export interface ExistingCostbookItem {
  id: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  currentUnitCost: number | null;
  isActive: boolean;
}

export interface CandidateMatchCandidateRef {
  costItemId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  currentUnitCost: number | null;
  /** proposed - current, rounded to cents. Null when the current cost is unknown. */
  priceDelta: number | null;
  /** Percentage change from current to proposed. Null when current is unknown or zero. */
  priceDeltaPct: number | null;
}

export interface CandidateMatchAnalysis {
  status: CandidateMatchStatus;
  /** Populated for probable-match; null otherwise (never guessed for ambiguous). */
  bestMatch: CandidateMatchCandidateRef | null;
  /** Every comparable existing item considered, for reviewer context. */
  comparisons: CandidateMatchCandidateRef[];
  /** Plain-language explanation of why this status was chosen. */
  rationale: string;
}

/**
 * Name normalization for comparison only. Never written back anywhere: it
 * lowercases, collapses whitespace, and drops punctuation so that
 * "3-5/8 Inch Steel Stud" and "3 5/8 inch steel stud" compare equal.
 */
export function normalizeMatchName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUnit(value: string): string {
  return value.trim().toUpperCase();
}

function toComparison(subject: CandidateMatchSubject, item: ExistingCostbookItem): CandidateMatchCandidateRef {
  const current = item.currentUnitCost;
  const hasCurrent = current !== null && Number.isFinite(current);

  const priceDelta = hasCurrent ? round2(subject.proposedUnitCost - current) : null;
  // A zero current cost has no meaningful percentage change; report null
  // rather than Infinity so the UI shows "n/a" instead of a fake number.
  const priceDeltaPct = hasCurrent && current !== 0
    ? round2(((subject.proposedUnitCost - current) / Math.abs(current)) * 100)
    : null;

  return {
    costItemId: item.id,
    code: item.code,
    name: item.name,
    unitOfMeasure: item.unitOfMeasure,
    currentUnitCost: hasCurrent ? current : null,
    priceDelta,
    priceDeltaPct,
  };
}

/**
 * Compares a candidate against existing Costbook items the caller already
 * fetched. `existingItems` is expected to be the organization-scoped result
 * of CostDatabaseService.search() - this function does not widen that scope
 * and cannot see items from another organization.
 */
export function analyzeCandidateMatch(
  subject: CandidateMatchSubject,
  existingItems: readonly ExistingCostbookItem[]
): CandidateMatchAnalysis {
  const candidateName = normalizeMatchName(subject.itemName);
  const candidateUnit = normalizeUnit(subject.unitOfMeasure);

  // Deactivated items are deliberately excluded: an archived catalog row is
  // not something a promotion should be steered toward.
  const activeItems = existingItems.filter((item) => item.isActive);

  const sameName = activeItems.filter((item) => normalizeMatchName(item.name) === candidateName);

  if (sameName.length === 0) {
    return {
      status: "new-candidate",
      bestMatch: null,
      comparisons: activeItems.map((item) => toComparison(subject, item)),
      rationale: "No active Costbook item shares this candidate's name; promoting it would create a new record.",
    };
  }

  const sameNameAndUnit = sameName.filter((item) => normalizeUnit(item.unitOfMeasure) === candidateUnit);

  if (sameNameAndUnit.length === 0) {
    return {
      status: "conflict",
      bestMatch: null,
      comparisons: sameName.map((item) => toComparison(subject, item)),
      rationale:
        `An existing Costbook item shares this name but is priced per ${sameName
          .map((item) => normalizeUnit(item.unitOfMeasure))
          .join(", ")}, not ${candidateUnit}. The two unit costs are not comparable; a reviewer must reconcile the unit before promoting.`,
    };
  }

  if (sameNameAndUnit.length > 1) {
    return {
      status: "ambiguous-match",
      // Deliberately null: with several equally-good matches, naming one
      // would invite a reviewer to accept a guess.
      bestMatch: null,
      comparisons: sameNameAndUnit.map((item) => toComparison(subject, item)),
      rationale:
        `${sameNameAndUnit.length} active Costbook items share this candidate's name and unit. Promotion cannot choose between them; a reviewer must select an explicit target or create a new record.`,
    };
  }

  const comparison = toComparison(subject, sameNameAndUnit[0]);
  return {
    status: "probable-match",
    bestMatch: comparison,
    comparisons: [comparison],
    rationale:
      `Costbook item ${comparison.code} matches this candidate's name and unit. Review the price difference before deciding; approval never overwrites an existing item on its own.`,
  };
}
