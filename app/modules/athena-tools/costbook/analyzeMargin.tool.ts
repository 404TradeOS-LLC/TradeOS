import { z } from "zod";
import type { CostDatabaseService } from "../../cost-database/service";
import type { UnitCostBreakdown } from "../../cost-database/types";
import { marginFromMarkup } from "../../estimate-engine/formulas";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition, AthenaWarning } from "../../athena-tool-sdk/types";
import { warning } from "../../athena-tool-sdk/warnings";

// A12 Costbook Intelligence tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Costbook
// Intelligence"). A thin wrapper: CostDatabaseService.getUnitCost() supplies
// the true unit cost breakdown, and estimate-engine/formulas.ts's own
// marginFromMarkup() supplies the margin math - no new pricing formula is
// written here (per the plan's explicit rule that every formula needed
// already exists in formulas.ts).
//
// Deriving margin% from a known sell price and cost via marginFromMarkup():
// markupPct is first computed as the plain percentage markup implied by
// (sellPricePerUnit, totalUnitCost) - i.e. how much sellPricePerUnit exceeds
// totalUnitCost, expressed as a % of totalUnitCost. marginFromMarkup()
// already converts *any* markup% into the equivalent margin% (marginPct =
// markupPct / (100 + markupPct) * 100), and that conversion is exactly the
// standard margin-from-cost-and-price identity here: substituting markupPct
// = (sellPricePerUnit - totalUnitCost) / totalUnitCost * 100 into
// marginFromMarkup() algebraically reduces to (sellPricePerUnit -
// totalUnitCost) / sellPricePerUnit * 100, the margin definition - so this
// reuses the existing exported function verbatim rather than duplicating
// that arithmetic. When totalUnitCost is 0 the markup ratio is undefined
// (division by zero), so that edge case is treated directly as a 100%
// margin (any positive price against zero cost is pure profit) without
// calling marginFromMarkup().

export const costbookAnalyzeMarginInputSchema = z.object({
  costItemId: z.string().uuid(),
  quantity: z.number().positive().default(1),
  regionId: z.string().uuid().optional(),
  sellPricePerUnit: z.number().positive(),
});
export type CostbookAnalyzeMarginInput = z.infer<typeof costbookAnalyzeMarginInputSchema>;

export interface CostbookAnalyzeMarginData {
  costBreakdown: UnitCostBreakdown;
  sellPricePerUnit: number;
  marginPct: number;
}

export interface CostbookAnalyzeMarginToolDeps {
  costDatabase: Pick<CostDatabaseService, "getUnitCost">;
}

const LOW_MARGIN_WARNING_THRESHOLD_PCT = 10;

export function createCostbookAnalyzeMarginTool(deps: CostbookAnalyzeMarginToolDeps): AthenaToolDefinition<CostbookAnalyzeMarginInput, CostbookAnalyzeMarginData> {
  return defineTool({
    id: "tradeos.athena.tools.costbook.analyze-margin",
    version: "1.0.0",
    owner: "athena-tools-costbook",
    description: "Computes the margin between a given sell price and a cost item's true unit cost breakdown.",
    permissions: ["billing.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: costbookAnalyzeMarginInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (cost item not found) is an unexpected error
      // here and propagates as-is, following recallPreferenceTool.ts's
      // posture (see also estimator/analyzeEstimate.tool.ts's identical
      // comment for the sibling A12 read-only tool this one mirrors).
      const costBreakdown = await deps.costDatabase.getUnitCost(input.costItemId, input.quantity, input.regionId, execution.orgId);

      const marginPct =
        costBreakdown.totalUnitCost <= 0
          ? 100
          : marginFromMarkup(((input.sellPricePerUnit - costBreakdown.totalUnitCost) / costBreakdown.totalUnitCost) * 100);

      const warnings: AthenaWarning[] = [];
      if (marginPct < LOW_MARGIN_WARNING_THRESHOLD_PCT) {
        warnings.push(
          warning({
            code: "athena_costbook_margin_low",
            message: `Margin of ${marginPct.toFixed(1)}% is below the ${LOW_MARGIN_WARNING_THRESHOLD_PCT}% threshold this analysis flags as unusually low${marginPct < 0 ? " (this sell price is below cost)" : ""}.`,
          })
        );
      }

      return successResult<CostbookAnalyzeMarginData>({
        summary: `A sell price of $${input.sellPricePerUnit.toFixed(2)}/unit against a true unit cost of $${costBreakdown.totalUnitCost.toFixed(2)} yields a margin of ${marginPct.toFixed(1)}%.`,
        data: { costBreakdown, sellPricePerUnit: input.sellPricePerUnit, marginPct },
        telemetry,
        warnings,
      });
    },
  });
}
