import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createScheduleJobTool } from "../modules/athena-tools/dispatcher/scheduleJob.tool";
import type { ScheduleJobToolDeps } from "../modules/athena-tools/dispatcher/scheduleJob.tool";
import type { JobDTO } from "../modules/jobs/types";
import type { AthenaJobEventRef } from "../modules/jobs/service";
import { getRolePermissions } from "../domain";

// A12 Business Tool Rollout, Dispatcher domain contract test (docs/athena/
// roadmap/A12-business-tool-rollout-implementation-plan.md steps 7-8). Fake
// JobsService dep is a plain jest.fn(), matching the repo convention already
// established by athena-tool-sdk.contracts.test.ts's createFakeMemoryService
// - not app/tests/helpers/fakeAthenaObservabilityDb.ts, which is unrelated.

function buildFakeJobDTO(overrides: Partial<JobDTO> = {}): JobDTO {
  return {
    id: "job-1",
    jobNumber: "JOB-2026-000001",
    title: "Replace condenser",
    jobType: "repair",
    status: "scheduled",
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

function createFakeJobsService(athenaEvent?: AthenaJobEventRef): ScheduleJobToolDeps["jobs"] {
  return {
    schedule: jest.fn(async (jobId: string, input: { scheduledStart: Date; scheduledEnd: Date }) =>
      Promise.resolve({
        ...buildFakeJobDTO({
          id: jobId,
          scheduledStart: input.scheduledStart.toISOString(),
          scheduledEnd: input.scheduledEnd.toISOString(),
        }),
        athenaEvent,
      })
    ),
  };
}

const validInput = {
  jobId: "11111111-1111-1111-1111-111111111111",
  scheduledStart: "2026-08-12T13:00:00.000Z",
  scheduledEnd: "2026-08-12T15:00:00.000Z",
};

describe("athena-tools dispatcher: schedule-job", () => {
  describeAthenaToolContract(createScheduleJobTool({ jobs: createFakeJobsService({ type: "JobScheduled", id: "event-1" }) }), {
    validInput,
    invalidInputs: [
      { ...validInput, jobId: "not-a-uuid" },
      { ...validInput, scheduledStart: "not-a-date" },
      {},
    ],
  });

  it("wraps the service's athenaEvent with eventRef when present", async () => {
    const jobs = createFakeJobsService({ type: "JobScheduled", id: "event-42" });
    const tool = createScheduleJobTool({ jobs });
    const result = await tool.execute(validInput, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "owner",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
      permissionContext: {
        organizationScope: "org-1",
        userScope: "user-1",
        roleScope: "owner",
      },
    });
    expect(result.success).toBe(true);
    expect(result.events).toEqual([{ type: "JobScheduled", id: "event-42" }]);
    expect(jobs.schedule).toHaveBeenCalledWith(
      validInput.jobId,
      expect.objectContaining({
        orgId: "org-1",
        actor: { userId: "user-1", orgId: "org-1", role: "owner", permissions: getRolePermissions("owner") },
      })
    );
  });

  it("never fabricates an event reference when the service's athenaEvent is undefined", async () => {
    const jobs = createFakeJobsService(undefined);
    const tool = createScheduleJobTool({ jobs });
    const result = await tool.execute(validInput, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "owner",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
      permissionContext: {
        organizationScope: "org-1",
        userScope: "user-1",
        roleScope: "owner",
      },
    });
    expect(result.success).toBe(true);
    expect(result.events).toEqual([]);
  });
});
