import { assertValidProviderDefinition } from "../modules/athena-context-engine/registry";
import { assertValidContextProviderFetchResult } from "../modules/athena-context-engine/resultValidation";
import { createKnowledgeEngineProvider } from "../modules/athena-context-engine/providers/knowledgeEngineProvider";

describe("knowledgeEngine context provider", () => {
  it("is a valid provider definition", () => {
    expect(() => assertValidProviderDefinition(createKnowledgeEngineProvider())).not.toThrow();
  });

  it("declares public sensitivity and no permission requirement", () => {
    const provider = createKnowledgeEngineProvider();
    expect(provider.sensitivity).toBe("public");
    expect(provider.permissions).toEqual([]);
    expect(provider.section).toBe("knowledgeEngine");
  });

  it("fetches stats and trades through KnowledgeRuntimeService, producing a valid fetch result", async () => {
    const provider = createKnowledgeEngineProvider();
    const result = await provider.fetch({
      orgId: "org-1",
      actor: { userId: "user-1", role: "owner" },
      selectedScope: {},
      deadline: new Date(Date.now() + 5_000),
      cancellationSignal: new AbortController().signal,
    });

    expect(() => assertValidContextProviderFetchResult(result)).not.toThrow();
    expect(result.data.stats.readOnly).toBe(true);
    expect(result.data.trades.length).toBeGreaterThan(0);
    expect(result.itemCount).toBe(result.data.trades.length);
  });

  it("includes a real, deterministic sourceHash rather than a fabricated version string", async () => {
    const provider = createKnowledgeEngineProvider();
    const request = { orgId: "org-1", actor: { userId: "user-1", role: "owner" as const }, selectedScope: {}, deadline: new Date(Date.now() + 5_000), cancellationSignal: new AbortController().signal };
    const first = await provider.fetch(request);
    const second = await provider.fetch(request);
    expect(first.sourceHash).toBeDefined();
    expect(first.sourceHash).toBe(second.sourceHash);
  });
});
