import { createAthenaMemoryService } from "../../athena-memory/service";
import type { AthenaMemoryService } from "../../athena-memory/service";
import type { AthenaMemoryRecord } from "../../athena-memory/types";
import { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

// A7 memory context provider (docs/athena/roadmap/
// A7-memory-implementation-plan.md Step 8; docs/athena/07-context-engine/
// README.md's "memory-backed preferences are lazy and intent-gated by
// default"). Reuses AthenaMemoryService.list() rather than querying
// persistence directly - Athena never bypasses the Memory Service boundary
// for data it already has a service for (same posture as
// dispatchProvider.ts wrapping JobsService instead of querying jobs).
//
// Deliberately scoped to the actor's own "user"-scope memory only, never
// organization/project/job memory - the safest, smallest default for A7's
// infrastructure-only mandate. A future capability that needs
// organization-wide memory in context is a distinct, explicit decision, not
// something this provider should widen to silently.
export interface AthenaMemoryContextEntry {
  kind: string;
  value: unknown;
  confidence: number;
  updatedAt: string;
}

export interface AthenaMemoryContextData {
  preferences: AthenaMemoryContextEntry[];
}

const MEMORY_CONTEXT_PAGE_SIZE = 25;

function toContextEntry(record: AthenaMemoryRecord): AthenaMemoryContextEntry {
  return { kind: record.kind, value: record.value, confidence: record.confidence, updatedAt: record.updatedAt };
}

export function createMemoryContextProvider(
  overrides: Partial<AthenaContextProviderDefinition<AthenaMemoryContextData>> = {},
  memoryService: Pick<AthenaMemoryService, "list"> = createAthenaMemoryService()
): AthenaContextProviderDefinition<AthenaMemoryContextData> {
  return {
    id: "tradeos.athena.context.memory",
    version: "1.0.0",
    owner: "athena-context-engine",
    name: "Memory Context",
    priority: 80,
    section: "memory",
    description: "Actor-scoped durable preference memory. AthenaMemoryService already excludes another user's, another org's, deleted, and expired records.",
    // No domain-permission requirement: every authenticated actor may read
    // their own preference memory (08-memory/README.md "User preference
    // memory: user-owned and deletable"); AthenaMemoryService.list() itself
    // is the actual authorization boundary, same posture as
    // dispatchProvider.ts's permissions: [].
    permissions: [],
    activation: "lazy_intent",
    allowedIntents: ["memory_preferences"],
    freshnessTtlMs: 0,
    timeoutMs: 3_000,
    maxItems: MEMORY_CONTEXT_PAGE_SIZE,
    maxBytes: 16_384,
    // High-PII per 07-context-engine/README.md - never "public"/"internal".
    sensitivity: "confidential",
    cacheKeyPolicy: "tenant_actor_permission_input",
    criticality: "optional",
    failureBehavior: "degrade",
    async provide(input): Promise<AthenaContextProviderFetchResult<AthenaMemoryContextData>> {
      const records = await memoryService.list({
        orgId: input.orgId,
        actor: { orgId: input.orgId, userId: input.actor.userId, role: input.actor.role },
        scope: "user",
        subjectId: input.actor.userId,
        limit: MEMORY_CONTEXT_PAGE_SIZE,
      });
      return {
        data: { preferences: records.map(toContextEntry) },
        itemCount: records.length,
        // Minimize what reaches the model/prompt beyond the preference
        // itself (08-memory/README.md "Privacy And Data Minimization").
        omittedFields: ["id", "source", "metadata", "supersedes"],
      };
    },
    ...overrides,
  };
}
