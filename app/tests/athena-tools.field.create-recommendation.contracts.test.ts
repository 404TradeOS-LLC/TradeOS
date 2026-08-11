import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createJobRecommendationTool } from "../modules/athena-tools/field/createRecommendation.tool";
import type { JobRecommendationToolDeps } from "../modules/athena-tools/field/createRecommendation.tool";
import type { JobDTO } from "../modules/jobs/types";

// A12 Business Tool Rollout, Field Technician domain contract test
// (docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md
// steps 7-8). Fake JobsService dep is a plain jest.fn(), matching the repo
// convention already established by athena-tool-sdk.contracts.test.ts's
// createFakeMemoryService - not app/tests/helpers/
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
    description: "",
    arrivalWindowStart: null,
    arrivalWindowEnd: null,
    estimatedDurationMinutes: 120,
    actualStart: null,
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
    equipment: [],
    tasks: [],
    siteVisits: [],
    notes: [],
    recentActivity: [],
    ...overrides,
  };
}

function createFakeJobsService(job: JobDTO = buildFakeJobDTO()): JobRecommendationToolDeps["jobs"] {
  return {
    getById: jest.fn(async () => Promise.resolve(job)),
  };
}

const validInput = { jobId: "11111111-1111-1111-1111-111111111111", observation: "Compressor is drawing higher amperage than spec." };

describe("athena-tools field: create-recommendation", () => {
  describeAthenaToolContract(createJobRecommendationTool({ jobs: createFakeJobsService() }), {
    validInput,
    invalidInputs: [{ ...validInput, observation: "" }, { ...validInput, jobId: "not-a-uuid" }, {}],
  });

  it("composes a deterministic recommendation flagged for human review and never sends anything", async () => {
    const job = buildFakeJobDTO();
    const jobs = createFakeJobsService(job);
    const tool = createJobRecommendationTool({ jobs });
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
    expect(result.data?.jobId).toBe(job.id);
    expect(result.data?.basedOn).toBe(validInput.observation);
    expect(result.data?.requiresCustomerApproval).toBe(true);
    expect(result.data?.suggestedFollowUp).toContain(validInput.observation);
    expect(result.warnings).toEqual([
      {
        code: "athena_recommendation_requires_human_review",
        message: "This recommendation has not been sent or communicated to anyone. It must be reviewed by a human before being shared with the customer.",
      },
    ]);
    expect(result.events).toEqual([]);
  });
});
