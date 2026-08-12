import { z } from "zod";
import { defineTool, eventRef, successResult } from "../../athena-tool-sdk";
import type { AthenaToolDefinition } from "../../athena-tool-sdk";
import type { JobsService } from "../../jobs/service";
import type { JobDTO } from "../../jobs/types";

// A12 Business Tool Rollout, Dispatcher domain (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Dispatcher").
// Schedules (or reschedules) an existing job by delegating entirely to
// JobsService.schedule() - this tool performs no Prisma access, no
// conflict-detection logic, and no status-transition logic of its own; all
// of that already lives in JobsService (see jobs/service.ts's
// applySchedule()). The service itself publishes the canonical `JobScheduled`
// event (jobs/service.ts's schedule()) and returns its own {type, id} via
// AthenaJobEventRef - this tool only ever wraps that with eventRef(), never
// fabricates a reference if the service's publish attempt failed
// (athenaEvent left undefined, per jobs/service.ts's publishJobEvent()
// non-blocking try/catch posture).

export const scheduleJobInputSchema = z.object({
  jobId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  arrivalWindowStart: z.string().datetime().optional(),
  arrivalWindowEnd: z.string().datetime().optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
});
export type ScheduleJobInput = z.infer<typeof scheduleJobInputSchema>;

export interface ScheduleJobToolDeps {
  jobs: Pick<JobsService, "schedule">;
}

export function createScheduleJobTool(deps: ScheduleJobToolDeps): AthenaToolDefinition<ScheduleJobInput, JobDTO> {
  return defineTool({
    id: "tradeos.athena.tools.dispatcher.schedule-job",
    version: "1.0.0",
    owner: "athena-tools-dispatcher",
    description: "Schedules or reschedules a job to a specific start/end window, surfacing any conflicts JobsService already detects.",
    permissions: ["dispatch.manage"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 10_000,
    idempotency: "optional",
    // Rescheduling or cancelling the job is the real-world compensating
    // action for an incorrect schedule call - there is no separate
    // "unschedule" service method this tool would call itself, matching this
    // rollout's classification for dispatcher.schedule-job.
    compensationPolicy: "compensating_action",
    inputSchema: scheduleJobInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const result = await deps.jobs.schedule(input.jobId, {
        orgId: execution.orgId,
        actor: { userId: execution.actor.id, orgId: execution.orgId, role: execution.role },
        scheduledStart: new Date(input.scheduledStart),
        scheduledEnd: new Date(input.scheduledEnd),
        arrivalWindowStart: input.arrivalWindowStart ? new Date(input.arrivalWindowStart) : undefined,
        arrivalWindowEnd: input.arrivalWindowEnd ? new Date(input.arrivalWindowEnd) : undefined,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
      });
      const { athenaEvent, ...job } = result;

      return successResult<JobDTO>({
        summary: `Scheduled job ${job.jobNumber} for ${job.scheduledStart ?? input.scheduledStart}.`,
        data: job,
        telemetry,
        events: athenaEvent ? [eventRef(athenaEvent.type, athenaEvent.id)] : [],
      });
    },
  });
}
