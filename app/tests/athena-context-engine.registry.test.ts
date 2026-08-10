import { createAthenaContextRegistry } from "../modules/athena-context-engine/registry";
import { createTestContextProvider } from "../modules/athena-context-engine/fixtures/testContextProvider";
import type { AthenaContextProviderDefinition } from "../modules/athena-context-engine/types";

function fixtureWith(overrides: Partial<AthenaContextProviderDefinition<unknown>>): AthenaContextProviderDefinition<unknown> {
  return { ...createTestContextProvider(), ...overrides };
}

describe("athena context provider registry", () => {
  describe("registration", () => {
    it("registers a provider and resolves it by id and version", () => {
      const registry = createAthenaContextRegistry();
      const provider = createTestContextProvider();
      registry.register(provider);
      expect(registry.resolve(provider.id, provider.version)).toBe(provider);
    });

    it("rejects duplicate registration of the same id@version", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider());
      expect(() => registry.register(createTestContextProvider())).toThrow(/already registered/);
    });

    it("rejects a second active provider for a section already owned by another provider", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.one", section: "knowledgeEngine" }));
      expect(() => registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.two", section: "knowledgeEngine" }))).toThrow(/already owned by/);
    });

    it("allows two distinct versions of the same provider id to coexist", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ version: "1.0.0" }));
      registry.register(createTestContextProvider({ version: "2.0.0" }));
      expect(registry.resolve("tradeos.athena.context.fixture.test", "1.0.0")).toBeDefined();
      expect(registry.resolve("tradeos.athena.context.fixture.test", "2.0.0")).toBeDefined();
    });

    it("rejects registration with an unrecognized section name", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ section: "not-a-real-section" as never }))).toThrow(/section/);
    });

    it("rejects registration with an invalid activation mode", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ activation: "always" as never }))).toThrow(/activation/);
    });

    it("rejects registration with an invalid sensitivity value", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ sensitivity: "top-secret" as never }))).toThrow(/sensitivity/);
    });

    it("rejects registration with an invalid cacheKeyPolicy", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ cacheKeyPolicy: "everything" as never }))).toThrow(/cacheKeyPolicy/);
    });

    it("rejects registration with an invalid criticality", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ criticality: "urgent" as never }))).toThrow(/criticality/);
    });

    it("rejects registration with an invalid failureBehavior", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ failureBehavior: "retry" as never }))).toThrow(/failureBehavior/);
    });

    it.each(["Tradeos.Athena.Context.Fixture", "tradeos context fixture", "", "tradeoscontextfixture"])("rejects an invalid provider id: %j", (id) => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ id }))).toThrow(/id/);
    });

    it.each(["latest", "v1", "1", "1.0", ""])("rejects a non-semver version: %j", (version) => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ version }))).toThrow(/version/);
    });

    it("rejects registration with a non-positive timeoutMs", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ timeoutMs: 0 }))).toThrow(/timeoutMs/);
    });

    it("rejects registration with a non-positive maxItems", () => {
      const registry = createAthenaContextRegistry();
      expect(() => registry.register(fixtureWith({ maxItems: 0 }))).toThrow(/maxItems/);
    });
  });

  describe("resolve and list", () => {
    it("resolve() returns undefined for an unregistered id@version", () => {
      const registry = createAthenaContextRegistry();
      expect(registry.resolve("tradeos.athena.context.nope", "1.0.0")).toBeUndefined();
    });

    it("list() returns every registered provider regardless of permission", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.needs-billing", permissions: ["billing.write"] }));
      expect(registry.list().map((p) => p.id)).toContain("tradeos.athena.context.fixture.needs-billing");
    });
  });

  describe("discovery", () => {
    it("excludes a provider the actor's role lacks the required permission for", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.needs-billing", permissions: ["billing.write"] }));
      const discovered = registry.discover({ role: "technician", featureFlags: [] });
      expect(discovered.map((p) => p.id)).not.toContain("tradeos.athena.context.fixture.needs-billing");
    });

    it("includes a provider the actor's role satisfies", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.needs-billing", permissions: ["billing.write"] }));
      const discovered = registry.discover({ role: "owner", featureFlags: [] });
      expect(discovered.map((p) => p.id)).toContain("tradeos.athena.context.fixture.needs-billing");
    });

    it("hides a provider with unmet requiredFeatureFlags", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.flagged", requiredFeatureFlags: ["athena_context_flag"] }));
      const discovered = registry.discover({ role: "owner", featureFlags: [] });
      expect(discovered.map((p) => p.id)).not.toContain("tradeos.athena.context.fixture.flagged");
    });

    it("includes a flagged provider once the actor's context carries every required flag", () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.flagged", requiredFeatureFlags: ["athena_context_flag"] }));
      const discovered = registry.discover({ role: "owner", featureFlags: ["athena_context_flag"] });
      expect(discovered.map((p) => p.id)).toContain("tradeos.athena.context.fixture.flagged");
    });
  });
});
