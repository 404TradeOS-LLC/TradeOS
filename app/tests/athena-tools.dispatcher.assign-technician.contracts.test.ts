import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createAssignTechnicianTool } from "../modules/athena-tools/dispatcher/assignTechnician.tool";
import type { AssignTechnicianToolDeps } from "../modules/athena-tools/dispatcher/assignTechnician.tool";
import type { JobAssignmentDTO } from "../modules/jobs/types";
import type { AthenaJobEventRef } from "../modules/jobs/service";
import { getRolePermissions } from "../domain";

// A12 Business Tool Rollout, Dispatcher domain contract test. Fake
// JobsService dep is a plain jest.fn(), matching the repo convention already
// established by athena-tool-sdk.contracts.test.ts's createFakeMemoryService.

function buildFakeAssignmentDTO(overrides: Partial<JobAssignmentDTO> = {}): JobAssignmentDTO {
  return {
    id: "assignment-1",
    jobId: "job-1",
    userId: "tech-1",
    assignmentRole: "technician",
    isLead: false,
    assignedAt: "2026-08-11T00:00:00.000Z",
    assignedById: "user-1",
    acceptedAt: null,
    declinedAt: null,
    removedAt: null,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    user: { id: "tech-1", fullName: "Jamie Tech", email: "jamie@example.com" },
    ...overrides,
  };
}

function createFakeJobsService(athenaEvent?: AthenaJobEventRef): AssignTechnicianToolDeps["jobs"] {
  return {
    addAssignment: jest.fn(async (jobId: string, input: { userId: string; assignmentRole: JobAssignmentDTO["assignmentRole"]; isLead?: boolean }) =>
      Promise.resolve({
        ...buildFakeAssignmentDTO({
          jobId,
          userId: input.userId,
          assignmentRole: input.assignmentRole,
          isLead: input.isLead ?? false,
        }),
        athenaEvent,
      })
    ),
  };
}

const validInput = {
  jobId: "11111111-1111-1111-1111-111111111111",
  technicianId: "22222222-2222-2222-2222-222222222222",
  assignmentRole: "technician" as const,
};

describe("athena-tools dispatcher: assign-technician", () => {
  describeAthenaToolContract(createAssignTechnicianTool({ jobs: createFakeJobsService({ type: "TechnicianAssigned", id: "event-1" }) }), {
    validInput,
    invalidInputs: [
      { ...validInput, technicianId: "not-a-uuid" },
      { ...validInput, assignmentRole: "supervisor" },
      {},
    ],
  });

  it("wraps the service's athenaEvent with eventRef when present", async () => {
    const jobs = createFakeJobsService({ type: "TechnicianAssigned", id: "event-77" });
    const tool = createAssignTechnicianTool({ jobs });
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
    expect(result.events).toEqual([{ type: "TechnicianAssigned", id: "event-77" }]);
    expect(jobs.addAssignment).toHaveBeenCalledWith(
      validInput.jobId,
      expect.objectContaining({
        orgId: "org-1",
        actor: { userId: "user-1", orgId: "org-1", role: "owner", permissions: getRolePermissions("owner") },
        userId: validInput.technicianId,
        assignmentRole: "technician",
      })
    );
  });

  it("never fabricates an event reference when the service's athenaEvent is undefined", async () => {
    const jobs = createFakeJobsService(undefined);
    const tool = createAssignTechnicianTool({ jobs });
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
