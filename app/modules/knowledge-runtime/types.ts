import { CostDataProvenanceStatus } from "../costbook/provenance";

export type { CostDataProvenanceStatus } from "../costbook/provenance";

export interface KnowledgeEnginePaths {
  repoRoot: string;
  exportsDir: string;
  knowledgeDir: string;
  schemasDir: string;
}

export interface KnowledgeRuntimeSourceFiles {
  costbookPath: string;
  assemblyIndexPath: string;
  tradeProgressPath: string;
  taxonomyPath: string;
  knowledgeAssembliesDir: string;
  knowledgeCostItemsDir: string;
}

export interface RawKnowledgeAssemblyLineItem {
  costBookItemId?: string;
  quantity?: number | string;
}

export interface RawKnowledgeAssembly {
  id: string;
  name: string;
  category: string;
  lineItems?: RawKnowledgeAssemblyLineItem[];
}

export interface RawKnowledgeCostItem {
  id: string;
  name: string;
  category: string;
  unit?: string | null;
  laborCost?: number | string | null;
  materialCost?: number | string | null;
  equipmentCost?: number | string | null;
  notes?: string | null;
}

export interface RawKnowledgeTradeProgressEntry {
  category: string;
  itemCount: number;
  status: string;
  coverage: string;
  notes: string;
  // Untyped/optional because this is parsed directly from JSON on disk; an
  // older or hand-edited trade-progress.json entry may omit it or carry an
  // unrecognized value. repository.ts normalizes this to a known
  // CostDataProvenanceStatus (defaulting to "unverified-legacy") rather than
  // trusting the raw string.
  provenanceStatus?: string;
}

export interface RawAssemblyIndexEntry {
  group: string;
  category: string;
  count: number;
  source: string;
  description: string;
}

export interface KnowledgeSourceSnapshot {
  paths: KnowledgeEnginePaths;
  sourceFiles: KnowledgeRuntimeSourceFiles;
  assemblies: RawKnowledgeAssembly[];
  costItems: RawKnowledgeCostItem[];
  tradeProgress: RawKnowledgeTradeProgressEntry[];
  assemblyIndex: RawAssemblyIndexEntry[];
  schemaFiles: string[];
  taxonomyText: string;
  knowledgeAssemblyFiles: string[];
  knowledgeCostItemFiles: string[];
  loadWarnings: string[];
}

export interface KnowledgeTrade {
  id: string;
  name: string;
  itemCount: number;
  status: string;
  coverage: string;
  notes: string;
  keywords: string[];
  provenanceStatus: CostDataProvenanceStatus;
}

export interface KnowledgeStats {
  readOnly: true;
  assembliesCount: number;
  costItemsCount: number;
  tradesCount: number;
  schemaCount: number;
  indexedKeywordCount: number;
  sourceFileCount: number;
  loadWarnings: string[];
  sources: {
    exportsDir: string;
    knowledgeDir: string;
    schemasDir: string;
  };
}

export interface KnowledgeAssemblyRecord {
  id: string;
  name: string;
  category: string;
  trade: string | null;
  unitOfMeasure: string | null;
  description: string;
  keywords: string[];
  metadata: {
    source: "knowledge-engine";
    lineItemsCount: number;
    schemaRefs: string[];
    provenanceStatus: CostDataProvenanceStatus;
  };
}

export interface KnowledgeCostItemRecord {
  id: string;
  name: string;
  category: string;
  trade: string | null;
  unitOfMeasure: string | null;
  description: string;
  keywords: string[];
  metadata: {
    source: "knowledge-engine";
    laborCost: number;
    materialCost: number;
    equipmentCost: number;
    totalUnitCost: number;
    schemaRefs: string[];
    provenanceStatus: CostDataProvenanceStatus;
  };
}

export type KnowledgeSearchType = "assembly" | "costItem" | "all";

export interface KnowledgeSearchInput {
  query: string;
  type?: KnowledgeSearchType;
  trade?: string;
  limit?: number;
}

export interface KnowledgeSearchResult {
  id: string;
  type: "assembly" | "costItem";
  name: string;
  category: string;
  trade: string | null;
  unitOfMeasure: string | null;
  description: string;
  confidence: number;
  matchedKeywords: string[];
  rationale: string;
  metadata: Record<string, unknown>;
  // Trust state of this record's pricing, per the Costbook provenance
  // vocabulary (see app/modules/costbook/provenance.ts). Additive field:
  // "documented" never implies current/local/nationally-authoritative
  // pricing on its own — it only means the item traces to the documented
  // Knowledge Engine generation/review pipeline. Consumers must not treat
  // "unverified-legacy" or "placeholder" pricing as verified.
  provenanceStatus: CostDataProvenanceStatus;
}

export interface ScopeMatchResult {
  detectedTrade: string | null;
  confidenceScore: number;
  assumptions: string[];
  rationale: string[];
  missingInformation: string[];
  reviewWarnings: string[];
  matchedAssemblies: KnowledgeSearchResult[];
  matchedCostItems: KnowledgeSearchResult[];
  missingInputs: string[];
  humanReviewWarnings: string[];
}

export interface DeterministicMatchInput {
  scopeText: string;
  limit?: number;
}

export interface KnowledgeRepositorySnapshot {
  paths: KnowledgeEnginePaths;
  stats: KnowledgeStats;
  trades: KnowledgeTrade[];
  assemblies: KnowledgeAssemblyRecord[];
  costItems: KnowledgeCostItemRecord[];
  taxonomyKeywords: string[];
}
