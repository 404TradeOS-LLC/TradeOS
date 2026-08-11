import { z } from "zod";
import type { EstimateEngineService } from "../../estimate-engine/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { eventRef } from "../../athena-tool-sdk/events";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Estimator tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Estimator").
// Wraps EstimateEngineService.create() - always produces a `status: "draft"`
// estimate, never a sent/finalized one, which is why this tool is
// compensationPolicy "draft_only" and risk "low" per the plan's section 5
// rationale ("Athena may automatically... prepare drafts"). Its service
// dependency is explicit constructor injection (never a global locator),
// matching athena-tool-sdk/fixtures/recallPreferenceTool.ts's posture.

export const estimateCreateInputSchema = z.object({
  projectId: z.string().uuid(),
  overheadPct: z.number().finite().min(0).max(100).optional(),
});
export type EstimateCreateInput = z.infer<typeof estimateCreateInputSchema>;

export interface EstimateCreateData {
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
}

export interface EstimateCreateToolDeps {
  estimateEngine: Pick<EstimateEngineService, "create">;
}

export function createEstimateCreateTool(deps: EstimateCreateToolDeps): AthenaToolDefinition<EstimateCreateInput, EstimateCreateData> {
  return defineTool({
    id: "tradeos.athena.tools.estimator.create-estimate",
    version: "1.0.0",
    owner: "athena-tools-estimator",
    description: "Creates a new draft estimate for a project, ready for line items to be added.",
    permissions: ["billing.write"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "optional",
    compensationPolicy: "draft_only",
    inputSchema: estimateCreateInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      const result = await deps.estimateEngine.create({
        orgId: execution.orgId,
        projectId: input.projectId,
        overheadPct: input.overheadPct,
      });

      return successResult<EstimateCreateData>({
        summary: `Created draft estimate v${result.version} for project ${result.projectId}.`,
        data: {
          id: result.id,
          orgId: result.orgId,
          projectId: result.projectId,
          version: result.version,
          status: result.status,
          overheadPct: result.overheadPct,
          profitPct: result.profitPct,
          targetMarginPct: result.targetMarginPct,
          subtotalCost: result.subtotalCost,
          totalPrice: result.totalPrice,
        },
        telemetry,
        events: result.athenaEvent ? [eventRef(result.athenaEvent.type, result.athenaEvent.id)] : [],
      });
    },
  });
}
