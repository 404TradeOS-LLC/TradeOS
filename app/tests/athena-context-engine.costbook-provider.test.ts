import { assertValidProviderDefinition } from "../modules/athena-context-engine/registry";
import { assertValidContextProviderFetchResult } from "../modules/athena-context-engine/resultValidation";
import { createCostbookProvider } from "../modules/athena-context-engine/providers/costbookProvider";
import type { CostbookService } from "../modules/costbook/service";

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

describe("costbook context provider", () => {
  it("is a valid provider definition", () => {
    const provider = createCostbookProvider();
    expect(() => assertValidProviderDefinition(provider)).not.toThrow();
    expect(provider.section).toBe("costbook");
  });

  it("returns workspace state and a narrowed material sample", async () => {
    const costbookService: Pick<CostbookService, "getWorkspace" | "listMaterials"> = {
      async getWorkspace(auth) {
        expect(auth.orgId).toBe("org-1");
        return {
          organizationId: auth.orgId,
          initialized: true,
          status: "active",
          permissions: { canRead: true, canWrite: true, canManage: false },
          counts: { categories: 2, costItems: 10, laborRates: 3, materials: 7, equipment: 4, assemblies: 1 },
          areas: [],
        };
      },
      async listMaterials() {
        return [
          {
            id: "material-1",
            organizationId: "org-1",
            sku: null,
            name: "Copper Pipe",
            unitOfMeasure: "ft",
            unitCost: 8.25,
            wasteFactorPct: 0,
            supplierId: null,
            supplierName: "Sensitive",
            lastPriceUpdate: null,
            createdAt: "2026-08-14T00:00:00.000Z",
            updatedAt: "2026-08-14T00:00:00.000Z",
          },
        ] as never;
      },
    };
    const provider = createCostbookProvider({}, costbookService);

    const result = await provider.provide(baseInput());

    expect(() => assertValidContextProviderFetchResult(result)).not.toThrow();
    expect(result.data.workspace.status).toBe("active");
    expect(result.data.materials[0]).toMatchObject({ materialId: "material-1", name: "Copper Pipe" });
    expect(result.omittedFields).toContain("materials.supplierName");
  });
});
