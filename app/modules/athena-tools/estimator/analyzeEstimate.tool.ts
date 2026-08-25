import { z } from "zod";
import type { EstimateEngineService } from "../../estimate-engine/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition, AthenaWarning } from "../../athena-tool-sdk/types";
import { warning } from "../../athena-tool-sdk/warnings";
import { applyOverhead } from "../../estimate-engine/formulas";

// A12 Estimator tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Estimator").
// Read-only: computes margin analysis purely from EstimateEngineService.
// getById()'s own DTO, no new service method or business logic beyond what
// that DTO already carries. risk "low", confirmationPolicy "never" - a pure
// analysis/read, never a mutation.

export const estimateAnalyzeInputSchema = z.object({
  estimateId: z.string().uuid(),
});
export type EstimateAnalyzeInput = z.infer<typeof estimateAnalyzeInputSchema>;

export interface EstimateAnalyzeData {
  estimateId: string;
  status: string;
  subtotalCost: number;
  totalPrice: number;
  realizedMarginPct: number;
  lineItemCount: number;
}

export interface EstimateAnalyzeToolDeps {
  estimateEngine: Pick<EstimateEngineService, "getById">;
}

export function createEstimateAnalyzeTool(deps: EstimateAnalyzeToolDeps): AthenaToolDefinition<EstimateAnalyzeInput, EstimateAnalyzeData> {
  return defineTool({
    id: "tradeos.athena.tools.estimator.analyze-estimate",
    version: "1.0.0",
    owner: "athena-tools-estimator",
    description: "Analyzes an estimate's realized margin and flags simple risk indicators derived from its line items.",
    permissions: ["billing.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: estimateAnalyzeInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const estimate = await deps.estimateEngine.getById(input.estimateId, execution.orgId);

      const preTaxTotalPrice = estimate.preTaxTotalPrice ?? estimate.totalPrice - (estimate.taxAmount ?? 0);
      const costAfterOverhead = estimate.costAfterOverhead ?? applyOverhead(estimate.subtotalCost, 0, estimate.overheadPct);
      const realizedMarginPct = preTaxTotalPrice <= 0 || preTaxTotalPrice <= costAfterOverhead ? 0 : ((preTaxTotalPrice - costAfterOverhead) / preTaxTotalPrice) * 100;

      const warnings: AthenaWarning[] = [];
      if (estimate.lineItems.length === 0) {
        warnings.push(warning({ code: "athena_estimate_no_line_items", message: "This estimate has no line items yet." }));
      }
      if (estimate.totalPrice === 0 && estimate.subtotalCost > 0) {
        warnings.push(
          warning({
            code: "athena_estimate_zero_price_with_cost",
            message: `This estimate has $${estimate.subtotalCost.toFixed(2)} in cost but a $0.00 total price.`,
          })
        );
      } else if (estimate.totalPrice > 0 && realizedMarginPct <= 0) {
        warnings.push(warning({ code: "athena_estimate_non_positive_margin", message: `This estimate's realized margin is ${realizedMarginPct.toFixed(1)}%, at or below cost.` }));
      }

      return successResult<EstimateAnalyzeData>({
        summary: `Estimate v${estimate.version} has a realized margin of ${realizedMarginPct.toFixed(1)}% across ${estimate.lineItems.length} line item(s).`,
        data: {
          estimateId: estimate.id,
          status: estimate.status,
          subtotalCost: estimate.subtotalCost,
          totalPrice: estimate.totalPrice,
          realizedMarginPct,
          lineItemCount: estimate.lineItems.length,
        },
        telemetry,
        warnings,
        events: [],
      });
    },
  });
}
