import { z } from "zod";
import type { ProjectTasksService } from "../../project-tasks/service";
import { projectTaskPriorities } from "../../project-tasks/types";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Office Manager tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Office
// Manager"). Wraps ProjectTasksService.create() - creates an internal,
// reversible follow-up/task, never a sent customer communication, so this
// tool is risk "low" / compensationPolicy "draft_only" per the plan's
// section 5 rationale. confirmationPolicy is "contextual" (UI-facing
// metadata only; A4 does not consult it) since it is an in-domain mutation,
// matching the estimator tools' posture. No canonical A8 event exists for
// project tasks (confirmed by the plan's section 4 table - "none (no
// canonical event registered for tasks)"), so `events` is always [].

export const followUpCreateInputSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  dueDate: z
    .string()
    .min(1)
    .refine((value) => Number.isFinite(Date.parse(value)), { message: "dueDate must be a valid date." })
    .optional(),
  priority: z.enum(projectTaskPriorities).optional(),
  notes: z.string().max(2_000).optional(),
  jobId: z.string().optional(),
});
export type FollowUpCreateInput = z.infer<typeof followUpCreateInputSchema>;

export interface FollowUpCreateData {
  id: string;
  projectId: string;
  jobId: string | null;
  title: string;
  status: string;
  assignedTo: string | null;
  dueDate: string | null;
  priority: string;
  notes: string | null;
}

export interface FollowUpCreateToolDeps {
  projectTasks: Pick<ProjectTasksService, "create">;
}

export function createFollowUpCreateTool(deps: FollowUpCreateToolDeps): AthenaToolDefinition<FollowUpCreateInput, FollowUpCreateData> {
  return defineTool({
    id: "tradeos.athena.tools.office.create-follow-up",
    version: "1.0.0",
    owner: "athena-tools-office",
    description: "Creates a follow-up task on a project, optionally linked to a job and assigned to the acting user.",
    permissions: ["notes.write"],
    risk: "low",
    confirmationPolicy: "contextual",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "draft_only",
    inputSchema: followUpCreateInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (project/job not found) propagates as-is - no
      // specific expected domain case is translated, following
      // recallPreferenceTool.ts's posture.
      const task = await deps.projectTasks.create({
        orgId: execution.orgId,
        projectId: input.projectId,
        jobId: input.jobId,
        title: input.title,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        priority: input.priority,
        notes: input.notes,
        assignedTo: execution.actor.id,
      });

      return successResult<FollowUpCreateData>({
        summary: `Created follow-up task "${task.title}" on project ${task.projectId}.`,
        data: {
          id: task.id,
          projectId: task.projectId,
          jobId: task.jobId,
          title: task.title,
          status: task.status,
          assignedTo: task.assignedTo,
          dueDate: task.dueDate,
          priority: task.priority,
          notes: task.notes,
        },
        telemetry,
        // No canonical event registered for project tasks - see this file's
        // module comment. Never fabricated.
        events: [],
      });
    },
  });
}
