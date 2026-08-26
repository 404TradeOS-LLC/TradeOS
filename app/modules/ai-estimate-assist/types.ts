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
