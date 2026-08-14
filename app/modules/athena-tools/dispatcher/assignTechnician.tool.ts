import { getRolePermissions } from "../../../domain";
import { z } from "zod";
import { defineTool, eventRef, successResult } from "../../athena-tool-sdk";
import type { AthenaToolDefinition } from "../../athena-tool-sdk";
import { jobAssignmentRoles } from "../../jobs/types";
import type { JobAssignmentDTO } from "../../jobs/types";
import type { JobsService } from "../../jobs/service";

// A12 Business Tool Rollout, Dispatcher domain (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Dispatcher").
// Assigns a technician to a job by delegating entirely to
// JobsService.addAssignment() - conflict detection, active-technician
// validation, and event publishing (`TechnicianAssigned`) all already live
// there. This tool only wraps the service's own AthenaJobEventRef via
// eventRef(), never fabricating one.

export const assignTechnicianInputSchema = z.object({
  jobId: z.string().uuid(),
  technicianId: z.string().uuid(),
  assignmentRole: z.enum(jobAssignmentRoles),
  isLead: z.boolean().optional(),
});
export type AssignTechnicianInput = z.infer<typeof assignTechnicianInputSchema>;

export interface AssignTechnicianToolDeps {
  jobs: Pick<JobsService, "addAssignment">;
}

export function createAssignTechnicianTool(deps: AssignTechnicianToolDeps): AthenaToolDefinition<AssignTechnicianInput, JobAssignmentDTO> {
  return defineTool({
    id: "tradeos.athena.tools.dispatcher.assign-technician",
    version: "1.0.0",
    owner: "athena-tools-dispatcher",
    description: "Assigns a technician to a job, surfacing any schedule conflicts JobsService already detects.",
    permissions: ["dispatch.manage"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 10_000,
    idempotency: "optional",
    // Removing the assignment (JobsService.removeAssignment) is the real
    // compensating action for an incorrect assignment call.
    compensationPolicy: "compensating_action",
    resourceScope: {
      entityType: "job",
      getEntityId(input) {
        return input.jobId;
      },
    },
    inputSchema: assignTechnicianInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const result = await deps.jobs.addAssignment(input.jobId, {
        orgId: execution.orgId,
        actor: {
          userId: execution.actor.id,
          orgId: execution.orgId,
          role: execution.role,
          permissions: getRolePermissions(execution.role),
        },
        userId: input.technicianId,
        assignmentRole: input.assignmentRole,
        isLead: input.isLead,
      });
      const { athenaEvent, ...assignment } = result;

      return successResult<JobAssignmentDTO>({
        summary: `Assigned ${assignment.user.fullName ?? assignment.user.email} to job as ${assignment.assignmentRole}.`,
        data: assignment,
        telemetry,
        events: athenaEvent ? [eventRef(athenaEvent.type, athenaEvent.id)] : [],
      });
    },
  });
}
