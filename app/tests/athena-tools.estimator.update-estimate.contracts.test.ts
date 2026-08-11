import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createEstimateUpdateTool } from "../modules/athena-tools/estimator/updateEstimate.tool";
import type { EstimateUpdateToolDeps } from "../modules/athena-tools/estimator/updateEstimate.tool";

const VALID_ESTIMATE_ID = "22222222-2222-4222-8222-222222222222";

function createFakeEstimateEngine(): EstimateUpdateToolDeps["estimateEngine"] {
  return {
    addLineItemAndRecalculate: jest.fn(async (input) => ({
      lineItem: {
        id: "line-1",
        estimateId: input.estimateId,
        costItemId: input.costItemId ?? null,
        assemblyId: input.assemblyId ?? null,
        description: input.description ?? "Fake line item",
        quantity: input.quantity,
        unitOfMeasure: "ea",
        unitCost: 10,
        lineCost: 10 * input.quantity,
        sortOrder: 1,
        sourceKey: input.sourceKey ?? null,
      },
      estimate: {
        id: input.estimateId,
        orgId: "org-1",
        projectId: "project-1",
        version: 1,
        status: "draft" as const,
        overheadPct: 0,
        profitPct: 0,
        targetMarginPct: null,
        subtotalCost: 10,
        totalPrice: 12,
      },
    })),
  };
}

describe("athena-tools estimator: update-estimate", () => {
  describeAthenaToolContract(createEstimateUpdateTool({ estimateEngine: createFakeEstimateEngine() }), {
    validInput: { estimateId: VALID_ESTIMATE_ID, lineItem: { costItemId: "cost-item-1", quantity: 3, description: "Drywall sheets" } },
    invalidInputs: [{ estimateId: "not-a-uuid", lineItem: { quantity: 1 } }, {}, { estimateId: VALID_ESTIMATE_ID, lineItem: { quantity: "three" } }],
  });

  it("uses the single atomic service operation and returns its line item and recalculated estimate", async () => {
    const estimateEngine = createFakeEstimateEngine();
    const tool = createEstimateUpdateTool({ estimateEngine });
    const result = await tool.execute(
      { estimateId: VALID_ESTIMATE_ID, lineItem: { assemblyId: "assembly-1", quantity: 2, sourceKey: "src-1" } },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(estimateEngine.addLineItemAndRecalculate).toHaveBeenCalledTimes(1);
    expect(estimateEngine.addLineItemAndRecalculate).toHaveBeenCalledWith({
      estimateId: VALID_ESTIMATE_ID,
      orgId: "org-1",
      costItemId: undefined,
      assemblyId: "assembly-1",
      quantity: 2,
      description: undefined,
      sourceKey: "src-1",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ lineItem: { id: "line-1" }, estimate: { totalPrice: 12 } });
    expect(result.events).toEqual([]);
  });

  it("propagates atomic service failures without returning partial success", async () => {
    const estimateEngine = createFakeEstimateEngine();
    (estimateEngine.addLineItemAndRecalculate as jest.Mock).mockRejectedValueOnce(new Error("recalculation failed"));
    const tool = createEstimateUpdateTool({ estimateEngine });

    await expect(
      tool.execute(
        { estimateId: VALID_ESTIMATE_ID, lineItem: { costItemId: "cost-item-1", quantity: 1 } },
        {} as never,
        { executionId: "exec-2", requestId: "req-2", traceId: "trace-2", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
      )
    ).rejects.toThrow("recalculation failed");
  });
});
