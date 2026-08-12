import { z } from "zod";
import type { JobsService } from "../../jobs/service";
import type { JobDTO } from "../../jobs/types";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { eventRef } from "../../athena-tool-sdk/events";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Field Technician tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Field
// Technician"). Delegates transition validity and field-worker authorization
// to JobsService, and exposes only status-relevant fields back across the AI
// boundary. Customer contact details and other hydrated JobDTO collections are
// deliberately omitted.

export const updateJobStatusInputSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["traveling", "on_site", "completed"]),
  reason: z.string().max(500).optional(),
});
export type UpdateJobStatusInput = z.infer<typeof updateJobStatusInputSchema>;

export interface JobUpdateStatusData {
  id: string;
  jobNumber: string;
  title: string;
  status: JobDTO["status"];
  priority: JobDTO["priority"];
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  completedAt: string | null;
}

export interface JobUpdateStatusToolDeps {
  jobs: Pick<JobsService, "startTravel" | "arrive" | "complete">;
}

function toStatusData(job: JobDTO): JobUpdateStatusData {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    status: job.status,
    priority: job.priority,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    actualStart: job.actualStart,
    actualEnd: job.actualEnd,
    completedAt: job.completedAt,
  };
}

export function createJobUpdateStatusTool(deps: JobUpdateStatusToolDeps): AthenaToolDefinition<UpdateJobStatusInput, JobUpdateStatusData> {
  return defineTool({
    id: "tradeos.athena.tools.field.update-job-status",
    version: "1.0.0",
    owner: "athena-tools-field",
    description: "Transitions a field job's status (traveling, on_site, completed) on behalf of the assigned technician or a manager.",
    permissions: [],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "compensating_action",
    inputSchema: updateJobStatusInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const transitionInput = {
        orgId: execution.orgId,
        actor: { userId: execution.actor.id, orgId: execution.orgId, role: execution.role },
        reason: input.reason,
      };

      switch (input.status) {
        case "traveling": {
          const job = await deps.jobs.startTravel(input.jobId, transitionInput);
          return successResult<JobUpdateStatusData>({
            summary: `Job ${job.jobNumber} marked traveling.`,
            data: toStatusData(job),
            telemetry,
            events: [],
          });
        }
        case "on_site": {
          const job = await deps.jobs.arrive(input.jobId, transitionInput);
          return successResult<JobUpdateStatusData>({
            summary: `Job ${job.jobNumber} marked on site.`,
            data: toStatusData(job),
            telemetry,
            events: [],
          });
        }
        case "completed": {
          const result = await deps.jobs.complete(input.jobId, transitionInput);
          const { athenaEvent, ...job } = result;
          return successResult<JobUpdateStatusData>({
            summary: `Job ${job.jobNumber} marked completed.`,
            data: toStatusData(job),
            telemetry,
            events: athenaEvent ? [eventRef(athenaEvent.type, athenaEvent.id)] : [],
          });
        }
      }
    },
  });
}
