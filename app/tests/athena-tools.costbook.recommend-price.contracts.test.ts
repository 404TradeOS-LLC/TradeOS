import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createCostbookRecommendPriceTool } from "../modules/athena-tools/costbook/recommendPrice.tool";
import type { CostbookRecommendPriceToolDeps } from "../modules/athena-tools/costbook/recommendPrice.tool";
import type { UnitCostBreakdown } from "../modules/cost-database/types";

// A12 Costbook Intelligence contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).

const VALID_COST_ITEM_ID = "66666666-6666-4666-8666-666666666666";
const VALID_REGION_ID = "77777777-7777-4777-8777-777777777777";

function makeBreakdown(overrides: Partial<UnitCostBreakdown> = {}): UnitCostBreakdown {
  return {
    laborCostPerUnit: 40,
    materialCostPerUnit: 30,
    equipmentCostPerUnit: 10,
    totalUnitCost: 80,
    ...overrides,
  };
}

function createFakeDeps(breakdown: UnitCostBreakdown): CostbookRecommendPriceToolDeps {
  return { costDatabase: { getUnitCost: jest.fn(async () => breakdown) } };
}

const EXECUTION = { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user" as const, id: "user-1" }, role: "owner" as const, deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] };

describe("athena-tools costbook: recommend-price", () => {
  describeAthenaToolContract(createCostbookRecommendPriceTool(createFakeDeps(makeBreakdown())), {
    validInput: { costItemId: VALID_COST_ITEM_ID, quantity: 10, regionId: VALID_REGION_ID, targetMarginPct: 25 },
    invalidInputs: [{ costItemId: "not-a-uuid", targetMarginPct: 25 }, {}, { costItemId: VALID_COST_ITEM_ID, targetMarginPct: 150 }],
  });

  it("recommends a price via formulas.ts's sellPrice(mode: targetMargin), using execution.orgId, and warns it is a suggestion only", async () => {
    const deps = createFakeDeps(makeBreakdown({ totalUnitCost: 80 }));
    const tool = createCostbookRecommendPriceTool(deps);
    const result = await tool.execute({ costItemId: VALID_COST_ITEM_ID, quantity: 10, regionId: VALID_REGION_ID, targetMarginPct: 20 }, {} as never, EXECUTION);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ recommendedPricePerUnit: 100, targetMarginPct: 20 });
    expect(deps.costDatabase.getUnitCost).toHaveBeenCalledWith(VALID_COST_ITEM_ID, 10, VALID_REGION_ID, "org-1");
    expect(result.warnings).toEqual([
      { code: "athena_costbook_recommend_price_is_suggestion_only", message: "This is a recommended price only. No stored price, CostItem, or Material record has been changed, and no company pricing rule or override has been bypassed." },
    ]);
  });

  it("fails cleanly (not an uncaught exception) when targetMarginPct is exactly 100, the mathematically undefined boundary", async () => {
    const deps = createFakeDeps(makeBreakdown({ totalUnitCost: 80 }));
    const tool = createCostbookRecommendPriceTool(deps);
    const result = await tool.execute({ costItemId: VALID_COST_ITEM_ID, quantity: 1, targetMarginPct: 100 }, {} as never, EXECUTION);

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({ code: "athena_costbook_recommend_price_invalid_target_margin", category: "validation", retryable: false });
  });

  it("never writes to any pricing table: the deps shape structurally exposes no write-capable CostDatabaseService method", () => {
    const deps = createFakeDeps(makeBreakdown());
    // deps.costDatabase's declared type is Pick<CostDatabaseService, "getUnitCost">
    // - "create"/"update"/"delete"/"bulkImport" are not assignable properties
    // of that type, so this fake (and any real CostDatabaseService passed as
    // this dependency) can never expose them to this tool's execute(), not
    // merely by convention but by the type system. Confirmed here at
    // runtime too: the fake object literal was never given those methods.
    expect((deps.costDatabase as unknown as Record<string, unknown>).create).toBeUndefined();
    expect((deps.costDatabase as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((deps.costDatabase as unknown as Record<string, unknown>).delete).toBeUndefined();
    expect((deps.costDatabase as unknown as Record<string, unknown>).bulkImport).toBeUndefined();
    expect(Object.keys(deps.costDatabase)).toEqual(["getUnitCost"]);
  });
});
