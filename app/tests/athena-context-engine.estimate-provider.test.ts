import { assertValidProviderDefinition } from "../modules/athena-context-engine/registry";
import { assertValidContextProviderFetchResult } from "../modules/athena-context-engine/resultValidation";
import { createEstimateProvider } from "../modules/athena-context-engine/providers/estimateProvider";
import type { EstimateEngineService } from "../modules/estimate-engine/service";

function baseInput(overrides: Partial<{ orgId: string; actor: { userId: string; role: "owner" | "admin" | "dispatcher" | "technician" }; selectedScope: Record<string, string> }> = {}) {
  return {
    orgId: "org-1",
    actor: { userId: "user-1", role: "owner" as const },
    selectedScope: {},
    deadline: new Date(Date.now() + 5_000),
    cancellationSignal: new AbortController().signal,
    ...overrides,
  };
}

describe("estimate context provider", () => {
  it("is a valid provider definition", () => {
    const provider = createEstimateProvider();
    expect(() => assertValidProviderDefinition(provider)).not.toThrow();
    expect(provider.section).toBe("estimates");
  });

  it("uses an exact estimate lookup when selectedScope.estimateId is present", async () => {
    let listCalled = false;
    const estimateService: Pick<EstimateEngineService, "getById" | "listByProject"> = {
      async getById(id, orgId) {
        expect(id).toBe("estimate-1");
        expect(orgId).toBe("org-1");
        return {
          id,
          orgId,
          projectId: "project-1",
          version: 2,
          status: "draft",
          overheadPct: 0,
          profitPct: 0,
          targetMarginPct: null,
          subtotalCost: 1200,
          totalPrice: 1800,
          lineItems: [{ id: "line-1" }],
        } as never;
      },
      async listByProject() {
        listCalled = true;
        return [];
      },
    };
    const provider = createEstimateProvider({}, estimateService);

    const result = await provider.provide(baseInput({ selectedScope: { estimateId: "estimate-1" } }));

    expect(() => assertValidContextProviderFetchResult(result)).not.toThrow();
    expect(listCalled).toBe(false);
    expect(result.data.estimates[0]).toMatchObject({ estimateId: "estimate-1", lineItemCount: 1 });
  });

  it("uses the project-scoped list when selectedScope.projectId is present", async () => {
    const estimateService: Pick<EstimateEngineService, "getById" | "listByProject"> = {
      async getById() {
        throw new Error("unexpected getById");
      },
      async listByProject(projectId, orgId) {
        expect(projectId).toBe("project-1");
        expect(orgId).toBe("org-1");
        return [
          { id: "estimate-1", orgId, projectId, version: 1, status: "draft", overheadPct: 0, profitPct: 0, targetMarginPct: null, subtotalCost: 1000, totalPrice: 1500 },
        ] as never;
      },
    };
    const provider = createEstimateProvider({}, estimateService);

    const result = await provider.provide(baseInput({ selectedScope: { projectId: "project-1" } }));

    expect(result.data.total).toBe(1);
    expect(result.data.estimates[0].estimateId).toBe("estimate-1");
  });
});
