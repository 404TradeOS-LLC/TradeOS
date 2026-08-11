import { z } from "zod";
import type { JobsService } from "../../jobs/service";
import type { JobDTO } from "../../jobs/types";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { eventRef } from "../../athena-tool-sdk/events";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Field Technician tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Field
// Technician"). Delegates entirely to JobsService's own status-transition
// methods - this tool performs no Prisma access and no transition-validity
// logic of its own; all of that (allowed-from-status checks, technician
// assignment checks) already lives in JobsService.transition(). Only the
// "completed" transition (JobsService.complete()) publishes a canonical A8
// event (WorkCompleted); "traveling" (startTravel) and "on_site" (arrive)
// have no canonical event wired in this A12 rollout, so their branches never
// fabricate one - see this file's execute() below, structured as a
// discriminated switch specifically so only the "completed" branch's result
// type carries the optional `athenaEvent` field, with no `any` cast needed
// anywhere in this file.

export const updateJobStatusInputSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["traveling", "on_site", "completed"]),
  reason: z.string().max(500).optional(),
});
export type UpdateJobStatusInput = z.infer<typeof updateJobStatusInputSchema>;

export interface JobUpdateStatusToolDeps {
  jobs: Pick<JobsService, "startTravel" | "arrive" | "complete">;
}

export function createJobUpdateStatusTool(deps: JobUpdateStatusToolDeps): AthenaToolDefinition<UpdateJobStatusInput, JobDTO> {
  return defineTool({
    id: "tradeos.athena.tools.field.update-job-status",
    version: "1.0.0",
    owner: "athena-tools-field",
    description: "Transitions a field job's status (traveling, on_site, completed) on behalf of the assigned technician or a manager.",
    // No permission is required: JobsService's own assertFieldWorker(role)
    // check inside startTravel/arrive/complete, plus transition()'s further
    // requirement that a technician actor be an active assignment on this
    // specific job, is the real authorization boundary for who can move a
    // job through the field workflow - there is no A4 DomainPermission
    // granular enough to express "assigned technician on this job" (see
    // domain/contracts.ts's DomainPermission list). Same posture as
    // athena-tool-sdk/fixtures/recallPreferenceTool.ts's empty permissions
    // list.
    permissions: [],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    // A mis-transitioned job is corrected by a subsequent, real-world
    // transition call (e.g. reopen, or another status update) - there is no
    // separate "undo" service method this tool would call itself.
    compensationPolicy: "compensating_action",
    inputSchema: updateJobStatusInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const transitionInput = {
        orgId: execution.orgId,
        actor: { userId: execution.actor.id, orgId: execution.orgId, role: execution.role },
        reason: input.reason,
      };

      // Any thrown ApiError (job not found, invalid status transition,
      // missing reason, technician not assigned) is an unexpected error here
      // and propagates as-is, following recallPreferenceTool.ts's posture.
      switch (input.status) {
        case "traveling": {
          const job = await deps.jobs.startTravel(input.jobId, transitionInput);
          return successResult<JobDTO>({
            summary: `Job ${job.jobNumber} marked traveling.`,
            data: job,
            telemetry,
            events: [],
          });
        }
        case "on_site": {
          const job = await deps.jobs.arrive(input.jobId, transitionInput);
          return successResult<JobDTO>({
            summary: `Job ${job.jobNumber} marked on site.`,
            data: job,
            telemetry,
            events: [],
          });
        }
        case "completed": {
          const result = await deps.jobs.complete(input.jobId, transitionInput);
          const { athenaEvent, ...job } = result;
          return successResult<JobDTO>({
            summary: `Job ${job.jobNumber} marked completed.`,
            data: job,
            telemetry,
            events: athenaEvent ? [eventRef(athenaEvent.type, athenaEvent.id)] : [],
          });
        }
      }
    },
  });
}
