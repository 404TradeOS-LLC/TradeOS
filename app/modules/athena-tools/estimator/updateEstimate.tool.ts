import { z } from "zod";
import type { EstimateEngineService } from "../../estimate-engine/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Estimator tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Estimator").
// Wraps EstimateEngineService.addLineItem() followed by recalculate() to
// return fresh totals - both calls only ever touch a still-draft estimate
// (addLineItem's own assertDraft guard), so this tool is compensationPolicy
// "draft_only" like create-estimate. No event is referenced: adding a line
// item is not a canonical Estimate* lifecycle transition (see the plan's
// section 4 table - "none (not final)").

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
  estimateEngine: Pick<EstimateEngineService, "addLineItem" | "recalculate">;
}

export function createEstimateUpdateTool(deps: EstimateUpdateToolDeps): AthenaToolDefinition<EstimateUpdateInput, EstimateUpdateData> {
  return defineTool({
    id: "tradeos.athena.tools.estimator.update-estimate",
    version: "1.0.0",
    owner: "athena-tools-estimator",
    description: "Adds a line item to a draft estimate and returns the recalculated totals.",
    permissions: ["billing.write"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "draft_only",
    inputSchema: estimateUpdateInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (estimate not found, not draft, missing/both of
      // costItemId+assemblyId, etc.) is an unexpected error here and
      // propagates as-is - no specific expected domain case is translated,
      // following recallPreferenceTool.ts's posture.
      const lineItem = await deps.estimateEngine.addLineItem({
        estimateId: input.estimateId,
        orgId: execution.orgId,
        costItemId: input.lineItem.costItemId,
        assemblyId: input.lineItem.assemblyId,
        quantity: input.lineItem.quantity,
        description: input.lineItem.description,
        sourceKey: input.lineItem.sourceKey,
      });
      const estimate = await deps.estimateEngine.recalculate(input.estimateId, execution.orgId);

      return successResult<EstimateUpdateData>({
        summary: `Added "${lineItem.description}" to estimate v${estimate.version}; new total is ${estimate.totalPrice}.`,
        data: { lineItem, estimate },
        telemetry,
        // Not a canonical lifecycle transition - no event to reference.
        events: [],
      });
    },
  });
}
