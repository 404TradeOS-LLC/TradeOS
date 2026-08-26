import { matchScopeDeterministically } from "./matcher";
import { getKnowledgeRepositorySnapshot, searchKnowledge } from "./repository";
import { KnowledgeSearchInput, KnowledgeSearchResult, KnowledgeStats, KnowledgeTrade, ScopeMatchResult } from "./types";

export class KnowledgeRuntimeService {
  getStats(): KnowledgeStats {
    return getKnowledgeRepositorySnapshot().stats;
  }

  listTrades(): KnowledgeTrade[] {
    return getKnowledgeRepositorySnapshot().trades;
  }

  search(input: KnowledgeSearchInput): KnowledgeSearchResult[] {
    return searchKnowledge(input);
  }

  searchAssemblies(query: string, limit = 10, trade?: string): KnowledgeSearchResult[] {
    return searchKnowledge({ query, type: "assembly", limit, trade });
  }

  searchCostItems(query: string, limit = 10, trade?: string): KnowledgeSearchResult[] {
    return searchKnowledge({ query, type: "costItem", limit, trade });
  }

  matchScope(scopeText: string, limit = 5): ScopeMatchResult {
    return matchScopeDeterministically({ scopeText, limit });
  }
}
