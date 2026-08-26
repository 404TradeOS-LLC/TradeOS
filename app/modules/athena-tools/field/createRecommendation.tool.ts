import { z } from "zod";
import type { JobsService } from "../../jobs/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";
import { warning } from "../../athena-tool-sdk/warnings";

// A12 Field Technician tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Field
// Technician"). Pure computation: composes a structured follow-up
// recommendation from a technician's field observation plus job context read
// via JobsService.getById(). This tool never sends, persists, or
// communicates the recommendation anywhere - it only returns a suggestion
// object in the result's `data`, always flagged
// requiresCustomerApproval: true and paired with a warning() telling the
// caller it must go through human review before reaching the customer (per
// this rollout's "Athena requires approval for: sending customer messages"
// boundary - this tool stays entirely on the "recommend" side of that line,
// never the "send" side). No new LLM call is made here; the recommendation
// text is deterministically templated from the technician's own input.

export const jobRecommendationInputSchema = z.object({
  jobId: z.string().uuid(),
  observation: z.string().min(1).max(2_000),
});
export type JobRecommendationInput = z.infer<typeof jobRecommendationInputSchema>;

export interface JobRecommendationData {
  jobId: string;
  jobNumber: string;
  basedOn: string;
  suggestedFollowUp: string;
  requiresCustomerApproval: true;
}

export interface JobRecommendationToolDeps {
  jobs: Pick<JobsService, "getById">;
}

export function createJobRecommendationTool(deps: JobRecommendationToolDeps): AthenaToolDefinition<JobRecommendationInput, JobRecommendationData> {
  return defineTool({
    id: "tradeos.athena.tools.field.create-recommendation",
    version: "1.0.0",
    owner: "athena-tools-field",
    description: "Composes a follow-up recommendation from a technician's field observation. Never sends anything - the result must go through human review before it reaches a customer.",
    permissions: ["crm.read"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: jobRecommendationInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (job not found) is an unexpected error here and
      // propagates as-is, following recallPreferenceTool.ts's posture.
      const job = await deps.jobs.getById(execution.orgId, input.jobId, { userId: execution.actor.id, role: execution.role });

      const suggestedFollowUp = `Based on the field observation ("${input.observation}"), recommend following up with ${job.customer.name} about job ${job.jobNumber} ("${job.title}") to discuss next steps and confirm before proceeding.`;

      return successResult<JobRecommendationData>({
        summary: `Drafted a follow-up recommendation for job ${job.jobNumber}, pending human review.`,
        data: {
          jobId: job.id,
          jobNumber: job.jobNumber,
          basedOn: input.observation,
          suggestedFollowUp,
          requiresCustomerApproval: true,
        },
        telemetry,
        warnings: [
          warning({
            code: "athena_recommendation_requires_human_review",
            message: "This recommendation has not been sent or communicated to anyone. It must be reviewed by a human before being shared with the customer.",
          }),
        ],
        events: [],
      });
    },
  });
}
