import type {
  CandidateMatchStatus,
  CostbookCandidateReviewStatus,
  CostbookResearchCandidate,
  CostDataProvenanceStatus,
} from "@/lib/costbook-api";

/**
 * Pure presentation logic for the Costbook research-review queue, kept out of
 * the page component so the rules that decide what a reviewer may do are unit
 * tested rather than asserted against markup.
 *
 * The backend is the authorization boundary (costbook.manage on review and
 * promote). Everything here only decides what to *show*.
 */

export interface ResearchReviewCapabilities {
  /** costbook.write: may submit or ingest a new candidate. */
  canIngest: boolean;
  canReview: boolean;
  canPromote: boolean;
  /** Whether to render the decision controls at all. */
  showActions: boolean;
}

export function getResearchReviewCapabilities(canWrite: boolean, canManage: boolean): ResearchReviewCapabilities {
  return {
    canIngest: canWrite,
    // Reviewing and promoting are both costbook.manage actions, mirroring the
    // supplier price-review boundary. costbook.write alone only allows
    // submitting a candidate, never deciding on one.
    canReview: canManage,
    canPromote: canManage,
    showActions: canManage,
  };
}

/** A candidate is open for a decision only while nobody has decided yet. */
export function isOpenForReview(candidate: Pick<CostbookResearchCandidate, "reviewStatus">): boolean {
  return candidate.reviewStatus === "candidate" || candidate.reviewStatus === "needs-review";
}

/**
 * Promotion requires an approved review AND that the candidate has not already
 * become a Cost Item. This mirrors the server's own gate; the server re-checks
 * it inside a transaction, so this is a UI affordance, not the guarantee.
 */
export function isPromotable(
  candidate: Pick<CostbookResearchCandidate, "reviewStatus" | "promotedCostItemId">
): boolean {
  return candidate.reviewStatus === "approved" && candidate.promotedCostItemId === null;
}

export function reviewStatusLabel(status: CostbookCandidateReviewStatus): string {
  switch (status) {
    case "candidate":
      return "New";
    case "needs-review":
      return "Needs review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

/**
 * Plain-language trust labels. None of these may read as "verified" or
 * "current market" pricing - only "documented" claims a traceable source at
 * all, and even that is not a claim about today's prices.
 */
export function provenanceLabel(status: CostDataProvenanceStatus): string {
  switch (status) {
    case "documented":
      return "Documented source";
    case "placeholder":
      return "Placeholder price";
    case "unverified-legacy":
      return "Unverified legacy";
    default:
      return status;
  }
}

export function provenanceExplanation(status: CostDataProvenanceStatus): string {
  switch (status) {
    case "documented":
      return "Traces to a recorded source, date, and review pass. Not a claim of current local market pricing.";
    case "placeholder":
      return "The source itself states this price is a stand-in, not an observed cost.";
    case "unverified-legacy":
      return "No recorded source, date, or review trail exists for this price.";
    default:
      return "Unrecognized provenance state; treat as unverified.";
  }
}

export function matchStatusLabel(status: CandidateMatchStatus): string {
  switch (status) {
    case "new-candidate":
      return "No existing match";
    case "probable-match":
      return "Probable match";
    case "ambiguous-match":
      return "Ambiguous match";
    case "conflict":
      return "Unit conflict";
    default:
      return status;
  }
}

/**
 * Maps a candidate review status onto the shared StatusBadge vocabulary.
 * StatusBadge lowercases and underscores its input, so these strings are the
 * pre-normalized tokens it already understands.
 */
export function reviewStatusBadgeToken(status: CostbookCandidateReviewStatus): string {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "needs-review":
      return "needs_attention";
    case "candidate":
    default:
      return "pending";
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** Signed, human-readable delta. Returns null when there is nothing to compare. */
export function formatPriceDelta(delta: number | null, deltaPct: number | null): string | null {
  if (delta === null) return null;
  const sign = delta > 0 ? "+" : "";
  const amount = `${sign}${formatCurrency(delta)}`;
  if (deltaPct === null) return amount;
  return `${amount} (${sign}${deltaPct.toFixed(1)}%)`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

/**
 * How stale the research is, in whole days, measured from the source's own
 * observation date. Returns null for an unparseable date rather than guessing.
 */
export function freshnessInDays(sourceDate: string, now: Date = new Date()): number | null {
  const observed = new Date(`${sourceDate}T00:00:00.000Z`);
  if (Number.isNaN(observed.getTime())) return null;
  const diffMs = now.getTime() - observed.getTime();
  return Math.floor(diffMs / 86_400_000);
}

export function freshnessLabel(sourceDate: string, now: Date = new Date()): string {
  const days = freshnessInDays(sourceDate, now);
  if (days === null) return "Unknown";
  if (days < 0) return "Dated in the future";
  if (days === 0) return "Today";
  if (days === 1) return "1 day old";
  if (days < 365) return `${days} days old`;
  const years = Math.floor(days / 365);
  return years === 1 ? "Over 1 year old" : `Over ${years} years old`;
}
