/**
 * Shared trust-state vocabulary for cost data, whether it lives in the
 * read-only Knowledge Engine corpus (packages/knowledge-engine/) or a
 * researched candidate awaiting promotion into the relational Costbook
 * (see candidateCostItem.ts). Costbook owns this vocabulary because the
 * relational Costbook is the target authoritative pricing source; the
 * Knowledge Engine consumes/re-exposes it rather than defining its own.
 *
 * - "documented": traces to a recorded source, date, and review pass.
 * - "unverified-legacy": no recorded source/date/review trail exists.
 *   This is the safe default for any datum whose provenance cannot be
 *   established, per the 2026-09-08 Costbook/Knowledge Engine audit
 *   (docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md).
 * - "placeholder": the source itself states the price is a stand-in, not
 *   a real observed cost (e.g. Knowledge Engine Tree Service items, which
 *   self-label `pricingStatus: "PLACEHOLDER"`).
 *
 * None of these states may be read as "verified," "current," "local," or
 * "nationally authoritative" — only "documented" claims a traceable
 * source at all, and even that is not a claim of current market pricing.
 */
export const costDataProvenanceStatus = ["documented", "unverified-legacy", "placeholder"] as const;

export type CostDataProvenanceStatus = (typeof costDataProvenanceStatus)[number];

export const DEFAULT_COST_DATA_PROVENANCE_STATUS: CostDataProvenanceStatus = "unverified-legacy";

const KNOWN_STATUSES: ReadonlySet<string> = new Set(costDataProvenanceStatus);

export function isCostDataProvenanceStatus(value: unknown): value is CostDataProvenanceStatus {
  return typeof value === "string" && KNOWN_STATUSES.has(value);
}

/**
 * Normalizes an untrusted/optional value (typically parsed from JSON on
 * disk or submitted by a caller) to a known provenance status. Anything
 * unrecognized or missing resolves to the safe default rather than being
 * silently treated as documented.
 */
export function normalizeCostDataProvenanceStatus(value: unknown): CostDataProvenanceStatus {
  return isCostDataProvenanceStatus(value) ? value : DEFAULT_COST_DATA_PROVENANCE_STATUS;
}
