import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createJobUpdateStatusTool } from "../modules/athena-tools/field/updateJobStatus.tool";
import type { JobUpdateStatusToolDeps } from "../modules/athena-tools/field/updateJobStatus.tool";
import type { JobDTO } from "../modules/jobs/types";
import type { AthenaJobEventRef } from "../modules/jobs/service";
import { getRolePermissions } from "../domain";

function buildFakeJobDTO(overrides: Partial<JobDTO> = {}): JobDTO {
  return {
    id: "job-1",
    jobNumber: "JOB-2026-000001",
    title: "Replace condenser",
    jobType: "repair",
    status: "traveling",
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
    customer: { id: "customer-1", name: "Acme Corp", email: "acme@example.com", phone: "555-0100" },
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

function createFakeJobsService(completedAthenaEvent?: AthenaJobEventRef): JobUpdateStatusToolDeps["jobs"] {
  return {
    startTravel: jest.fn(async (jobId: string) => Promise.resolve(buildFakeJobDTO({ id: jobId, status: "traveling" }))),
    arrive: jest.fn(async (jobId: string) => Promise.resolve(buildFakeJobDTO({ id: jobId, status: "on_site" }))),
    complete: jest.fn(async (jobId: string) =>
      Promise.resolve({
        ...buildFakeJobDTO({ id: jobId, status: "completed" }),
        athenaEvent: completedAthenaEvent,
      })
    ),
  };
}

const validInput = { jobId: "11111111-1111-4111-8111-111111111111", status: "traveling" as const };

describe("athena-tools field: update-job-status", () => {
  describeAthenaToolContract(createJobUpdateStatusTool({ jobs: createFakeJobsService({ type: "WorkCompleted", id: "event-1" }) }), {
    validInput,
    invalidInputs: [
      { ...validInput, status: "bogus_status" },
      { ...validInput, jobId: "not-a-uuid" },
      {},
    ],
  });

  function buildExecutionContext() {
    return {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user" as const, id: "user-1" },
      role: "technician" as const,
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
      permissionContext: {
        organizationScope: "org-1",
        userScope: "user-1",
        roleScope: "technician" as const,
      },
    };
  }

  function expectMinimizedStatusData(data: unknown) {
    expect(data).not.toHaveProperty("customer");
    expect(data).not.toHaveProperty("customerId");
    expect(data).not.toHaveProperty("serviceAddress");
    expect(data).not.toHaveProperty("assignments");
    expect(JSON.stringify(data)).not.toContain("acme@example.com");
    expect(JSON.stringify(data)).not.toContain("555-0100");
  }

  it('calls startTravel and produces no event for status "traveling"', async () => {
    const jobs = createFakeJobsService({ type: "WorkCompleted", id: "event-1" });
    const tool = createJobUpdateStatusTool({ jobs });
    const result = await tool.execute({ jobId: validInput.jobId, status: "traveling" }, {} as never, buildExecutionContext());

    expect(jobs.startTravel).toHaveBeenCalledWith(validInput.jobId, {
      orgId: "org-1",
      actor: { userId: "user-1", orgId: "org-1", role: "technician", permissions: getRolePermissions("technician") },
      reason: undefined,
    });
    expect(jobs.arrive).not.toHaveBeenCalled();
    expect(jobs.complete).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("traveling");
    expectMinimizedStatusData(result.data);
    expect(result.events).toEqual([]);
  });

  it('calls arrive and produces no event for status "on_site"', async () => {
    const jobs = createFakeJobsService({ type: "WorkCompleted", id: "event-1" });
    const tool = createJobUpdateStatusTool({ jobs });
    const result = await tool.execute({ jobId: validInput.jobId, status: "on_site" }, {} as never, buildExecutionContext());

    expect(jobs.arrive).toHaveBeenCalledWith(validInput.jobId, {
      orgId: "org-1",
      actor: { userId: "user-1", orgId: "org-1", role: "technician", permissions: getRolePermissions("technician") },
      reason: undefined,
    });
    expect(jobs.startTravel).not.toHaveBeenCalled();
    expect(jobs.complete).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("on_site");
    expectMinimizedStatusData(result.data);
    expect(result.events).toEqual([]);
  });

  it('calls complete and wraps its athenaEvent with eventRef only for status "completed"', async () => {
    const jobs = createFakeJobsService({ type: "WorkCompleted", id: "event-42" });
    const tool = createJobUpdateStatusTool({ jobs });
    const result = await tool.execute({ jobId: validInput.jobId, status: "completed", reason: "Finished repair" }, {} as never, buildExecutionContext());

    expect(jobs.complete).toHaveBeenCalledWith(validInput.jobId, {
      orgId: "org-1",
      actor: { userId: "user-1", orgId: "org-1", role: "technician", permissions: getRolePermissions("technician") },
      reason: "Finished repair",
    });
    expect(jobs.startTravel).not.toHaveBeenCalled();
    expect(jobs.arrive).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("completed");
    expectMinimizedStatusData(result.data);
    expect(result.events).toEqual([{ type: "WorkCompleted", id: "event-42" }]);
    expect(result.data).not.toHaveProperty("athenaEvent");
  });

  it("never fabricates an event reference when complete()'s athenaEvent is undefined", async () => {
    const jobs = createFakeJobsService(undefined);
    const tool = createJobUpdateStatusTool({ jobs });
    const result = await tool.execute({ jobId: validInput.jobId, status: "completed" }, {} as never, buildExecutionContext());

    expect(result.success).toBe(true);
    expectMinimizedStatusData(result.data);
    expect(result.events).toEqual([]);
  });
});
