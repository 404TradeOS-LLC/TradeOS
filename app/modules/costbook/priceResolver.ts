import { normalizeCostbookUnit } from "./canonicalProductMatcher";

export type PriceEvidenceTier =
  | "ACTUAL_CONTRACTOR_PURCHASE"
  | "NEGOTIATED_SUPPLIER_PRICE"
  | "AUTHORIZED_LOCAL_SUPPLIER_PRICE"
  | "COMMERCIAL_COUNTY_PRICE"
  | "RECENT_RETAIL_VALIDATION"
  | "REGIONAL_MODEL"
  | "NATIONAL_MODEL";

export type PriceConfidence = "VERIFIED" | "HIGH" | "MEDIUM" | "LOW" | "ASSUMED" | "STALE";
export type PriceFreshnessState = "current" | "warn" | "refresh" | "reject";

export interface PriceEvidenceCandidate {
  id: string;
  canonicalMaterialKey: string;
  price: number;
  currency: string;
  unit: string;
  evidenceTier: PriceEvidenceTier;
  confidence: PriceConfidence;
  observedAt: Date;
  tenantId: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  storeName?: string | null;
  postalCode?: string | null;
  source: string;
  sourceUrl?: string | null;
  verifiedVsInferred: "observed" | "inferred";
  preferredSupplier?: boolean;
}

export interface ResolvedPriceAlternative {
  id: string;
  price: number;
  currency: string;
  unit: string;
  evidenceTier: PriceEvidenceTier;
  confidence: PriceConfidence;
  freshness: PriceFreshnessState;
  observedAt: string;
  supplierName: string | null;
  storeName: string | null;
  postalCode: string | null;
  source: string;
  sourceUrl: string | null;
  verifiedVsInferred: "observed" | "inferred";
  score: number;
}

export interface ResolvedPrice {
  canonicalMaterialKey: string;
  selectedPrice: number;
  currency: string;
  unit: string;
  source: string;
  supplierName: string | null;
  storeName: string | null;
  postalCode: string | null;
  observedAt: string;
  confidence: PriceConfidence;
  evidenceTier: PriceEvidenceTier;
  verifiedVsInferred: "observed" | "inferred";
  freshness: PriceFreshnessState;
  sourceUrl: string | null;
  alternatives: ResolvedPriceAlternative[];
  oneLineProvenance: string;
  reasonSelected: string;
  warnings: string[];
}

export interface ResolvePriceInput {
  tenantId: string;
  canonicalMaterialKey: string;
  unit?: string | null;
  postalCode?: string | null;
  now?: Date;
  candidates: readonly PriceEvidenceCandidate[];
}

interface ScoredPriceCandidate {
  candidate: PriceEvidenceCandidate;
  freshness: PriceFreshnessState;
  score: number;
}

const tierScore: Record<PriceEvidenceTier, number> = {
  ACTUAL_CONTRACTOR_PURCHASE: 1,
  NEGOTIATED_SUPPLIER_PRICE: 0.86,
  AUTHORIZED_LOCAL_SUPPLIER_PRICE: 0.72,
  COMMERCIAL_COUNTY_PRICE: 0.58,
  RECENT_RETAIL_VALIDATION: 0.44,
  REGIONAL_MODEL: 0.30,
  NATIONAL_MODEL: 0.14,
};

const confidenceScore: Record<PriceConfidence, number> = {
  VERIFIED: 1,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.3,
  ASSUMED: 0.1,
  STALE: 0,
};

const freshnessLimitDays: Record<PriceEvidenceTier, { current: number; warn: number; refresh: number }> = {
  ACTUAL_CONTRACTOR_PURCHASE: { current: 90, warn: 180, refresh: 180 },
  NEGOTIATED_SUPPLIER_PRICE: { current: 7, warn: 14, refresh: 30 },
  AUTHORIZED_LOCAL_SUPPLIER_PRICE: { current: 7, warn: 14, refresh: 30 },
  COMMERCIAL_COUNTY_PRICE: { current: 30, warn: 60, refresh: 120 },
  RECENT_RETAIL_VALIDATION: { current: 30, warn: 60, refresh: 90 },
  REGIONAL_MODEL: { current: 30, warn: 60, refresh: 90 },
  NATIONAL_MODEL: { current: 30, warn: 60, refresh: 90 },
};

export function priceFreshness(
  tier: PriceEvidenceTier,
  observedAt: Date,
  now: Date = new Date()
): PriceFreshnessState {
  if (observedAt.getTime() > now.getTime()) return "reject";
  const ageDays = Math.max(0, (now.getTime() - observedAt.getTime()) / 86_400_000);
  const limits = freshnessLimitDays[tier];
  if (ageDays <= limits.current) return "current";
  if (ageDays <= limits.warn) return "warn";
  if (ageDays <= limits.refresh) return "refresh";
  return "reject";
}

export function resolvePrice(input: ResolvePriceInput): ResolvedPrice | null {
  const now = input.now ?? new Date();
  const requestedUnit = normalizeUnit(input.unit);

  const scored: ScoredPriceCandidate[] = input.candidates.flatMap((candidate) => {
    if (candidate.canonicalMaterialKey !== input.canonicalMaterialKey) return [];
    if (candidate.tenantId !== null && candidate.tenantId !== input.tenantId) return [];
    if (!Number.isFinite(candidate.price) || candidate.price <= 0) return [];

    const candidateUnit = normalizeUnit(candidate.unit);
    if (requestedUnit && candidateUnit !== requestedUnit) return [];

    const freshness = priceFreshness(candidate.evidenceTier, candidate.observedAt, now);
    if (freshness === "reject" || candidate.confidence === "STALE") return [];

    const recency = recencyScore(candidate.evidenceTier, candidate.observedAt, now);
    const samePostalCode =
      Boolean(input.postalCode) && Boolean(candidate.postalCode) && input.postalCode === candidate.postalCode;
    const locationScore = samePostalCode ? 1 : candidate.postalCode ? 0.5 : 0.25;
    const preferredSupplierScore = candidate.preferredSupplier ? 1 : 0.5;

    const score =
      tierScore[candidate.evidenceTier] * 0.5 +
      recency * 0.2 +
      confidenceScore[candidate.confidence] * 0.15 +
      locationScore * 0.1 +
      preferredSupplierScore * 0.05;

    return [{
      candidate,
      freshness,
      score,
    }];
  }).sort((a, b) =>
    b.score - a.score ||
    b.candidate.observedAt.getTime() - a.candidate.observedAt.getTime() ||
    a.candidate.id.localeCompare(b.candidate.id)
  );

  const winner = scored[0];
  if (!winner) return null;

  const toAlternative = (entry: ScoredPriceCandidate): ResolvedPriceAlternative => ({
    id: entry.candidate.id,
    price: entry.candidate.price,
    currency: entry.candidate.currency,
    unit: normalizeCostbookUnit(entry.candidate.unit),
    evidenceTier: entry.candidate.evidenceTier,
    confidence: entry.candidate.confidence,
    freshness: entry.freshness,
    observedAt: entry.candidate.observedAt.toISOString(),
    supplierName: entry.candidate.supplierName ?? null,
    storeName: entry.candidate.storeName ?? null,
    postalCode: entry.candidate.postalCode ?? null,
    source: entry.candidate.source,
    sourceUrl: entry.candidate.sourceUrl ?? null,
    verifiedVsInferred: entry.candidate.verifiedVsInferred,
    score: round4(entry.score),
  });

  const selected = winner.candidate;
  const warnings: string[] = [];
  if (winner.freshness !== "current") warnings.push(`Price evidence is ${winner.freshness} and should be refreshed when possible.`);
  if (selected.verifiedVsInferred === "inferred") warnings.push("Selected price is inferred rather than directly observed.");

  return {
    canonicalMaterialKey: selected.canonicalMaterialKey,
    selectedPrice: selected.price,
    currency: selected.currency,
    unit: normalizeCostbookUnit(selected.unit),
    source: selected.source,
    supplierName: selected.supplierName ?? null,
    storeName: selected.storeName ?? null,
    postalCode: selected.postalCode ?? null,
    observedAt: selected.observedAt.toISOString(),
    confidence: selected.confidence,
    evidenceTier: selected.evidenceTier,
    verifiedVsInferred: selected.verifiedVsInferred,
    freshness: winner.freshness,
    sourceUrl: selected.sourceUrl ?? null,
    alternatives: scored.slice(1, 6).map(toAlternative),
    oneLineProvenance: oneLineProvenance(selected),
    reasonSelected: explainSelection(selected, winner.freshness),
    warnings,
  };
}

function recencyScore(tier: PriceEvidenceTier, observedAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - observedAt.getTime()) / 86_400_000);
  const rejectionAge = freshnessLimitDays[tier].refresh;
  if (rejectionAge <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - ageDays / rejectionAge));
}

function oneLineProvenance(candidate: PriceEvidenceCandidate): string {
  const supplier = candidate.supplierName ?? candidate.source;
  const location = candidate.storeName ?? candidate.postalCode;
  const tier = candidate.evidenceTier.toLowerCase().replace(/_/g, " ");
  const date = candidate.observedAt.toISOString().slice(0, 10);
  return [supplier, location, tier, date].filter(Boolean).join(" · ");
}

function explainSelection(candidate: PriceEvidenceCandidate, freshness: PriceFreshnessState): string {
  const source = candidate.supplierName ?? candidate.source;
  const tier = candidate.evidenceTier.toLowerCase().replace(/_/g, " ");
  return `${source} was selected as the highest-trust relevant ${tier} evidence after tier, recency, confidence, location, and contractor preference were evaluated; freshness is ${freshness}.`;
}

function normalizeUnit(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return normalizeCostbookUnit(value);
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
