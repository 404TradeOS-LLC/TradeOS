import type { EstimateLineItem, EstimateLinePriceReadiness } from "./api";

/**
 * Price-readiness summary for the estimate Price stage (DES-10-F3).
 * Pure presentation logic over the `priceReadiness` signal the detail
 * endpoint attaches per line; it never re-derives freshness itself.
 */

/**
 * Gross-margin percentage below which the Price stage flags low margin.
 * The estimate's margin is computed by the existing running-totals math
 * (gross profit / pre-tax total); this is a display threshold only, not a
 * pricing policy — nothing is repriced and finalization is not blocked.
 * 10% is the floor below which a job's gross margin leaves no room for
 * estimating error, callbacks, or overhead drift on a typical TradeOS job.
 */
export const LOW_GROSS_MARGIN_THRESHOLD_PCT = 10;

export function isLowGrossMargin(marginPct: number): boolean {
  return Number.isFinite(marginPct) && marginPct < LOW_GROSS_MARGIN_THRESHOLD_PCT;
}

export type PriceReadinessLine = Pick<
  EstimateLineItem,
  "priceReadiness" | "costType" | "description" | "unitOfMeasure" | "lineCost"
>;

/**
 * Whether a saved line is an allowance line (DES-10 Price-stage allowance
 * signals). An allowance is a lump-sum line: the measurement contract
 * defines the allowance takeoff family as a priced lump sum, never a
 * measured quantity (`familyForUnit("LS") === "allowance"` in
 * `app/modules/assemblies-database/measurement.ts`), and the web-side unit
 * normalizer maps the ALLOWANCE alias onto LS
 * (`normalizeUnit` in `@/components/costbook/assembly-catalog-model`).
 * This is the estimate-side allowance: the F8 proposal allowances live on
 * a Proposal, which does not exist yet at Price stage, so they are not the
 * source for this signal.
 *
 * Limitation, stated plainly: the Figma Price frame (378:442) separates
 * its two allowance rows (Permit allowance, Jobsite cleanup) from its six
 * priced work lines by role, and four of those six work lines are also
 * lump-sum units — estimate data carries no allowance flag that records
 * that role distinction. The signal therefore covers lump-sum lines as
 * the codebase's allowance family, and says so in the UI.
 */
export function isAllowanceLine(line: Pick<EstimateLineItem, "unitOfMeasure">): boolean {
  const normalized = line.unitOfMeasure
    .trim()
    .toUpperCase()
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ");
  return normalized === "LS" || normalized === "LUMP SUM" || normalized === "ALLOWANCE";
}

export interface PriceReadinessCounts {
  missing: number;
  toReview: number;
  /**
   * Lines the readiness lookup never evaluated (priceReadiness undefined):
   * the lookup failed for the estimate, so no supplier-price signal exists
   * for them. Distinct from `null`, which means no supplier price backs
   * the line and no signal applies.
   */
  unchecked: number;
}

export interface PriceReadinessSummary {
  total: number;
  missing: number;
  unverified: number;
  /** warn / refresh / reject lines: dated prices past their review window. */
  stale: number;
  /** Lines whose price needs a review: unverified + stale. */
  toReview: number;
  /** Lines the readiness lookup never evaluated (priceReadiness undefined). */
  unchecked: number;
  /** Descriptions of lines with no recorded price, in estimate order. */
  missingLines: string[];
  /** Descriptions of lines whose price needs a review, in estimate order. */
  toReviewLines: string[];
  /** Descriptions of lines the readiness lookup never evaluated, in estimate order. */
  uncheckedLines: string[];
  /** Per cost-type counts, for the direct-cost breakdown groups. */
  byCostType: Record<string, PriceReadinessCounts>;
  /** Lump-sum (allowance) lines. */
  allowances: number;
  /** Sum of allowance line costs in dollars; null when any is invalid. */
  allowanceTotal: number | null;
  /** Allowance lines with no amount recorded (lineCost not a positive finite number). */
  unsetAllowances: number;
  /** Descriptions of allowance lines, in estimate order. */
  allowanceLines: string[];
  /** Descriptions of unset allowance lines, in estimate order. */
  unsetAllowanceLines: string[];
  /** Per cost-type allowance counts, for the direct-cost breakdown groups. */
  allowancesByCostType: Record<string, number>;
}

const EMPTY_COUNTS: PriceReadinessCounts = { missing: 0, toReview: 0, unchecked: 0 };

export function priceReadinessCountsFor(
  summary: PriceReadinessSummary,
  costType: string,
): PriceReadinessCounts {
  return summary.byCostType[costType] ?? EMPTY_COUNTS;
}

export function allowanceCountFor(summary: PriceReadinessSummary, costType: string): number {
  return summary.allowancesByCostType[costType] ?? 0;
}

export function summarizePriceReadiness(
  lineItems: ReadonlyArray<PriceReadinessLine>,
): PriceReadinessSummary {
  const summary: PriceReadinessSummary = {
    total: lineItems.length,
    missing: 0,
    unverified: 0,
    stale: 0,
    toReview: 0,
    unchecked: 0,
    missingLines: [],
    toReviewLines: [],
    uncheckedLines: [],
    byCostType: {},
    allowances: 0,
    allowanceTotal: 0,
    unsetAllowances: 0,
    allowanceLines: [],
    unsetAllowanceLines: [],
    allowancesByCostType: {},
  };
  const allowanceCents: number[] = [];
  const countsFor = (costType: string): PriceReadinessCounts => {
    const existing = summary.byCostType[costType];
    if (existing) return existing;
    const created: PriceReadinessCounts = { missing: 0, toReview: 0, unchecked: 0 };
    summary.byCostType[costType] = created;
    return created;
  };
  for (const line of lineItems) {
    if (isAllowanceLine(line)) {
      // Lump-sum lines are the estimate-side allowances. Their amounts are
      // estimator-entered, not supplier-verified: a priced lump-sum line
      // carries no supplier signal (priceReadiness null), so without this
      // the Price stage never names them — the Figma Price frame lists
      // them as explicit allowance rows against the supported subtotal.
      summary.allowances += 1;
      summary.allowanceLines.push(line.description);
      summary.allowancesByCostType[line.costType] =
        (summary.allowancesByCostType[line.costType] ?? 0) + 1;
      if (!Number.isFinite(line.lineCost) || line.lineCost <= 0) {
        summary.unsetAllowances += 1;
        summary.unsetAllowanceLines.push(line.description);
      }
      allowanceCents.push(Math.round(line.lineCost * 100));
    }
    const readiness: EstimateLinePriceReadiness | null | undefined = line.priceReadiness;
    if (readiness === undefined) {
      // The readiness lookup failed for the estimate (getById returns lines
      // without the signal): these lines were never checked, so they must
      // not read as a completed omission check.
      summary.unchecked += 1;
      summary.uncheckedLines.push(line.description);
      countsFor(line.costType).unchecked += 1;
    } else if (readiness === "missing") {
      summary.missing += 1;
      summary.missingLines.push(line.description);
      countsFor(line.costType).missing += 1;
    } else if (readiness === "unverified" || readiness === "warn" || readiness === "refresh" || readiness === "reject") {
      summary.toReview += 1;
      if (readiness === "unverified") summary.unverified += 1;
      else summary.stale += 1;
      summary.toReviewLines.push(line.description);
      countsFor(line.costType).toReview += 1;
    }
  }
  // Cent-safe total, mirroring groupSavedDirectCosts: an invalid line cost
  // makes the total unavailable rather than silently becoming zero.
  const allowanceCentsSum = allowanceCents.reduce((total, amount) => total + amount, 0);
  summary.allowanceTotal =
    allowanceCents.every(Number.isSafeInteger) && Number.isSafeInteger(allowanceCentsSum)
      ? allowanceCentsSum / 100
      : null;
  return summary;
}
