import { assembleAthenaContext } from "../modules/athena-context-engine/assembler";
import { ATHENA_CONTEXT_BUDGET, ATHENA_PROVIDER_AGGREGATE_BUDGET } from "../modules/athena-context-engine/budget";
import { createTestContextProvider } from "../modules/athena-context-engine/fixtures/testContextProvider";
import { createAthenaContextRegistry } from "../modules/athena-context-engine/registry";
import type { AthenaContextAssemblyRequest } from "../modules/athena-context-engine/types";
import { buildMinimalAthenaContext } from "../modules/athena-kernel/context";

function request(channel: "text" | "mobile" | "voice" = "text"): AthenaContextAssemblyRequest {
  return {
    orgId: "org-1",
    actor: { userId: "user-1", role: "owner" },
    permissions: ["crm.read"],
    selectedScope: {},
    interaction: { channel },
    featureFlags: [],
    requestedIntents: ["dispatch_overview"],
    explicitSections: channel === "mobile" || channel === "voice" ? ["mobile"] : [],
  };
}

describe("A14 field context safety", () => {
  test.each(["mobile", "voice"] as const)("%s suppresses confidential non-mobile providers while retaining field-safe context", async (channel) => {
    const registry = createAthenaContextRegistry();
    let customerFetches = 0;
    let dispatchFetches = 0;

    registry.register(createTestContextProvider({
      id: "tradeos.athena.context.fixture.customer",
      section: "customers",
      priority: 90,
      activation: "lazy_intent",
      allowedIntents: ["dispatch_overview"],
      sensitivity: "confidential",
      onFetch: () => { customerFetches += 1; },
      data: { customers: [{ name: "Private Customer", email: "private@example.com", phone: "555-0100" }] },
    }));
    registry.register(createTestContextProvider({
      id: "tradeos.athena.context.fixture.dispatch",
      section: "dispatch",
      priority: 80,
      activation: "lazy_intent",
      allowedIntents: ["dispatch_overview"],
      sensitivity: "internal",
      onFetch: () => { dispatchFetches += 1; },
      data: { jobs: [{ id: "job-1", status: "scheduled" }] },
    }));
    registry.register(createTestContextProvider({
      id: "tradeos.athena.context.fixture.mobile",
      section: "mobile",
      priority: 100,
      activation: "explicit_only",
      sensitivity: "internal",
      data: { jobId: "job-1", city: "Terre Haute", state: "IN" },
    }));

    const result = await assembleAthenaContext(registry, request(channel));

    expect(customerFetches).toBe(0);
    expect(result.sections.customers).toBeUndefined();
    expect(result.audit.find((entry) => entry.providerId.endsWith("customer"))?.reasonCode).toBe("not_activated");
    expect(dispatchFetches).toBe(1);
    expect(result.sections.dispatch?.status).toBe("available");
    expect(result.sections.mobile?.status).toBe("available");
  });

  test("text requests retain ordinary confidential provider behavior when authorized", async () => {
    const registry = createAthenaContextRegistry();
    registry.register(createTestContextProvider({
      id: "tradeos.athena.context.fixture.customer",
      section: "customers",
      activation: "lazy_intent",
      allowedIntents: ["dispatch_overview"],
      sensitivity: "confidential",
      data: { customers: [{ name: "Customer", email: "customer@example.com" }] },
    }));

    const result = await assembleAthenaContext(registry, request("text"));
    expect(result.sections.customers?.status).toBe("available");
  });

  test("aggregate provider payloads are omitted before exceeding the live context envelope", async () => {
    const registry = createAthenaContextRegistry();
    const sections = ["knowledgeEngine", "dispatch", "weather", "calendar"] as const;

    sections.forEach((section, index) => {
      registry.register(createTestContextProvider({
        id: `tradeos.athena.context.fixture.budget-${index}`,
        section,
        priority: 100 - index,
        maxBytes: 40_000,
        data: { payload: "x".repeat(30_000) },
      }));
    });

    const result = await assembleAthenaContext(registry, request("text"));
    const providerSections = sections.map((section) => result.sections[section]).filter(Boolean);
    const available = providerSections.filter((section) => section?.status === "available");
    const omitted = providerSections.filter((section) => section?.status === "omitted");

    expect(available.length).toBeLessThanOrEqual(ATHENA_PROVIDER_AGGREGATE_BUDGET.maxProviderCount);
    expect(omitted.some((section) => section?.truncationReason === "aggregate_context_budget_exceeded")).toBe(true);
    expect(available.reduce((sum, section) => sum + (section?.estimatedTokens ?? 0), 0)).toBeLessThanOrEqual(ATHENA_PROVIDER_AGGREGATE_BUDGET.maxEstimatedTokens);
  });

  test("C001 advertises the bounded live provider envelope rather than the old zero-provider A1 budget", () => {
    const context = buildMinimalAthenaContext({
      requestId: "req-1",
      traceId: "trace-1",
      executionId: "exec-1",
      actor: { userId: "user-1", orgId: "org-1", role: "owner", permissions: [] },
      request: { message: "show dispatch", requestSource: "test" },
      receivedAt: new Date("2026-09-11T12:00:00.000Z"),
    });

    expect(context.budget).toEqual(ATHENA_CONTEXT_BUDGET);
    expect(context.budget.maxProviderCount).toBeGreaterThan(0);
    expect(ATHENA_PROVIDER_AGGREGATE_BUDGET.maxBytes).toBeLessThan(context.budget.maxBytes);
    expect(ATHENA_PROVIDER_AGGREGATE_BUDGET.maxEstimatedTokens).toBeLessThan(context.budget.maxEstimatedTokens);
  });
});
