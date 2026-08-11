import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createJobContextTool } from "../modules/athena-tools/field/jobContext.tool";
import type { JobContextToolDeps } from "../modules/athena-tools/field/jobContext.tool";
import type { JobDTO } from "../modules/jobs/types";

// A12 Business Tool Rollout, Field Technician domain contract test
// (docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md
// steps 7-8). Fake JobsService dep is a plain jest.fn(), matching the repo
// convention already established by athena-tool-sdk.contracts.test.ts's
// createFakeMemoryService and athena-tools.dispatcher.schedule-job.contracts.
// test.ts's createFakeJobsService - not app/tests/helpers/
// fakeAthenaObservabilityDb.ts, which is unrelated.

function buildFakeJobDTO(overrides: Partial<JobDTO> = {}): JobDTO {
  return {
    id: "job-1",
    jobNumber: "JOB-2026-000001",
    title: "Replace condenser",
    jobType: "repair",
    status: "on_site",
    priority: "medium",
    scheduledStart: "2026-08-12T13:00:00.000Z",
    scheduledEnd: "2026-08-12T15:00:00.000Z",
    archivedAt: null,
    projectId: "project-1",
    customerId: "customer-1",
    serviceAddressId: "address-1",
    description: "Condenser unit is short-cycling.",
    arrivalWindowStart: null,
    arrivalWindowEnd: null,
    estimatedDurationMinutes: 120,
    actualStart: "2026-08-12T13:05:00.000Z",
    actualEnd: null,
    completedAt: null,
    completedById: null,
    readyForInvoiceAt: null,
    createdById: "user-creator",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    project: { id: "project-1", name: "HVAC Overhaul", status: "active" },
    customer: { id: "customer-1", name: "Acme Corp", email: "acme@example.com", phone: null },
    serviceAddress: {
      id: "address-1",
      label: null,
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      country: "US",
    },
    assignments: [],
    equipment: [{ id: "equip-1", name: "Condenser Unit", manufacturer: "Trane", model: "XR14", serialNumber: "SN-1", status: "active" }],
    tasks: [],
    siteVisits: [],
    notes: [{ id: "note-1", body: "Customer reports intermittent shutoff.", authorUserId: "user-1", createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z" }],
    recentActivity: [],
    ...overrides,
  };
}

function createFakeJobsService(job: JobDTO = buildFakeJobDTO()): JobContextToolDeps["jobs"] {
  return {
    getById: jest.fn(async () => Promise.resolve(job)),
  };
}

const validInput = { jobId: "11111111-1111-4111-8111-111111111111" };

describe("athena-tools field: job-context", () => {
  describeAthenaToolContract(createJobContextTool({ jobs: createFakeJobsService() }), {
    validInput,
    invalidInputs: [{ jobId: "not-a-uuid" }, {}],
  });

  it("passes orgId/jobId/actor through to JobsService.getById and returns customer/project/schedule/notes", async () => {
    const job = buildFakeJobDTO();
    const jobs = createFakeJobsService(job);
    const tool = createJobContextTool({ jobs });
    const result = await tool.execute(validInput, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "technician",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
    });

    expect(jobs.getById).toHaveBeenCalledWith("org-1", validInput.jobId, { userId: "user-1", role: "technician" });
    expect(result.success).toBe(true);
    expect(result.data?.customer).toEqual(job.customer);
    expect(result.data?.project).toEqual(job.project);
    expect(result.data?.status).toBe(job.status);
    expect(result.data?.schedule).toEqual({
      scheduledStart: job.scheduledStart,
      scheduledEnd: job.scheduledEnd,
      arrivalWindowStart: job.arrivalWindowStart,
      arrivalWindowEnd: job.arrivalWindowEnd,
      actualStart: job.actualStart,
      actualEnd: job.actualEnd,
    });
    expect(result.data?.notes).toEqual([{ id: "note-1", body: "Customer reports intermittent shutoff.", authorUserId: "user-1", createdAt: "2026-08-10T00:00:00.000Z" }]);
    expect(result.events).toEqual([]);
  });
});
