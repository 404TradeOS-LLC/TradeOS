import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createEstimateAnalyzeTool } from "../modules/athena-tools/estimator/analyzeEstimate.tool";
import type { EstimateAnalyzeToolDeps } from "../modules/athena-tools/estimator/analyzeEstimate.tool";
import type { EstimateDTO, EstimateLineItemDTO } from "../modules/estimate-engine/types";

// A12 Estimator contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).

const VALID_ESTIMATE_ID = "33333333-3333-4333-8333-333333333333";

function makeLineItem(overrides: Partial<EstimateLineItemDTO> = {}): EstimateLineItemDTO {
  return {
    id: "line-1",
    estimateId: VALID_ESTIMATE_ID,
    costItemId: "cost-item-1",
    assemblyId: null,
    description: "Drywall",
    quantity: 10,
    unitOfMeasure: "sf",
    unitCost: 5,
    lineCost: 50,
    sortOrder: 1,
    sourceKey: null,
    ...overrides,
  };
}

function makeEstimate(overrides: Partial<EstimateDTO> = {}, lineItems: EstimateLineItemDTO[] = [makeLineItem()]): EstimateDTO & { lineItems: EstimateLineItemDTO[] } {
  return {
    id: VALID_ESTIMATE_ID,
    orgId: "org-1",
    projectId: "project-1",
    version: 1,
    status: "draft",
    overheadPct: 0,
    profitPct: 0,
    targetMarginPct: null,
    subtotalCost: 50,
    totalPrice: 100,
    lineItems,
    ...overrides,
  };
}

function createFakeEstimateEngine(estimate: EstimateDTO & { lineItems: EstimateLineItemDTO[] }): EstimateAnalyzeToolDeps["estimateEngine"] {
  return { getById: jest.fn(async () => estimate) };
}

describe("athena-tools estimator: analyze-estimate", () => {
  describeAthenaToolContract(createEstimateAnalyzeTool({ estimateEngine: createFakeEstimateEngine(makeEstimate()) }), {
    validInput: { estimateId: VALID_ESTIMATE_ID },
    invalidInputs: [{ estimateId: "not-a-uuid" }, {}],
  });

  it("computes realized margin and line item count from the estimate DTO", async () => {
    const estimateEngine = createFakeEstimateEngine(makeEstimate({ subtotalCost: 50, totalPrice: 100 }));
    const tool = createEstimateAnalyzeTool({ estimateEngine });
    const result = await tool.execute(
      { estimateId: VALID_ESTIMATE_ID },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ realizedMarginPct: 50, lineItemCount: 1 });
    expect(result.warnings).toEqual([]);
  });

  it("warns when the estimate has no line items yet", async () => {
    const estimateEngine = createFakeEstimateEngine(makeEstimate({ subtotalCost: 0, totalPrice: 0 }, []));
    const tool = createEstimateAnalyzeTool({ estimateEngine });
    const result = await tool.execute(
      { estimateId: VALID_ESTIMATE_ID },
      {} as never,
      { executionId: "exec-2", requestId: "req-2", traceId: "trace-2", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ realizedMarginPct: 0, lineItemCount: 0 });
    expect(result.warnings).toEqual([{ code: "athena_estimate_no_line_items", message: "This estimate has no line items yet." }]);
  });

  it("warns when the realized margin is at or below cost", async () => {
    const estimateEngine = createFakeEstimateEngine(makeEstimate({ subtotalCost: 100, totalPrice: 100 }));
    const tool = createEstimateAnalyzeTool({ estimateEngine });
    const result = await tool.execute(
      { estimateId: VALID_ESTIMATE_ID },
      {} as never,
      { executionId: "exec-3", requestId: "req-3", traceId: "trace-3", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ realizedMarginPct: 0 });
    expect(result.warnings).toEqual([{ code: "athena_estimate_non_positive_margin", message: "This estimate's realized margin is 0.0%, at or below cost." }]);
  });
});
