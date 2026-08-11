import { z } from "zod";
import type { JobsService } from "../../jobs/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Field Technician tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Field
// Technician"). Read-only: composes a technician-facing job context view
// purely from JobsService.getById()'s own DTO - no new service method, no
// Prisma access, no business logic beyond selecting/reshaping fields already
// present on JobDTO. Contact details are intentionally omitted: the tool only
// exposes fields needed to execute the assigned job.

export const jobContextInputSchema = z.object({
  jobId: z.string().uuid(),
});
export type JobContextInput = z.infer<typeof jobContextInputSchema>;

export interface JobContextData {
  jobId: string;
  jobNumber: string;
  title: string;
  description: string;
  jobType: string;
  status: string;
  priority: string;
  customer: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
    status: string;
  };
  serviceAddress: {
    id: string;
    label: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string | null;
  };
  schedule: {
    scheduledStart: string | null;
    scheduledEnd: string | null;
    arrivalWindowStart: string | null;
    arrivalWindowEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
  };
  notes: { id: string; body: string; authorUserId: string | null; createdAt: string }[];
  equipment: { id: string; name: string; manufacturer: string | null; model: string | null; serialNumber: string | null; status: string }[];
}

export interface JobContextToolDeps {
  jobs: Pick<JobsService, "getById">;
}

export function createJobContextTool(deps: JobContextToolDeps): AthenaToolDefinition<JobContextInput, JobContextData> {
  return defineTool({
    id: "tradeos.athena.tools.field.job-context",
    version: "1.0.0",
    owner: "athena-tools-field",
    description: "Retrieves a minimized technician-facing snapshot of a job: customer name, project, service address, schedule, status, notes, and equipment.",
    permissions: ["crm.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: jobContextInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const job = await deps.jobs.getById(execution.orgId, input.jobId, { userId: execution.actor.id, role: execution.role });

      return successResult<JobContextData>({
        summary: `Job ${job.jobNumber} ("${job.title}") is ${job.status} for ${job.customer.name}.`,
        data: {
          jobId: job.id,
          jobNumber: job.jobNumber,
          title: job.title,
          description: job.description,
          jobType: job.jobType,
          status: job.status,
          priority: job.priority,
          customer: {
            id: job.customer.id,
            name: job.customer.name,
          },
          project: {
            id: job.project.id,
            name: job.project.name,
            status: job.project.status,
          },
          serviceAddress: {
            id: job.serviceAddress.id,
            label: job.serviceAddress.label,
            addressLine1: job.serviceAddress.addressLine1,
            addressLine2: job.serviceAddress.addressLine2,
            city: job.serviceAddress.city,
            state: job.serviceAddress.state,
            postalCode: job.serviceAddress.postalCode,
            country: job.serviceAddress.country,
          },
          schedule: {
            scheduledStart: job.scheduledStart,
            scheduledEnd: job.scheduledEnd,
            arrivalWindowStart: job.arrivalWindowStart,
            arrivalWindowEnd: job.arrivalWindowEnd,
            actualStart: job.actualStart,
            actualEnd: job.actualEnd,
          },
          notes: job.notes.map((note) => ({ id: note.id, body: note.body, authorUserId: note.authorUserId, createdAt: note.createdAt })),
          equipment: job.equipment.map((equipment) => ({
            id: equipment.id,
            name: equipment.name,
            manufacturer: equipment.manufacturer,
            model: equipment.model,
            serialNumber: equipment.serialNumber,
            status: equipment.status,
          })),
        },
        telemetry,
        events: [],
      });
    },
  });
}
