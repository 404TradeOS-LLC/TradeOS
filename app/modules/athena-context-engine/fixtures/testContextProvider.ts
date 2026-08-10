import { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

// Test-only, fully configurable context provider used to exercise the
// registry/assembler/redaction/cache machinery without depending on a real
// application service (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Test Requirements"). Never
// registered outside test setup.
export interface TestContextProviderOverrides extends Partial<AthenaContextProviderDefinition<unknown>> {
  data?: unknown;
  itemCount?: number;
  omittedFields?: string[];
  sourceVersion?: string;
  onFetch?: () => void;
  fetchImpl?: AthenaContextProviderDefinition<unknown>["fetch"];
}

export function createTestContextProvider(overrides: TestContextProviderOverrides = {}): AthenaContextProviderDefinition<unknown> {
  const { data, itemCount, omittedFields, sourceVersion, onFetch, fetchImpl, ...definitionOverrides } = overrides;

  return {
    id: "tradeos.athena.context.fixture.test",
    version: "1.0.0",
    owner: "athena-context-engine-fixtures",
    section: "knowledgeEngine",
    description: "Test-only fixture provider. Calls no application service.",
    permissions: [],
    activation: "eager_minimal",
    allowedIntents: [],
    freshnessTtlMs: 60_000,
    timeoutMs: 1_000,
    maxItems: 10,
    maxBytes: 8_192,
    sensitivity: "public",
    cacheKeyPolicy: "none",
    criticality: "optional",
    failureBehavior: "degrade",
    async fetch(input): Promise<AthenaContextProviderFetchResult<unknown>> {
      onFetch?.();
      if (fetchImpl) return fetchImpl(input);
      return {
        data: data ?? { echoed: true },
        itemCount: itemCount ?? 1,
        omittedFields: omittedFields ?? [],
        sourceVersion,
      };
    },
    ...definitionOverrides,
  };
}
