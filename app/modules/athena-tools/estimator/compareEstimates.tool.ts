import { z } from "zod";
import type { EstimateEngineService } from "../../estimate-engine/service";
import type { EstimateComparisonDTO } from "../../estimate-engine/types";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Estimator tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Estimator").
// Wraps the new EstimateEngineService.compareEstimates() (added for A12,
// section 3.2 of the plan) - read-only, never mutates either estimate.
// risk "low", confirmationPolicy "never".

export const estimateCompareInputSchema = z.object({
  baseEstimateId: z.string().uuid(),
  candidateEstimateId: z.string().uuid(),
});
export type EstimateCompareInput = z.infer<typeof estimateCompareInputSchema>;

export type EstimateCompareData = EstimateComparisonDTO;

export interface EstimateCompareToolDeps {
  estimateEngine: Pick<EstimateEngineService, "compareEstimates">;
}

export function createEstimateCompareTool(deps: EstimateCompareToolDeps): AthenaToolDefinition<EstimateCompareInput, EstimateCompareData> {
  return defineTool({
    id: "tradeos.athena.tools.estimator.compare-estimates",
    version: "1.0.0",
    owner: "athena-tools-estimator",
    description: "Compares two estimates' cost, price, margin, and line-item counts.",
    permissions: ["billing.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: estimateCompareInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (either estimate not found) is an unexpected
      // error here and propagates as-is, following recallPreferenceTool.ts's
      // posture.
      const comparison = await deps.estimateEngine.compareEstimates(input.baseEstimateId, input.candidateEstimateId, execution.orgId);

      return successResult<EstimateCompareData>({
        summary: `Compared estimate v${comparison.base.version} against v${comparison.candidate.version}: price delta ${comparison.delta.totalPrice}, margin delta ${comparison.delta.marginPct}pp.`,
        data: comparison,
        telemetry,
        events: [],
      });
    },
  });
}
