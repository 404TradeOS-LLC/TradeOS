import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createFollowUpCreateTool } from "../modules/athena-tools/office/createFollowUp.tool";
import type { FollowUpCreateToolDeps } from "../modules/athena-tools/office/createFollowUp.tool";
import type { CreateProjectTaskInput, ProjectTaskDTO } from "../modules/project-tasks/types";

// A12 Office Manager contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).
// Follows app/tests/athena-tool-sdk.contracts.test.ts's pattern: a
// hand-rolled jest.fn()-based fake service matching this tool's own
// Pick<ProjectTasksService, "create"> deps shape, never
// tests/helpers/fakeAthenaObservabilityDb.ts (unrelated suite).

const VALID_PROJECT_ID = "55555555-5555-4555-8555-555555555555";

function createFakeProjectTasks(): FollowUpCreateToolDeps["projectTasks"] {
  return {
    create: jest.fn(
      async (input: CreateProjectTaskInput): Promise<ProjectTaskDTO> => ({
        id: "task-1",
        projectId: input.projectId,
        jobId: input.jobId ?? null,
        title: input.title,
        status: "todo",
        assignedTo: input.assignedTo ?? null,
        dueDate: input.dueDate ? input.dueDate.toISOString() : null,
        priority: input.priority ?? "medium",
        notes: input.notes ?? null,
        completedAt: null,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
      })
    ),
  };
}

describe("athena-tools office: create-follow-up", () => {
  describeAthenaToolContract(createFollowUpCreateTool({ projectTasks: createFakeProjectTasks() }), {
    validInput: { projectId: VALID_PROJECT_ID, title: "Call customer about permit", priority: "high" as const },
    invalidInputs: [{}, { projectId: "not-a-uuid", title: "x" }, { projectId: VALID_PROJECT_ID, title: "" }, { projectId: VALID_PROJECT_ID, title: "x", priority: "urgent" }],
  });

  it("passes orgId/projectId/title/dueDate/priority/notes/jobId through and assigns the acting user", async () => {
    const projectTasks = createFakeProjectTasks();
    const tool = createFollowUpCreateTool({ projectTasks });
    const result = await tool.execute(
      { projectId: VALID_PROJECT_ID, title: "Follow up on estimate", dueDate: "2026-09-01", priority: "high", notes: "Client wants a callback", jobId: "job-1" },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-42" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(projectTasks.create).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: VALID_PROJECT_ID,
      jobId: "job-1",
      title: "Follow up on estimate",
      dueDate: new Date("2026-09-01"),
      priority: "high",
      notes: "Client wants a callback",
      assignedTo: "user-42",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ id: "task-1", projectId: VALID_PROJECT_ID, title: "Follow up on estimate", assignedTo: "user-42" });
    expect(result.events).toEqual([]);
  });

  it("omits dueDate when not supplied, rather than fabricating one", async () => {
    const projectTasks = createFakeProjectTasks();
    const tool = createFollowUpCreateTool({ projectTasks });
    await tool.execute(
      { projectId: VALID_PROJECT_ID, title: "Quick task" },
      {} as never,
      { executionId: "exec-2", requestId: "req-2", traceId: "trace-2", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(projectTasks.create).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: VALID_PROJECT_ID,
      jobId: undefined,
      title: "Quick task",
      dueDate: undefined,
      priority: undefined,
      notes: undefined,
      assignedTo: "user-1",
    });
  });
});
