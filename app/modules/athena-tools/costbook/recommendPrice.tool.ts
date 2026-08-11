import { z } from "zod";
import type { CostDatabaseService } from "../../cost-database/service";
import type { UnitCostBreakdown } from "../../cost-database/types";
import { sellPrice } from "../../estimate-engine/formulas";
import { defineTool, failureResult, successResult, warning } from "../../athena-tool-sdk";
import type { AthenaToolDefinition } from "../../athena-tool-sdk";

// A12 Costbook Intelligence tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Costbook
// Intelligence"). A thin wrapper: CostDatabaseService.getUnitCost() supplies
// the true unit cost breakdown, and estimate-engine/formulas.ts's own
// sellPrice() (mode: "targetMargin") supplies the pricing math - no new
// pricing formula is written here.
//
// deps only exposes getUnitCost (a read) - Pick<CostDatabaseService,
// "getUnitCost"> makes it structurally impossible for this tool to reach
// any write-capable CostDatabaseService method (create/update/delete), even
// if execute() tried to. This tool NEVER writes to CostItem/Material/any
// pricing table; it returns a suggested number only. risk stays "low" per
// the plan's section 5 (a recommendation is not a price change), but
// confirmationPolicy is "contextual" (not "never") to surface, at the UI
// layer, that this number is a suggestion the user should consciously
// review before acting on it - company pricing rules/overrides are entirely
// unaffected by calling this tool.

export const costbookRecommendPriceInputSchema = z.object({
  costItemId: z.string().uuid(),
  quantity: z.number().positive().default(1),
  regionId: z.string().uuid().optional(),
  targetMarginPct: z.number().min(0).max(100),
});
export type CostbookRecommendPriceInput = z.infer<typeof costbookRecommendPriceInputSchema>;

export interface CostbookRecommendPriceData {
  costBreakdown: UnitCostBreakdown;
  recommendedPricePerUnit: number;
  targetMarginPct: number;
}

export interface CostbookRecommendPriceToolDeps {
  costDatabase: Pick<CostDatabaseService, "getUnitCost">;
}

export function createCostbookRecommendPriceTool(deps: CostbookRecommendPriceToolDeps): AthenaToolDefinition<CostbookRecommendPriceInput, CostbookRecommendPriceData> {
  return defineTool({
    id: "tradeos.athena.tools.costbook.recommend-price",
    version: "1.0.0",
    owner: "athena-tools-costbook",
    description: "Recommends a sell price per unit for a cost item at a target margin. Returns a suggestion only - never writes any stored price.",
    permissions: ["billing.read"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: costbookRecommendPriceInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      const costBreakdown = await deps.costDatabase.getUnitCost(input.costItemId, input.quantity, input.regionId, execution.orgId);

      let recommendedPricePerUnit: number;
      try {
        recommendedPricePerUnit = sellPrice({ totalCost: costBreakdown.totalUnitCost, mode: "targetMargin", targetMarginPct: input.targetMarginPct });
      } catch (error) {
        return failureResult<CostbookRecommendPriceData>({
          summary: `Cannot recommend a price at a ${input.targetMarginPct}% target margin.`,
          telemetry,
          error: {
            code: "athena_costbook_recommend_price_invalid_target_margin",
            category: "validation",
            retryable: false,
            safeSummary: error instanceof Error ? error.message : `Cannot recommend a price at a ${input.targetMarginPct}% target margin.`,
            correlationId: execution.executionId,
          },
        });
      }

      return successResult<CostbookRecommendPriceData>({
        summary: `Recommended price is $${recommendedPricePerUnit.toFixed(2)}/unit to achieve a ${input.targetMarginPct}% target margin on a true unit cost of $${costBreakdown.totalUnitCost.toFixed(2)}.`,
        data: { costBreakdown, recommendedPricePerUnit, targetMarginPct: input.targetMarginPct },
        telemetry,
        warnings: [
          warning({
            code: "athena_costbook_recommend_price_is_suggestion_only",
            message: "This is a recommended price only. No stored price, CostItem, or Material record has been changed, and no company pricing rule or override has been bypassed.",
          }),
        ],
      });
    },
  });
}
