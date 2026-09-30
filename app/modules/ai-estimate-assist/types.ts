import { CostDataProvenanceStatus } from "../costbook/provenance";
import { CostbookCandidateConfidence, costbookCandidateConfidence } from "../costbook/candidateCostItem";

export type { CostDataProvenanceStatus } from "../costbook/provenance";

// Item-level source/citation detail for the Knowledge Engine record a suggestion or
// draft line item was matched from (see cost-item.schema.json and
// docs/reports/COSTBOOK_ITEM_PROVENANCE_METADATA_2026-09-09.md). Deliberately not named
// `confidence` — that name is already the 0-100 match-confidence score on the suggestion
// itself; this is the separate low/medium/high data-quality confidence for the source.
export interface AIEstimateProvenanceDetail {
  sourceName?: string;
  sourceUrl?: string;
  sourceIdentifier?: string;
  sourceDate?: string;
  retrievedAt?: string;
  confidence?: CostbookCandidateConfidence;
  reviewedBy?: string;
  reviewedAt?: string;
}

export function extractProvenanceDetail(metadata: Record<string, unknown> | undefined): AIEstimateProvenanceDetail | undefined {
  if (!metadata) return undefined;
  const stringField = (key: string): string | undefined => {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  const detail: AIEstimateProvenanceDetail = {};
  const sourceName = stringField("sourceName");
  const sourceUrl = stringField("sourceUrl");
  const sourceIdentifier = stringField("sourceIdentifier");
  const sourceDate = stringField("sourceDate");
  const retrievedAt = stringField("retrievedAt");
  const reviewedBy = stringField("reviewedBy");
  const reviewedAt = stringField("reviewedAt");
  if (sourceName) detail.sourceName = sourceName;
  if (sourceUrl) detail.sourceUrl = sourceUrl;
  if (sourceIdentifier) detail.sourceIdentifier = sourceIdentifier;
  if (sourceDate) detail.sourceDate = sourceDate;
  if (retrievedAt) detail.retrievedAt = retrievedAt;
  if (reviewedBy) detail.reviewedBy = reviewedBy;
  if (reviewedAt) detail.reviewedAt = reviewedAt;

  const confidenceValue = metadata["confidence"];
  if (typeof confidenceValue === "string" && (costbookCandidateConfidence as readonly string[]).includes(confidenceValue)) {
    detail.confidence = confidenceValue as CostbookCandidateConfidence;
  }

  return Object.keys(detail).length > 0 ? detail : undefined;
}

export type AIEstimateSuggestionKind = "assembly" | "costItem";
export type AIEstimateSuggestionStatus = "pending" | "accepted" | "rejected";

export interface AIEstimateSuggestionTarget {
  id: string;
  kind: AIEstimateSuggestionKind;
  code: string;
  name: string;
  unitOfMeasure: string;
  matchMethod: "id" | "exact-name" | "contains-name";
  matchScore: number;
}

export interface AIEstimateSuggestionResolution {
  status: "resolved" | "unresolved";
  reason: string;
  target: AIEstimateSuggestionTarget | null;
}

export interface AIEstimateSuggestion {
  id: string;
  kind: AIEstimateSuggestionKind;
  code: string;
  title: string;
  rationale: string;
  quantity: number;
  unit: string;
  confidence: number;
  resolution: AIEstimateSuggestionResolution;
  // Trust state of the Knowledge Engine pricing this suggestion was
  // matched from. Additive field — see app/modules/costbook/provenance.ts.
  // Never implies verified/current/local/nationally-authoritative pricing.
  provenanceStatus: CostDataProvenanceStatus;
  // Item-level source citation, when the matched record carries one. Additive
  // field, present only when the underlying record has real provenance metadata.
  provenanceDetail?: AIEstimateProvenanceDetail;
}

export interface GenerateAIEstimateSuggestionsInput {
  estimateId: string;
  orgId: string;
  scopeOfWork: string;
}

export interface ReviewedAIEstimateSuggestionInput {
  id: string;
  kind: AIEstimateSuggestionKind;
  title: string;
  quantity: number;
  status: AIEstimateSuggestionStatus;
  description?: string;
  targetId?: string;
  targetKind?: AIEstimateSuggestionKind;
}

export interface ApplyAIEstimateSuggestionsInput {
  estimateId: string;
  orgId: string;
  suggestions: ReviewedAIEstimateSuggestionInput[];
}

export interface AppliedAIEstimateSuggestion {
  suggestionId: string;
  lineItemId: string;
  title: string;
  quantity: number;
}

export interface SkippedAIEstimateSuggestion {
  suggestionId: string;
  title: string;
  status: AIEstimateSuggestionStatus;
  reason: string;
}

export type AIEstimatorToolName =
  | "scope.parse"
  | "knowledge.match"
  | "costbook.resolve-targets"
  | "costbook.retrieve-pricing"
  | "estimate.validate";

export interface AIEstimatorToolRun {
  name: AIEstimatorToolName;
  status: "passed" | "warning" | "failed";
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedScopeQuantity {
  type: "area" | "length" | "volume" | "count" | "squares" | "hours" | "dimension";
  value: number;
  unit: "SF" | "LF" | "CY" | "EA" | "SQ" | "HR";
  sourceText: string;
}

export interface ParsedContractorScope {
  normalizedText: string;
  detectedTrade: string | null;
  quantities: ParsedScopeQuantity[];
  materials: string[];
  siteConstraints: string[];
  missingInformation: string[];
}

export interface AIEstimatorCostBreakdown {
  laborCostPerUnit: number;
  materialCostPerUnit: number;
  equipmentCostPerUnit: number;
  totalUnitCost: number;
  componentCount?: number;
}

export interface StructuredEstimateDraftLineItem {
  draftLineItemId: string;
  source: "knowledge-runtime";
  reviewToken: string | null;
  targetKind: AIEstimateSuggestionKind;
  targetId: string | null;
  targetCode: string | null;
  targetName: string | null;
  targetResolution: AIEstimateSuggestionResolution;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
  confidence: number;
  rationale: string;
  reviewWarnings: string[];
  costBreakdown: AIEstimatorCostBreakdown | null;
  // See AIEstimateSuggestion.provenanceStatus above.
  provenanceStatus: CostDataProvenanceStatus;
  // See AIEstimateSuggestion.provenanceDetail above.
  provenanceDetail?: AIEstimateProvenanceDetail;
}

export interface StructuredEstimateDraftValidation {
  status: "ready_for_review" | "needs_review" | "blocked";
  reviewRequired: true;
  missingInformation: string[];
  warnings: string[];
}

export interface StructuredEstimateDraft {
  generationId?: string;
  estimateId: string;
  orgId: string;
  projectId: string;
  scopeOfWork: string;
  parsedScope: ParsedContractorScope;
  detectedTrade: string | null;
  confidenceScore: number;
  lineItems: StructuredEstimateDraftLineItem[];
  subtotalCost: number;
  validation: StructuredEstimateDraftValidation;
  toolRuns: AIEstimatorToolRun[];
}

export interface GenerateStructuredEstimateInput {
  estimateId: string;
  orgId: string;
  actorUserId?: string;
  scopeOfWork: string;
  limit?: number;
}

export interface ReviewedStructuredEstimateLineItemInput {
  draftLineItemId: string;
  status: AIEstimateSuggestionStatus;
  reviewToken?: string;
  targetId?: string;
  targetKind?: AIEstimateSuggestionKind;
  description?: string;
  quantity: number;
}

export interface ApplyStructuredEstimateInput {
  generationId?: string;
  estimateId: string;
  orgId: string;
  actorUserId?: string;
  lineItems: ReviewedStructuredEstimateLineItemInput[];
}
