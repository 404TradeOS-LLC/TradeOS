import { createHash } from "node:crypto";
import { KnowledgeRuntimeService } from "../../knowledge-runtime/service";
import { KnowledgeStats, KnowledgeTrade } from "../../knowledge-runtime/types";
import { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

// First-party knowledgeEngine context provider (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "A3 Scope"). Wraps the existing
// KnowledgeRuntimeService rather than reading Knowledge Runtime files
// directly - Athena never bypasses an application service for data it
// already has a service for. Non-tenant reference data (costbook/assembly/
// trade knowledge), so sensitivity stays "public" and no RLS/actor-scoping
// is involved.
//
// A3 has no real query/intent signal yet (that's A5's job), so this
// provider returns cheap, always-useful summary metadata - stats and the
// trade list - rather than a query-driven search. A query-driven
// knowledgeEngine.search() activation is future A5+ work once a planner can
// supply a real query.
export interface AthenaKnowledgeEngineContextData {
  stats: KnowledgeStats;
  trades: KnowledgeTrade[];
}

const knowledgeRuntimeService = new KnowledgeRuntimeService();

// knowledge-runtime/loader.ts has no content hash or version today (LOW-1,
// docs/athena/reviews/A1-parallel-readiness-review.md). Computing a hash of
// the loaded stats/trades snapshot here gives a real, honest sourceHash
// instead of fabricating a plausible-looking version string - it changes
// whenever the underlying Knowledge Engine content changes, even though it
// isn't a hash of the raw source files themselves.
function computeSourceHash(stats: KnowledgeStats, trades: KnowledgeTrade[]): string {
  return createHash("sha256").update(JSON.stringify({ stats, trades })).digest("hex").slice(0, 16);
}

export function createKnowledgeEngineProvider(overrides: Partial<AthenaContextProviderDefinition<AthenaKnowledgeEngineContextData>> = {}): AthenaContextProviderDefinition<AthenaKnowledgeEngineContextData> {
  return {
    id: "tradeos.athena.context.knowledge-engine",
    version: "1.0.0",
    owner: "athena-context-engine",
    name: "Knowledge Engine Context",
    priority: 60,
    section: "knowledgeEngine",
    description: "Read-only Knowledge Runtime stats and trade catalog. Non-tenant reference data.",
    permissions: [],
    activation: "lazy_intent",
    allowedIntents: ["knowledge_lookup"],
    freshnessTtlMs: 5 * 60_000,
    timeoutMs: 2_000,
    maxItems: 200,
    maxBytes: 32_768,
    sensitivity: "public",
    cacheKeyPolicy: "tenant_actor_permission_input",
    criticality: "optional",
    failureBehavior: "degrade",
    async provide(): Promise<AthenaContextProviderFetchResult<AthenaKnowledgeEngineContextData>> {
      const stats = knowledgeRuntimeService.getStats();
      const trades = knowledgeRuntimeService.listTrades();
      return {
        data: { stats, trades },
        itemCount: trades.length,
        omittedFields: [],
        sourceHash: computeSourceHash(stats, trades),
      };
    },
    ...overrides,
  };
}
