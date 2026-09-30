import type { CreateCandidateInput } from "./candidateCostItemService";

/**
 * Jones & Sons (jonesandsons.com) is a branch-aware Shopify retailer with
 * selectable branches including Terre Haute, Vincennes, Washington, and
 * Bloomfield, Indiana. The site states that pricing, availability, and
 * delivery depend on the selected branch, so a price observed on a Jones &
 * Sons product page is NOT automatically Terre Haute pricing.
 *
 * This module only ever produces Costbook research candidates (see
 * candidateCostItem.ts) - never a direct Material/CostItem write. Every
 * record here still requires a named-human review + explicit promotion
 * before it can affect a tenant's production Costbook, exactly like
 * blsOewsTerreHaute.ts.
 *
 * Every record in TERRE_HAUTE_VERIFIED_RECORDS and
 * OBSERVED_UNVERIFIED_RECORDS below was supplied as seed evidence in the
 * task that requested this ingestion. No live HTTP request to
 * jonesandsons.com succeeded from the authoring session: the sandbox
 * network egress proxy returned EGRESS_BLOCKED for jonesandsons.com, and an
 * unrelated control domain (bls.gov) was blocked identically, confirming a
 * general egress restriction rather than a site-specific block. See
 * data/supplier-imports/jones-and-sons/README.md for the full writeup and
 * scripts/costbook-import-jones-and-sons.mjs for the (not yet executed)
 * crawler that can populate real data once run from an environment with
 * outbound access.
 */

export type JonesAndSonsBranch = "Terre Haute" | "Vincennes" | "Washington" | "Bloomfield";

export const JONES_AND_SONS_KNOWN_BRANCHES: readonly JonesAndSonsBranch[] = [
  "Terre Haute",
  "Vincennes",
  "Washington",
  "Bloomfield",
];

export const JONES_AND_SONS_SOURCE_NAME = "Jones & Sons, Inc.";
export const JONES_AND_SONS_TERRE_HAUTE_REGIONAL_BASIS =
  "Jones & Sons — Terre Haute, IN branch (3527 Erie Canal Road, Terre Haute, Indiana); pricing explicitly confirmed applicable to this branch on the source product page.";
export const JONES_AND_SONS_UNCONFIRMED_REGIONAL_BASIS =
  "Jones & Sons is a multi-branch Indiana retailer (Terre Haute, Vincennes, Washington, Bloomfield); this observation carries no branch-specific evidence, so it must not be read as Terre Haute-applicable.";

export interface JonesAndSonsRecord {
  /** Raw supplier product name, preserved verbatim. */
  supplierProductName: string;
  /** Canonical TradeOS-facing material name (does not replace supplierProductName). */
  normalizedMaterialName: string;
  supplierSku: string;
  trade: string;
  category: string;
  /** Size/gradation as shown by the supplier, e.g. `1" to 1/2"`. */
  size?: string;
  price: number;
  /** Supplier's own unit label, preserved for audit even after normalization. */
  supplierUnit?: string;
  /** Canonical TradeOS unit. See normalizeJonesAndSonsUnit(). */
  normalizedUnit: string;
  /** True only when normalizedUnit was inferred from category convention rather than read from the source. */
  unitAssumed: boolean;
  sourceUrl?: string;
  /** Present only when the source page explicitly showed Terre Haute pickup/availability. */
  terreHauteBranchEvidence?: string;
}

/**
 * Records whose source page explicitly showed Terre Haute branch
 * applicability. These map to `confidence: "high"` candidates with an
 * unambiguous regional basis - the only records this module will describe
 * as Terre Haute pricing.
 */
export const TERRE_HAUTE_VERIFIED_RECORDS: readonly JonesAndSonsRecord[] = [
  {
    supplierProductName: '#8/CA-11 Crushed Limestone (1" to 1/2")',
    normalizedMaterialName: "Crushed Limestone #8 / CA-11",
    supplierSku: "XX8.07",
    trade: "Sitework",
    category: "Aggregate",
    size: '1" to 1/2"',
    price: 29.75,
    supplierUnit: "ton",
    normalizedUnit: "ton",
    unitAssumed: false,
    sourceUrl: "https://jonesandsons.com/products/8-ca-11-crushed-limestone-1-to-1-2",
    terreHauteBranchEvidence: "Terre Haute pickup explicitly shown on the product page.",
  },
  {
    supplierProductName: '#11/CA-16 Crushed Limestone (1/2" to 3/32")',
    normalizedMaterialName: "Crushed Limestone #11 / CA-16",
    supplierSku: "XX11.07",
    trade: "Sitework",
    category: "Aggregate",
    size: '1/2" to 3/32"',
    price: 30.95,
    supplierUnit: "ton",
    normalizedUnit: "ton",
    unitAssumed: false,
    sourceUrl: "https://jonesandsons.com/products/11-ca-16-crushed-limestone-1-2-to-3-32",
    terreHauteBranchEvidence: "Terre Haute pickup explicitly shown on the product page.",
  },
];

/**
 * Records observed on jonesandsons.com without a captured source URL or
 * confirmed branch applicability. The task's own seed evidence explicitly
 * flags these as "not explicitly Terre Haute-specific during extraction"
 * and forbids promoting them to Terre Haute-verified without current
 * evidence. They map to low-confidence candidates carrying an explicit
 * "unconfirmed regional scope" basis - never Terre Haute.
 *
 * `supplierUnit` is intentionally absent for all of these: the seed
 * evidence did not include a unit, so `normalizedUnit` below is an assumed
 * "ton" (the observed convention for bulk aggregate/sand products at this
 * supplier), flagged via `unitAssumed: true` rather than silently asserted.
 */
export const OBSERVED_UNVERIFIED_RECORDS: readonly JonesAndSonsRecord[] = [
  {
    supplierProductName: '#53 Crushed Limestone (1 1/2" to Dust)',
    normalizedMaterialName: "Crushed Limestone #53",
    supplierSku: "XX53.01",
    trade: "Sitework",
    category: "Aggregate",
    size: '1 1/2" to Dust',
    price: 23.95,
    normalizedUnit: "ton",
    unitAssumed: true,
  },
  {
    supplierProductName: '#11 Crushed Limestone (1/2" to 3/32")',
    normalizedMaterialName: "Crushed Limestone #11",
    supplierSku: "XX11.01",
    trade: "Sitework",
    category: "Aggregate",
    size: '1/2" to 3/32"',
    price: 31.95,
    normalizedUnit: "ton",
    unitAssumed: true,
  },
  {
    supplierProductName: '#5 Crushed Limestone (1 1/2" to 3/32")',
    normalizedMaterialName: "Crushed Limestone #5",
    supplierSku: "XX5.01",
    trade: "Sitework",
    category: "Aggregate",
    size: '1 1/2" to 3/32"',
    price: 29.50,
    normalizedUnit: "ton",
    unitAssumed: true,
  },
  {
    supplierProductName: "#23 Washed Sand (Coarse)",
    normalizedMaterialName: "Washed Sand (Coarse) #23",
    supplierSku: "XXWS.01",
    trade: "Concrete",
    category: "Aggregate",
    price: 16.95,
    normalizedUnit: "ton",
    unitAssumed: true,
  },
  {
    supplierProductName: 'Pea Gravel (1/2" to 1/4")',
    normalizedMaterialName: "Pea Gravel",
    supplierSku: "XXPG.01",
    trade: "Sitework",
    category: "Aggregate",
    size: '1/2" to 1/4"',
    price: 24.75,
    normalizedUnit: "ton",
    unitAssumed: true,
  },
  {
    supplierProductName: "Mortar Sand (Fine)",
    normalizedMaterialName: "Mortar Sand (Fine)",
    supplierSku: "XXMS.01",
    trade: "Masonry",
    category: "Sand",
    price: 37.00,
    normalizedUnit: "ton",
    unitAssumed: true,
  },
];

/**
 * Ready-mix concrete is deliberately NOT represented as a candidate. Jones &
 * Sons quotes ready-mix per yard through dispatch at order time; the
 * candidate schema requires a real positive materialCostTypical, and
 * fabricating one here would misrepresent a quote-only material as a fixed
 * price. This export exists purely as documented, non-priced availability
 * metadata for the Costbook UI/API to optionally surface - it is not a
 * CreateCandidateInput and nothing in this module or its tests treats it as
 * promotable.
 */
export interface JonesAndSonsQuoteRequiredAvailability {
  supplier: string;
  supplierBranch: JonesAndSonsBranch;
  productName: string;
  pricingModel: "per_yard_via_dispatch";
  conditions: readonly string[];
  price: null;
}

export const JONES_AND_SONS_READY_MIX_AVAILABILITY: JonesAndSonsQuoteRequiredAvailability = {
  supplier: JONES_AND_SONS_SOURCE_NAME,
  supplierBranch: "Terre Haute",
  productName: "Ready Mixed Concrete",
  pricingModel: "per_yard_via_dispatch",
  conditions: [
    "Terre Haute plant exists",
    "Orders should generally be placed at least 24 hours ahead",
    "Partial-load charges apply below 6 cubic yards",
    "Price is per yard, confirmed through dispatch at order time",
  ],
  price: null,
};

/**
 * Converts one Terre Haute branch-verified record into a governed Costbook
 * research candidate. `confidence: "high"` reflects source-quality only
 * (an explicit branch-scoped product page) - not a claim that the price is
 * currently accurate; researchNotes says so explicitly, matching the
 * disclosure pattern used by toBlsOewsLaborCandidate().
 */
export function toJonesAndSonsCandidate(
  record: JonesAndSonsRecord,
  options: { retrievedAt?: string; loggedDate?: string } = {}
): CreateCandidateInput {
  if (!(record.price > 0)) {
    throw new Error(
      `Jones & Sons record ${record.supplierSku} has a non-positive price (${record.price}); refusing to build a candidate rather than importing a zero/negative cost.`
    );
  }
  if (!record.sourceUrl && !record.supplierSku) {
    throw new Error("Jones & Sons record must carry a sourceUrl or supplierSku so the price stays traceable.");
  }

  const isBranchVerified = Boolean(record.terreHauteBranchEvidence && record.sourceUrl);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  // The exact original observation date was not captured by this session
  // (no live fetch succeeded). loggedDate honestly represents when this
  // evidence entered TradeOS's research pipeline, not a fabricated
  // "scraped on" date - see the module-level doc comment.
  const loggedDate = options.loggedDate ?? retrievedAt.slice(0, 10);

  const unitCaveat = record.unitAssumed
    ? ` Unit "${record.normalizedUnit}" was not confirmed by the source and is assumed from this supplier's bulk-aggregate convention.`
    : "";

  return {
    trade: record.trade,
    category: record.category,
    itemName: record.normalizedMaterialName,
    description: `${record.supplierProductName}${record.size ? ` (${record.size})` : ""} — supplier SKU ${record.supplierSku}.`,
    unitOfMeasure: record.normalizedUnit,
    materialCostTypical: record.price,
    sourceName: JONES_AND_SONS_SOURCE_NAME,
    sourceUrl: record.sourceUrl,
    sourceIdentifier: `Jones & Sons SKU ${record.supplierSku}`,
    sourceDate: loggedDate,
    retrievedAt,
    regionalBasis: isBranchVerified
      ? JONES_AND_SONS_TERRE_HAUTE_REGIONAL_BASIS
      : JONES_AND_SONS_UNCONFIRMED_REGIONAL_BASIS,
    confidence: isBranchVerified ? "high" : "low",
    provenanceStatus: "documented",
    researchNotes: isBranchVerified
      ? `Terre Haute branch pickup was explicitly shown on the source product page at the time this evidence was captured. ` +
        `Source: ${record.sourceUrl}. Confidence reflects source-quality/traceability only, not that the price is currently ` +
        `accurate — Jones & Sons prices are branch- and time-dependent, and this record has not been re-fetched live in this ` +
        `session (network egress to jonesandsons.com was blocked); re-verify before promotion if the record is more than a few weeks old.`
      : `No source URL or branch selector evidence was captured for this record; branch applicability (Terre Haute, Vincennes, ` +
        `Washington, or Bloomfield) is unconfirmed. Do not treat this as Terre Haute pricing.${unitCaveat} Re-verify against a live, ` +
        `branch-selected product page before this candidate is reviewed or promoted.`,
  };
}

export function buildJonesAndSonsTerreHauteCandidates(
  options: { retrievedAt?: string; loggedDate?: string } = {}
): CreateCandidateInput[] {
  return TERRE_HAUTE_VERIFIED_RECORDS.map((record) => toJonesAndSonsCandidate(record, options));
}

export function buildJonesAndSonsObservedCandidates(
  options: { retrievedAt?: string; loggedDate?: string } = {}
): CreateCandidateInput[] {
  return OBSERVED_UNVERIFIED_RECORDS.map((record) => toJonesAndSonsCandidate(record, options));
}

/**
 * All currently available Jones & Sons candidates: Terre Haute-verified
 * first, then the lower-confidence observed records. Ready-mix concrete is
 * never included (see JONES_AND_SONS_READY_MIX_AVAILABILITY above).
 */
export function buildAllJonesAndSonsCandidates(
  options: { retrievedAt?: string; loggedDate?: string } = {}
): CreateCandidateInput[] {
  return [...buildJonesAndSonsTerreHauteCandidates(options), ...buildJonesAndSonsObservedCandidates(options)];
}

/**
 * Deduplicates candidate inputs by supplier SKU (encoded in sourceIdentifier
 * as `Jones & Sons SKU <sku>`), keeping the highest-confidence observation
 * for a given SKU. This guards against the same SKU appearing twice in a
 * future multi-run crawl merge; it is a no-op today since every seed SKU is
 * unique, and is covered by a dedicated test using synthetic duplicates.
 */
export function dedupeJonesAndSonsCandidatesBySku(candidates: readonly CreateCandidateInput[]): CreateCandidateInput[] {
  const confidenceRank: Record<CreateCandidateInput["confidence"], number> = { low: 0, medium: 1, high: 2 };
  const bySku = new Map<string, CreateCandidateInput>();

  for (const candidate of candidates) {
    const sku = candidate.sourceIdentifier ?? candidate.sourceUrl ?? candidate.itemName;
    const existing = bySku.get(sku);
    if (!existing || confidenceRank[candidate.confidence] > confidenceRank[existing.confidence]) {
      bySku.set(sku, candidate);
    }
  }

  return Array.from(bySku.values());
}
