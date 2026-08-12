import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createEstimateCompareTool } from "../modules/athena-tools/estimator/compareEstimates.tool";
import type { EstimateCompareToolDeps } from "../modules/athena-tools/estimator/compareEstimates.tool";
import type { EstimateComparisonDTO } from "../modules/estimate-engine/types";

// A12 Estimator contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).

const BASE_ESTIMATE_ID = "44444444-4444-4444-8444-444444444444";
const CANDIDATE_ESTIMATE_ID = "55555555-5555-4555-8555-555555555555";

function makeComparison(): EstimateComparisonDTO {
  return {
    base: { id: BASE_ESTIMATE_ID, version: 1, subtotalCost: 100, totalPrice: 150, marginPct: 33.33, lineItemCount: 2 },
    candidate: { id: CANDIDATE_ESTIMATE_ID, version: 2, subtotalCost: 120, totalPrice: 180, marginPct: 33.33, lineItemCount: 3 },
    delta: { subtotalCost: 20, totalPrice: 30, marginPct: 0, lineItemCount: 1 },
  };
}

function createFakeEstimateEngine(comparison: EstimateComparisonDTO): EstimateCompareToolDeps["estimateEngine"] {
  return { compareEstimates: jest.fn(async () => comparison) };
}

describe("athena-tools estimator: compare-estimates", () => {
  describeAthenaToolContract(createEstimateCompareTool({ estimateEngine: createFakeEstimateEngine(makeComparison()) }), {
    validInput: { baseEstimateId: BASE_ESTIMATE_ID, candidateEstimateId: CANDIDATE_ESTIMATE_ID },
    invalidInputs: [{ baseEstimateId: "not-a-uuid", candidateEstimateId: CANDIDATE_ESTIMATE_ID }, {}, { baseEstimateId: BASE_ESTIMATE_ID }],
  });

  it("passes both estimate ids and orgId through, and returns the comparison DTO verbatim as data", async () => {
    const comparison = makeComparison();
    const estimateEngine = createFakeEstimateEngine(comparison);
    const tool = createEstimateCompareTool({ estimateEngine });
    const result = await tool.execute(
      { baseEstimateId: BASE_ESTIMATE_ID, candidateEstimateId: CANDIDATE_ESTIMATE_ID },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(estimateEngine.compareEstimates).toHaveBeenCalledWith(BASE_ESTIMATE_ID, CANDIDATE_ESTIMATE_ID, "org-1");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(comparison);
    expect(result.events).toEqual([]);
  });
});
