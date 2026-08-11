import { z } from "zod";
import type { EstimateEngineService } from "../../estimate-engine/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Estimator tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Estimator").
// Wraps EstimateEngineService.addLineItemAndRecalculate() so the draft line
// item mutation and totals update commit atomically. No canonical lifecycle
// event is emitted because this is not a finalize/send transition.

export const estimateUpdateInputSchema = z.object({
  estimateId: z.string().uuid(),
  lineItem: z.object({
    costItemId: z.string().optional(),
    assemblyId: z.string().optional(),
    quantity: z.number(),
    description: z.string().optional(),
    sourceKey: z.string().optional(),
  }),
});
export type EstimateUpdateInput = z.infer<typeof estimateUpdateInputSchema>;

export interface EstimateUpdateData {
  lineItem: {
    id: string;
    estimateId: string;
    costItemId: string | null;
    assemblyId: string | null;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitCost: number;
    lineCost: number;
    sortOrder: number;
    sourceKey: string | null;
  };
  estimate: {
    id: string;
    orgId: string | null;
    projectId: string;
    version: number;
    status: string;
    overheadPct: number;
    profitPct: number;
    targetMarginPct: number | null;
    subtotalCost: number;
    totalPrice: number;
  };
}

export interface EstimateUpdateToolDeps {
  estimateEngine: Pick<EstimateEngineService, "addLineItemAndRecalculate">;
}

export function createEstimateUpdateTool(deps: EstimateUpdateToolDeps): AthenaToolDefinition<EstimateUpdateInput, EstimateUpdateData> {
  return defineTool({
    id: "tradeos.athena.tools.estimator.update-estimate",
    version: "1.0.0",
    owner: "athena-tools-estimator",
    description: "Adds a line item to a draft estimate and returns the recalculated totals atomically.",
    permissions: ["billing.write"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "draft_only",
    inputSchema: estimateUpdateInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      const { lineItem, estimate } = await deps.estimateEngine.addLineItemAndRecalculate({
        estimateId: input.estimateId,
        orgId: execution.orgId,
        costItemId: input.lineItem.costItemId,
        assemblyId: input.lineItem.assemblyId,
        quantity: input.lineItem.quantity,
        description: input.lineItem.description,
        sourceKey: input.lineItem.sourceKey,
      });

      return successResult<EstimateUpdateData>({
        summary: `Added "${lineItem.description}" to estimate v${estimate.version}; new total is ${estimate.totalPrice}.`,
        data: { lineItem, estimate },
        telemetry,
        events: [],
      });
    },
  });
}
