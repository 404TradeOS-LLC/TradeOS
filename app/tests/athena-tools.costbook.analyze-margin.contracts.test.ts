import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createCostbookAnalyzeMarginTool } from "../modules/athena-tools/costbook/analyzeMargin.tool";
import type { CostbookAnalyzeMarginToolDeps } from "../modules/athena-tools/costbook/analyzeMargin.tool";
import type { UnitCostBreakdown } from "../modules/cost-database/types";

// A12 Costbook Intelligence contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).

const VALID_COST_ITEM_ID = "44444444-4444-4444-8444-444444444444";
const VALID_REGION_ID = "55555555-5555-4555-8555-555555555555";

function makeBreakdown(overrides: Partial<UnitCostBreakdown> = {}): UnitCostBreakdown {
  return {
    laborCostPerUnit: 40,
    materialCostPerUnit: 30,
    equipmentCostPerUnit: 10,
    totalUnitCost: 80,
    ...overrides,
  };
}

function createFakeDeps(breakdown: UnitCostBreakdown): CostbookAnalyzeMarginToolDeps {
  return { costDatabase: { getUnitCost: jest.fn(async () => breakdown) } };
}

const EXECUTION = { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user" as const, id: "user-1" }, role: "owner" as const, deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] };

describe("athena-tools costbook: analyze-margin", () => {
  describeAthenaToolContract(createCostbookAnalyzeMarginTool(createFakeDeps(makeBreakdown())), {
    validInput: { costItemId: VALID_COST_ITEM_ID, quantity: 10, regionId: VALID_REGION_ID, sellPricePerUnit: 100 },
    invalidInputs: [{ costItemId: "not-a-uuid", sellPricePerUnit: 100 }, {}, { costItemId: VALID_COST_ITEM_ID, sellPricePerUnit: -5 }],
  });

  it("computes margin% from getUnitCost's breakdown via formulas.ts's marginFromMarkup, using execution.orgId", async () => {
    const deps = createFakeDeps(makeBreakdown({ totalUnitCost: 80 }));
    const tool = createCostbookAnalyzeMarginTool(deps);
    const result = await tool.execute({ costItemId: VALID_COST_ITEM_ID, quantity: 10, regionId: VALID_REGION_ID, sellPricePerUnit: 100 }, {} as never, EXECUTION);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ sellPricePerUnit: 100, marginPct: 20 });
    expect(result.warnings).toEqual([]);
    expect(deps.costDatabase.getUnitCost).toHaveBeenCalledWith(VALID_COST_ITEM_ID, 10, VALID_REGION_ID, "org-1");
  });

  it("warns when the computed margin is below the low-margin threshold, including a negative margin", async () => {
    const deps = createFakeDeps(makeBreakdown({ totalUnitCost: 120 }));
    const tool = createCostbookAnalyzeMarginTool(deps);
    const result = await tool.execute({ costItemId: VALID_COST_ITEM_ID, quantity: 1, sellPricePerUnit: 100 }, {} as never, EXECUTION);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ marginPct: -20 });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("athena_costbook_margin_low");
    expect(result.warnings[0].message).toContain("below cost");
  });

  it("treats a zero unit cost as a 100% margin without dividing by zero", async () => {
    const deps = createFakeDeps(makeBreakdown({ laborCostPerUnit: 0, materialCostPerUnit: 0, equipmentCostPerUnit: 0, totalUnitCost: 0 }));
    const tool = createCostbookAnalyzeMarginTool(deps);
    const result = await tool.execute({ costItemId: VALID_COST_ITEM_ID, quantity: 1, sellPricePerUnit: 50 }, {} as never, EXECUTION);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ marginPct: 100 });
    expect(result.warnings).toEqual([]);
  });
});
