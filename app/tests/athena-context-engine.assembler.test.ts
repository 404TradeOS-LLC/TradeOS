import type { AthenaProviderSection } from "../modules/athena-kernel/types";
import { assembleAthenaContext } from "../modules/athena-context-engine/assembler";
import { AthenaContextCache } from "../modules/athena-context-engine/cache";
import { createTestContextProvider } from "../modules/athena-context-engine/fixtures/testContextProvider";
import { AthenaContextRegistry, createAthenaContextRegistry } from "../modules/athena-context-engine/registry";
import type { AthenaContextAssemblyRequest } from "../modules/athena-context-engine/types";

function buildRequest(overrides: Partial<AthenaContextAssemblyRequest> = {}): AthenaContextAssemblyRequest {
  return {
    orgId: "org-1",
    actor: { userId: "user-1", role: "owner" },
    permissions: [],
    selectedScope: {},
    featureFlags: [],
    requestedIntents: [],
    explicitSections: [],
    ...overrides,
  };
}

describe("athena context assembler", () => {
  describe("activation modes", () => {
    it("always activates an eager_minimal provider", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ activation: "eager_minimal" }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.status).toBe("available");
    });

    it("does not activate a lazy_intent provider without a matching requested intent", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ activation: "lazy_intent", allowedIntents: ["dispatch_overview"] }));
      const outcome = await assembleAthenaContext(registry, buildRequest({ requestedIntents: [] }));
      expect(outcome.sections.knowledgeEngine).toBeUndefined();
      expect(outcome.audit[0].reasonCode).toBe("not_activated");
    });

    it("activates a lazy_intent provider once its intent is requested", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ activation: "lazy_intent", allowedIntents: ["dispatch_overview"] }));
      const outcome = await assembleAthenaContext(registry, buildRequest({ requestedIntents: ["dispatch_overview"] }));
      expect(outcome.sections.knowledgeEngine?.status).toBe("available");
    });

    it("never activates an explicit_only provider without an explicit section request", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ activation: "explicit_only" }));
      const outcome = await assembleAthenaContext(registry, buildRequest({ requestedIntents: ["anything"] }));
      expect(outcome.sections.knowledgeEngine).toBeUndefined();
      expect(outcome.audit[0].reasonCode).toBe("not_activated");
    });

    it("activates an explicit_only provider once its section is explicitly requested", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ activation: "explicit_only", section: "customers" }));
      const outcome = await assembleAthenaContext(registry, buildRequest({ explicitSections: ["customers"] }));
      expect(outcome.sections.customers?.status).toBe("available");
    });
  });

  describe("permission gating", () => {
    it("marks a section denied (not merely absent) when the actor lacks the required permission, without calling fetch()", async () => {
      const registry = createAthenaContextRegistry();
      let fetched = false;
      registry.register(createTestContextProvider({ permissions: ["billing.write"], onFetch: () => { fetched = true; } }));
      const outcome = await assembleAthenaContext(registry, buildRequest({ actor: { userId: "user-1", role: "technician" } }));
      expect(outcome.sections.knowledgeEngine?.status).toBe("denied");
      expect(fetched).toBe(false);
      expect(outcome.warnings.some((w) => w.code === "athena_context_provider_denied")).toBe(true);
    });

    it("marks a section denied when the actor lacks a required feature flag", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ requiredFeatureFlags: ["athena_context_flag"] }));
      const outcome = await assembleAthenaContext(registry, buildRequest({ featureFlags: [] }));
      expect(outcome.sections.knowledgeEngine?.status).toBe("denied");
    });
  });

  describe("budget enforcement", () => {
    it("omits a section whose self-reported itemCount exceeds maxItems", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ maxItems: 5, itemCount: 6, failureBehavior: "omit" }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.status).toBe("omitted");
      expect(outcome.audit[0].reasonCode).toBe("omitted");
    });

    it("omits a section whose serialized data exceeds maxBytes, with a truncationReason", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ maxBytes: 10, data: { big: "x".repeat(1000) } }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.status).toBe("omitted");
      expect(outcome.sections.knowledgeEngine?.truncationReason).toBe("max_bytes_exceeded");
    });

    it("does not fabricate data for an omitted section", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ maxItems: 1, itemCount: 2, data: { secret: "should never appear" } }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.data).toBeNull();
    });
  });

  describe("timeout and failure behavior", () => {
    it("forces a degraded section when a non-cooperative provider never resolves and failureBehavior is degrade", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ timeoutMs: 20, failureBehavior: "degrade", fetchImpl: () => new Promise(() => {}) }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.status).toBe("degraded");
      expect(outcome.warnings.some((w) => w.code === "athena_context_provider_timeout")).toBe(true);
    }, 10_000);

    it("forces an omitted section when a non-cooperative provider never resolves and failureBehavior is omit", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ timeoutMs: 20, failureBehavior: "omit", fetchImpl: () => new Promise(() => {}) }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.status).toBe("omitted");
    }, 10_000);

    it("stops the whole assembly when a stop-behavior provider fails, and skips providers registered after it", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.critical", section: "customers", failureBehavior: "stop", fetchImpl: () => { throw new Error("boom"); } }));
      registry.register(createTestContextProvider({ id: "tradeos.athena.context.fixture.after", section: "costbook" }));

      const outcome = await assembleAthenaContext(registry, buildRequest());

      expect(outcome.stoppedByCriticalFailure).toBe(true);
      expect(outcome.sections.customers).toBeUndefined();
      expect(outcome.sections.costbook).toBeUndefined();
      expect(outcome.audit.find((a) => a.providerId === "tradeos.athena.context.fixture.after")?.reasonCode).toBe("stopped_by_critical_failure");
      expect(outcome.warnings.some((w) => w.code === "athena_context_critical_provider_failed")).toBe(true);
    });

    it("treats criticality as authoritative even if a provider was constructed with a non-stop failure behavior outside registration", async () => {
      const provider = createTestContextProvider({ criticality: "critical", failureBehavior: "degrade", fetchImpl: () => { throw new Error("boom"); } });
      const registry: AthenaContextRegistry = {
        register() {
          throw new Error("registration bypassed intentionally for defensive assembler coverage");
        },
        resolve() {
          return undefined;
        },
        discover() {
          return [];
        },
        list() {
          return [provider];
        },
      };

      const outcome = await assembleAthenaContext(registry, buildRequest());

      expect(outcome.stoppedByCriticalFailure).toBe(true);
      expect(outcome.sections.knowledgeEngine).toBeUndefined();
      expect(outcome.audit[0].reasonCode).toBe("stopped_by_critical_failure");
    });

    it("maps client cancellation to the cancellation warning instead of unexpected-error", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ timeoutMs: 1_000, failureBehavior: "degrade", fetchImpl: () => new Promise(() => {}) }));
      const controller = new AbortController();
      const promise = assembleAthenaContext(registry, buildRequest({ clientSignal: controller.signal }));

      controller.abort();
      const outcome = await promise;

      expect(outcome.sections.knowledgeEngine?.truncationReason).toBe("provider_cancelled");
      expect(outcome.warnings.some((w) => w.code === "athena_context_provider_cancelled")).toBe(true);
      expect(outcome.warnings.some((w) => w.code === "athena_context_provider_unexpected_error")).toBe(false);
    });

    it("never fabricates data or widens scope when a provider fails - the section is always null, never a substitute value", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ failureBehavior: "degrade", fetchImpl: () => { throw new Error("boom"); } }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.data).toBeNull();
    });

    it("maps an unexpected thrown error to a degraded/omitted section rather than propagating the raw error", async () => {
      const registry = createAthenaContextRegistry();
      registry.register(createTestContextProvider({ failureBehavior: "degrade", fetchImpl: () => { throw new Error("raw internal detail"); } }));
      const outcome = await assembleAthenaContext(registry, buildRequest());
      expect(outcome.sections.knowledgeEngine?.status).toBe("degraded");
    });
  });

  describe("caching", () => {
    it("serves a cache hit without calling fetch() again, and marks cacheHit true", async () => {
      const registry = createAthenaContextRegistry();
      let fetchCount = 0;
      registry.register(createTestContextProvider({ cacheKeyPolicy: "tenant_actor_permission_input", onFetch: () => { fetchCount += 1; } }));
      const cache = new AthenaContextCache<AthenaProviderSection>();

      const first = await assembleAthenaContext(registry, buildRequest(), cache);
      const second = await assembleAthenaContext(registry, buildRequest(), cache);

      expect(fetchCount).toBe(1);
      expect(first.sections.knowledgeEngine?.freshness.cacheHit).toBe(false);
      expect(second.sections.knowledgeEngine?.freshness.cacheHit).toBe(true);
      expect(second.sections.knowledgeEngine?.freshness.status).toBe("fresh");
    });

    it("does not reuse a cache entry across different organizations", async () => {
      const registry = createAthenaContextRegistry();
      let fetchCount = 0;
      registry.register(createTestContextProvider({ cacheKeyPolicy: "tenant_actor_permission_input", onFetch: () => { fetchCount += 1; } }));
      const cache = new AthenaContextCache<AthenaProviderSection>();

      await assembleAthenaContext(registry, buildRequest({ orgId: "org-a" }), cache);
      await assembleAthenaContext(registry, buildRequest({ orgId: "org-b" }), cache);

      expect(fetchCount).toBe(2);
    });

    it("does not reuse a cache entry across different actor roles or effective permission snapshots", async () => {
      const registry = createAthenaContextRegistry();
      let fetchCount = 0;
      registry.register(createTestContextProvider({ cacheKeyPolicy: "tenant_actor_permission_input", onFetch: () => { fetchCount += 1; } }));
      const cache = new AthenaContextCache<AthenaProviderSection>();

      await assembleAthenaContext(registry, buildRequest({ actor: { userId: "user-1", role: "owner" }, permissions: ["billing.write"] }), cache);
      await assembleAthenaContext(registry, buildRequest({ actor: { userId: "user-1", role: "technician" }, permissions: [] }), cache);
      await assembleAthenaContext(registry, buildRequest({ actor: { userId: "user-1", role: "owner" }, permissions: ["crm.read"] }), cache);

      expect(fetchCount).toBe(3);
    });
  });
});
