export interface ParsedScope {
  rawText: string;
  trade: string;
  scopeType: string;
  action: string;
  quantities: {
    treeCount: number | null;
    treeDiameterInches: number | null;
    stumpGrindingDiameterInches: number | null;
  };
  confidence: number;
}

export interface KnowledgeMatch {
  id: string;
  name: string;
  category: string;
  unitOfMeasure: string | null;
  matchType: "assembly" | "costItem";
  relevance: number;
  rationale: string;
}

export interface DraftLineItem {
  name: string;
  sourceId: string;
  sourceType: "assembly" | "costItem";
  quantity: number;
  unitOfMeasure: string | null;
  confidence: number;
  rationale: string;
  reviewFlags: string[];
}

export interface TraininglessEstimateDraft {
  parsedScope: ParsedScope;
  knowledgeMatches: KnowledgeMatch[];
  lineItems: DraftLineItem[];
  assumptions: string[];
  exclusions: string[];
  safetyNotes: string[];
  missingInformation: string[];
  nextHumanAction: string;
}
