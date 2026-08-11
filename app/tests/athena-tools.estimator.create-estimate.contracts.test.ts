import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createEstimateCreateTool } from "../modules/athena-tools/estimator/createEstimate.tool";
import type { EstimateCreateToolDeps } from "../modules/athena-tools/estimator/createEstimate.tool";

// A12 Estimator contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).
// Follows app/tests/athena-tool-sdk.contracts.test.ts's pattern: a
// hand-rolled jest.fn()-based fake service matching this tool's own
// Pick<EstimateEngineService, "create"> deps shape, never
// tests/helpers/fakeAthenaObservabilityDb.ts (unrelated suite).

const VALID_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function createFakeEstimateEngine(): EstimateCreateToolDeps["estimateEngine"] {
  return {
    create: jest.fn(async (input) => ({
      id: "estimate-1",
      orgId: input.orgId ?? null,
      projectId: input.projectId,
      version: 1,
      status: "draft" as const,
      overheadPct: input.overheadPct ?? 0,
      profitPct: 0,
      targetMarginPct: null,
      subtotalCost: 0,
      totalPrice: 0,
      athenaEvent: { type: "EstimateStarted", id: "event-1" },
    })),
  };
}

describe("athena-tools estimator: create-estimate", () => {
  describeAthenaToolContract(createEstimateCreateTool({ estimateEngine: createFakeEstimateEngine() }), {
    validInput: { projectId: VALID_PROJECT_ID, overheadPct: 10 },
    invalidInputs: [{ projectId: "not-a-uuid" }, {}, { projectId: VALID_PROJECT_ID, overheadPct: "ten" }],
  });

  it("passes orgId/projectId/overheadPct through to the service and wraps the returned athenaEvent", async () => {
    const estimateEngine = createFakeEstimateEngine();
    const tool = createEstimateCreateTool({ estimateEngine });
    const result = await tool.execute(
      { projectId: VALID_PROJECT_ID, overheadPct: 12 },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(estimateEngine.create).toHaveBeenCalledWith({ orgId: "org-1", projectId: VALID_PROJECT_ID, overheadPct: 12 });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ id: "estimate-1", projectId: VALID_PROJECT_ID, status: "draft" });
    expect(result.events).toEqual([{ type: "EstimateStarted", id: "event-1" }]);
  });

  it("returns no events when the service's athenaEvent is undefined, rather than fabricating one", async () => {
    const estimateEngine: EstimateCreateToolDeps["estimateEngine"] = {
      create: jest.fn(async (input) => ({
        id: "estimate-2",
        orgId: input.orgId ?? null,
        projectId: input.projectId,
        version: 1,
        status: "draft" as const,
        overheadPct: 0,
        profitPct: 0,
        targetMarginPct: null,
        subtotalCost: 0,
        totalPrice: 0,
        athenaEvent: undefined,
      })),
    };
    const tool = createEstimateCreateTool({ estimateEngine });
    const result = await tool.execute(
      { projectId: VALID_PROJECT_ID },
      {} as never,
      { executionId: "exec-2", requestId: "req-2", traceId: "trace-2", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(result.success).toBe(true);
    expect(result.events).toEqual([]);
  });
});
