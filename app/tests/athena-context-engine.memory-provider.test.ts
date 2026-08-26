import { assertValidProviderDefinition, createAthenaContextRegistry } from "../modules/athena-context-engine/registry";
import { assertValidContextProviderFetchResult } from "../modules/athena-context-engine/resultValidation";
import { assembleAthenaContext } from "../modules/athena-context-engine/assembler";
import { createMemoryContextProvider } from "../modules/athena-context-engine/providers/memoryProvider";
import { createInMemoryAthenaMemoryRepository } from "../modules/athena-memory/fixtures/inMemoryRepository";
import { createAthenaMemoryService } from "../modules/athena-memory/service";
import type { AthenaMemoryService } from "../modules/athena-memory/service";

function baseInput(overrides: Partial<{ orgId: string; actor: { userId: string; role: "owner" | "admin" | "dispatcher" | "technician" } }> = {}) {
  return {
    orgId: "org-1",
    actor: { userId: "user-1", role: "owner" as const },
    selectedScope: {},
    deadline: new Date(Date.now() + 5_000),
    cancellationSignal: new AbortController().signal,
    ...overrides,
  };
}

async function seededMemoryService(orgId: string, userId: string): Promise<AthenaMemoryService> {
  const repository = createInMemoryAthenaMemoryRepository();
  const service = createAthenaMemoryService({ repository });
  await service.remember({
    orgId,
    actor: { orgId, userId, role: "owner" },
    scope: "user",
    subjectId: userId,
    kind: "preference.response_style",
    value: "concise",
    source: { kind: "user_message", trusted: true },
  });
  return service;
}

describe("memory context provider", () => {
  it("is a valid C010 provider definition, lazy-intent, confidential", () => {
    const provider = createMemoryContextProvider();
    expect(() => assertValidProviderDefinition(provider)).not.toThrow();
    expect(provider.section).toBe("memory");
    expect(provider.activation).toBe("lazy_intent");
    expect(provider.sensitivity).toBe("confidential");
    expect(provider.failureBehavior).toBe("degrade");
  });

  it("16. fetches only the requesting actor's own memory through AthenaMemoryService, never store internals", async () => {
    const memoryService = await seededMemoryService("org-1", "user-1");
    const provider = createMemoryContextProvider({}, memoryService);

    const result = await provider.provide(baseInput());

    expect(() => assertValidContextProviderFetchResult(result)).not.toThrow();
    expect(result.data.preferences).toEqual([expect.objectContaining({ kind: "preference.response_style", value: "concise" })]);
    expect(result.omittedFields).toEqual(expect.arrayContaining(["source", "metadata"]));
  });

  it("never surfaces a different user's memory even when both users share an org", async () => {
    const repository = createInMemoryAthenaMemoryRepository();
    const memoryService = createAthenaMemoryService({ repository });
    await memoryService.remember({ orgId: "org-1", actor: { orgId: "org-1", userId: "user-2", role: "owner" }, scope: "user", subjectId: "user-2", kind: "preference.response_style", value: "verbose", source: { kind: "user_message", trusted: true } });

    const provider = createMemoryContextProvider({}, memoryService);
    const result = await provider.provide(baseInput({ actor: { userId: "user-1", role: "owner" } }));

    expect(result.data.preferences).toEqual([]);
  });

  it("17. an irrelevant/non-requested intent does not activate the memory section during context assembly", async () => {
    const memoryService = await seededMemoryService("org-1", "user-1");
    const registry = createAthenaContextRegistry();
    registry.register(createMemoryContextProvider({}, memoryService));

    const result = await assembleAthenaContext(registry, {
      orgId: "org-1",
      actor: { userId: "user-1", role: "owner" },
      permissions: [],
      selectedScope: {},
      featureFlags: [],
      requestedIntents: ["dispatch_overview"], // does not include "memory_preferences"
      explicitSections: [],
    });

    expect(result.sections.memory).toBeUndefined();
    expect(result.audit).toEqual([expect.objectContaining({ section: "memory", reasonCode: "not_activated" })]);
  });

  it("activates and surfaces memory in the assembled context when the requested intent matches", async () => {
    const memoryService = await seededMemoryService("org-1", "user-1");
    const registry = createAthenaContextRegistry();
    registry.register(createMemoryContextProvider({}, memoryService));

    const result = await assembleAthenaContext(registry, {
      orgId: "org-1",
      actor: { userId: "user-1", role: "owner" },
      permissions: [],
      selectedScope: {},
      featureFlags: [],
      requestedIntents: ["memory_preferences"],
      explicitSections: [],
    });

    expect(result.sections.memory?.status).toBe("available");
    expect(result.sections.memory?.sensitivity).toBe("confidential");
    expect((result.sections.memory?.data as { preferences: unknown[] }).preferences).toHaveLength(1);
  });
});
