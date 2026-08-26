import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createCostbookLookupTool } from "../modules/athena-tools/costbook/lookup.tool";
import type { CostbookLookupToolDeps } from "../modules/athena-tools/costbook/lookup.tool";
import type { AssemblyDTO } from "../modules/assemblies-database/types";
import type { CostItemDTO } from "../modules/cost-database/types";

// A12 Costbook Intelligence contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).

function makeCostItem(overrides: Partial<CostItemDTO> = {}): CostItemDTO {
  return {
    id: "cost-item-1",
    orgId: "org-1",
    subcategoryId: "subcat-1",
    code: "01-100",
    name: "2x4 Framing Lumber",
    unitOfMeasure: "lf",
    productionRate: 100,
    laborRateId: "labor-1",
    materialId: "material-1",
    equipmentId: null,
    subcontractorId: null,
    isActive: true,
    ...overrides,
  };
}

function makeAssembly(overrides: Partial<AssemblyDTO> = {}): AssemblyDTO {
  return {
    id: "assembly-1",
    orgId: "org-1",
    code: "A-100",
    name: "Framed Wall Section",
    unitOfMeasure: "sf",
    description: null,
    isTemplate: false,
    isActive: true,
    ...overrides,
  };
}

function createFakeDeps(costItems: CostItemDTO[], assemblies: AssemblyDTO[]): CostbookLookupToolDeps {
  return {
    costDatabase: { search: jest.fn(async () => costItems) },
    assembliesDatabase: { search: jest.fn(async () => assemblies) },
  };
}

describe("athena-tools costbook: lookup", () => {
  describeAthenaToolContract(createCostbookLookupTool(createFakeDeps([makeCostItem()], [makeAssembly()])), {
    validInput: { query: "framing" },
    invalidInputs: [{ query: "" }, {}, { query: 123 }],
  });

  it("returns both cost items and assemblies matching the query, scoped to execution.orgId", async () => {
    const deps = createFakeDeps([makeCostItem()], [makeAssembly()]);
    const tool = createCostbookLookupTool(deps);
    const result = await tool.execute(
      { query: "framing" },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ costItems: [makeCostItem()], assemblies: [makeAssembly()] });
    expect(result.warnings).toEqual([]);
    expect(deps.costDatabase.search).toHaveBeenCalledWith("framing", "org-1");
    expect(deps.assembliesDatabase.search).toHaveBeenCalledWith("framing", "org-1");
  });

  it("succeeds with a warning (not a failure) when nothing matches either search", async () => {
    const deps = createFakeDeps([], []);
    const tool = createCostbookLookupTool(deps);
    const result = await tool.execute(
      { query: "nonexistent-item" },
      {} as never,
      { executionId: "exec-2", requestId: "req-2", traceId: "trace-2", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ costItems: [], assemblies: [] });
    expect(result.warnings).toEqual([{ code: "athena_costbook_lookup_no_matches", message: 'No cost items or assemblies matched "nonexistent-item".' }]);
  });
});
