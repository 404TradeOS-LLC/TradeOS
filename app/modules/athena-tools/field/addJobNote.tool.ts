import { z } from "zod";
import type { CrmService } from "../../crm/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Field Technician tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Field
// Technician"). Wraps CrmService.createNote() with entityType "job" - an
// internal, reversible field note, never a sent customer communication.
// risk "low" / compensationPolicy "none" (a note has no compensating
// action; a mistaken note is simply superseded by a later one). No canonical
// A8 event exists for notes (confirmed by the plan's section 4 table -
// "none"), so `events` is always [].

export const jobAddNoteInputSchema = z.object({
  jobId: z.string().uuid(),
  body: z.string().min(1),
});
export type JobAddNoteInput = z.infer<typeof jobAddNoteInputSchema>;

export interface JobAddNoteData {
  id: string;
  jobId: string;
  body: string;
  authorUserId: string | null;
  createdAt: string;
}

export interface JobAddNoteToolDeps {
  crm: Pick<CrmService, "createNote">;
}

export function createJobAddNoteTool(deps: JobAddNoteToolDeps): AthenaToolDefinition<JobAddNoteInput, JobAddNoteData> {
  return defineTool({
    id: "tradeos.athena.tools.field.add-note",
    version: "1.0.0",
    owner: "athena-tools-field",
    description: "Adds a field note to a job, e.g. a technician's on-site observation.",
    permissions: ["notes.write"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: jobAddNoteInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (job not found) is an unexpected error here and
      // propagates as-is, following recallPreferenceTool.ts's posture.
      const note = await deps.crm.createNote(execution.orgId, execution.actor.id, {
        entityType: "job",
        entityId: input.jobId,
        body: input.body,
      });

      return successResult<JobAddNoteData>({
        summary: `Added a note to job ${input.jobId}.`,
        data: {
          id: note.id,
          jobId: input.jobId,
          body: note.body,
          authorUserId: note.authorUserId,
          createdAt: note.createdAt.toISOString(),
        },
        telemetry,
        // No canonical A8 event registered for notes - see this file's
        // module comment. Never fabricated.
        events: [],
      });
    },
  });
}
