import "server-only";
import { apiFetch } from "@/lib/api";
import { buildCostbookQuery, type CostbookListParams } from "@/lib/costbook-query";
import type { CatalogPage } from "@/lib/api";

export interface CostbookAssembly {
  id: string;
  orgId: string | null;
  code: string;
  name: string;
  unitOfMeasure: string;
  description: string | null;
  isTemplate: boolean;
  isActive: boolean;
}

export interface CostbookAssemblyItem {
  id: string;
  assemblyId: string;
  costItemId: string | null;
  childAssemblyId: string | null;
  quantityPerUnit: number;
  sortOrder: number;
  componentType: "cost_item" | "assembly";
  componentCode: string;
  componentName: string;
  componentUnitOfMeasure: string;
}

export interface CostbookAssemblyUnitCost {
  unitCost: number;
  componentCount: number;
}

export type CostbookPriceConfidence = "VERIFIED" | "HIGH" | "MEDIUM" | "LOW" | "ASSUMED" | "STALE";
export type CostbookPriceFreshness = "current" | "warn" | "refresh" | "reject";
export type CostbookPriceEvidenceTier =
  | "ACTUAL_CONTRACTOR_PURCHASE"
  | "NEGOTIATED_SUPPLIER_PRICE"
  | "AUTHORIZED_LOCAL_SUPPLIER_PRICE"
  | "COMMERCIAL_COUNTY_PRICE"
  | "RECENT_RETAIL_VALIDATION"
  | "REGIONAL_MODEL"
  | "NATIONAL_MODEL";

export interface CostbookResolvedPriceAlternative {
  id: string;
  price: number;
  currency: string;
  unit: string;
  evidenceTier: CostbookPriceEvidenceTier;
  confidence: CostbookPriceConfidence;
  freshness: CostbookPriceFreshness;
  observedAt: string;
  supplierName: string | null;
  storeName: string | null;
  postalCode: string | null;
  source: string;
  sourceUrl: string | null;
  verifiedVsInferred: "observed" | "inferred";
  score: number;
}

export interface CostbookResolvedPrice {
  canonicalMaterialKey: string;
  selectedPrice: number;
  currency: string;
  unit: string;
  source: string;
  supplierName: string | null;
  storeName: string | null;
  postalCode: string | null;
  observedAt: string;
  confidence: CostbookPriceConfidence;
  evidenceTier: CostbookPriceEvidenceTier;
  verifiedVsInferred: "observed" | "inferred";
  freshness: CostbookPriceFreshness;
  sourceUrl: string | null;
  alternatives: CostbookResolvedPriceAlternative[];
  oneLineProvenance: string;
  reasonSelected: string;
  warnings: string[];
}

export function resolveCostbookPrice(
  token: string,
  input: { canonicalMaterialKey: string; postalCode?: string; unit?: string }
) {
  const query = new URLSearchParams({ canonicalMaterialKey: input.canonicalMaterialKey });
  if (input.postalCode) query.set("postalCode", input.postalCode);
  if (input.unit) query.set("unit", input.unit);
  return apiFetch<CostbookResolvedPrice | null>(`/api/v1/costbook/pricing/resolve?${query.toString()}`, { token });
}
export interface CostbookPriceHistory {
  materialChanges: Array<{
    id: string;
    materialId: string;
    materialName: string;
    oldUnitCost: number;
    newUnitCost: number;
    source: string;
    actorUserId: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
  estimateSnapshots: Array<{
    id: string;
    estimateId: string;
    sourceType: "cost_item" | "assembly";
    sourceId: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitCost: number;
    lineCost: number;
    createdAt: string;
  }>;
}

export function listCostbookAssemblies(token: string, params: CostbookListParams = {}) {
  return apiFetch<CatalogPage<CostbookAssembly>>(`/api/v1/costbook/assemblies${buildCostbookQuery(params)}`, { token });
}

export function getCostbookAssembly(token: string, id: string) {
  return apiFetch<CostbookAssembly>(`/api/v1/costbook/assemblies/${id}`, { token });
}

export function listCostbookAssemblyItems(token: string, id: string, params: Pick<CostbookListParams, "limit" | "cursor" | "sort" | "order"> = {}) {
  return apiFetch<CatalogPage<CostbookAssemblyItem>>(
    `/api/v1/costbook/assemblies/${id}/items${buildCostbookQuery(params)}`,
    { token }
  );
}

export function getCostbookAssemblyUnitCost(token: string, id: string) {
  return apiFetch<CostbookAssemblyUnitCost>(`/api/v1/costbook/assemblies/${id}/unit-cost`, { token });
}

export interface CostbookPriceHistoryPage {
  materialChanges: CatalogPage<CostbookPriceHistory["materialChanges"][number]>;
  estimateSnapshots: CatalogPage<CostbookPriceHistory["estimateSnapshots"][number]>;
}

export function getCostbookPriceHistory(token: string, params: { limit?: number; materialCursor?: string; estimateCursor?: string } = {}) {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.materialCursor) query.set("materialCursor", params.materialCursor);
  if (params.estimateCursor) query.set("estimateCursor", params.estimateCursor);
  return apiFetch<CostbookPriceHistoryPage>(`/api/v1/costbook/price-history?${query.toString()}`, { token });
}

/**
 * Stage 6 research-candidate review queue. A candidate is researched pricing
 * awaiting an explicit human decision - never production Costbook pricing.
 * See docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md.
 */
export type CostbookCandidateReviewStatus = "candidate" | "needs-review" | "approved" | "rejected";
export type CostDataProvenanceStatus = "documented" | "unverified-legacy" | "placeholder";

export interface CostbookResearchCandidate {
  id: string;
  orgId: string;
  trade: string;
  category: string;
  itemName: string;
  description: string | null;
  unitOfMeasure: string;
  materialCostLow: number | null;
  materialCostTypical: number;
  materialCostHigh: number | null;
  laborHours: number | null;
  laborRateAssumption: number | null;
  equipmentCost: number;
  sourceName: string;
  sourceUrl: string | null;
  sourceIdentifier: string | null;
  sourceDate: string;
  retrievedAt: string;
  regionalBasis: string;
  confidence: string;
  researchNotes: string | null;
  provenanceStatus: CostDataProvenanceStatus;
  reviewStatus: CostbookCandidateReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  promotedAt: string | null;
  promotedByUserId: string | null;
  promotedCostItemId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostbookCandidateSummary {
  pendingReview: number;
  approved: number;
  rejected: number;
  promoted: number;
  awaitingPromotion: number;
  documented: number;
  unverifiedLegacy: number;
  placeholder: number;
  total: number;
}

export interface CostbookKnowledgeCorpusReport {
  totalItems: number;
  documented: number;
  unverifiedLegacy: number;
  placeholder: number;
  candidateReady: number;
  blocked: number;
  blockReasonCounts: Record<string, number>;
  interpretation: string;
}

export type CandidateMatchStatus = "new-candidate" | "probable-match" | "ambiguous-match" | "conflict";

export interface CostbookCandidateMatch {
  status: CandidateMatchStatus;
  bestMatch: {
    costItemId: string;
    code: string;
    name: string;
    unitOfMeasure: string;
    currentUnitCost: number | null;
    priceDelta: number | null;
    priceDeltaPct: number | null;
  } | null;
  comparisons: NonNullable<CostbookCandidateMatch["bestMatch"]>[];
  rationale: string;
}

export function listCostbookCandidates(
  token: string,
  params: CostbookListParams & { reviewStatus?: CostbookCandidateReviewStatus } = {}
) {
  const { reviewStatus, ...listParams } = params;
  const query = buildCostbookQuery(listParams);
  const suffix = reviewStatus ? `${query ? "&" : "?"}reviewStatus=${encodeURIComponent(reviewStatus)}` : "";
  return apiFetch<CatalogPage<CostbookResearchCandidate>>(`/api/v1/costbook/candidates${query}${suffix}`, { token });
}

export function getCostbookCandidate(token: string, id: string) {
  return apiFetch<CostbookResearchCandidate>(`/api/v1/costbook/candidates/${id}`, { token });
}

export function getCostbookCandidateSummary(token: string) {
  return apiFetch<CostbookCandidateSummary>("/api/v1/costbook/candidates/summary", { token });
}

export function getCostbookKnowledgeCorpusReport(token: string) {
  return apiFetch<CostbookKnowledgeCorpusReport>("/api/v1/costbook/candidates/corpus-report", { token });
}

export function getCostbookCandidateMatch(token: string, id: string) {
  return apiFetch<CostbookCandidateMatch>(`/api/v1/costbook/candidates/${id}/match`, { token });
}

export function reviewCostbookCandidate(
  token: string,
  id: string,
  input: { decision: "approved" | "rejected"; reviewNotes?: string }
) {
  return apiFetch<CostbookResearchCandidate>(`/api/v1/costbook/candidates/${id}/review`, {
    token,
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function promoteCostbookCandidate(token: string, id: string) {
  return apiFetch<CostbookResearchCandidate>(`/api/v1/costbook/candidates/${id}/promote`, {
    token,
    method: "POST",
    body: JSON.stringify({}),
  });
}
