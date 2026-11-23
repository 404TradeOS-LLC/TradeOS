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

export type PriceReadinessLine = Pick<EstimateLineItem, "priceReadiness" | "costType" | "description">;

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
}

const EMPTY_COUNTS: PriceReadinessCounts = { missing: 0, toReview: 0, unchecked: 0 };

export function priceReadinessCountsFor(
  summary: PriceReadinessSummary,
  costType: string,
): PriceReadinessCounts {
  return summary.byCostType[costType] ?? EMPTY_COUNTS;
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
  };
  const countsFor = (costType: string): PriceReadinessCounts => {
    const existing = summary.byCostType[costType];
    if (existing) return existing;
    const created: PriceReadinessCounts = { missing: 0, toReview: 0, unchecked: 0 };
    summary.byCostType[costType] = created;
    return created;
  };
  for (const line of lineItems) {
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
  return summary;
}
