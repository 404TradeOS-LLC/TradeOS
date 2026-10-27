import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createFollowUpCreateTool } from "../modules/athena-tools/office/createFollowUp.tool";
import type { FollowUpCreateToolDeps } from "../modules/athena-tools/office/createFollowUp.tool";
import type { CreateProjectTaskInput, ProjectTaskDTO } from "../modules/project-tasks/types";

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
    invalidInputs: [
      {},
      { projectId: "not-a-uuid", title: "x" },
      { projectId: VALID_PROJECT_ID, title: "" },
      { projectId: VALID_PROJECT_ID, title: "x", priority: "urgent" },
      { projectId: VALID_PROJECT_ID, title: "x", dueDate: "not-a-date" },
      { projectId: VALID_PROJECT_ID, title: "x", dueDate: "2026-02-30" },
    ],
  });

  it("requires CRM write permission for task creation", () => {
    const tool = createFollowUpCreateTool({ projectTasks: createFakeProjectTasks() });
    expect(tool.permissions).toEqual(["crm.write"]);
  });

  it("passes orgId/projectId/title/date-only dueDate/priority/notes/jobId through and assigns the acting user", async () => {
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
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      priority: "high",
      notes: "Client wants a callback",
      assignedTo: "user-42",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ id: "task-1", projectId: VALID_PROJECT_ID, title: "Follow up on estimate", assignedTo: "user-42", dueDate: "2026-09-01T00:00:00.000Z" });
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

// Exercise the registered production tool through the real action boundary.
import { executeAthenaAction } from "../modules/athena-action-engine/engine";
import { createInMemoryAthenaIdempotencyStore } from "../modules/athena-action-engine/idempotency";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { buildMinimalAthenaContext } from "../modules/athena-kernel/context";
import { evaluateAthenaPermission } from "../modules/athena-permissions/policy";
import type { CanonicalRole } from "../domain";

function routineFixture(projectTasks = createFakeProjectTasks()) {
  const tool = createFollowUpCreateTool({ projectTasks });
  const toolRegistry = createAthenaToolRegistry(); toolRegistry.register(tool);
  const idempotencyStore = createInMemoryAthenaIdempotencyStore();
  let attempt = 0;
  async function run(key?: string, title = "Call customer", role: CanonicalRole = "owner", orgId = "org-1") {
    const executionId = `execution-${++attempt}`;
    const actor = { userId: "user-1", orgId, role, permissions: role === "owner" ? ["crm.write"] : [] };
    const decision = await evaluateAthenaPermission({ rawRole: role, orgId, userId: actor.userId, request: { kind: "tool", id: tool.id, risk: tool.risk, requiredPermissions: ["crm.write"] } });
    return executeAthenaAction({ toolRegistry, idempotencyStore }, {
      requestId: executionId, traceId: executionId, executionId, orgId, actor: { type: "user", id: actor.userId }, role,
      toolId: tool.id, toolVersion: tool.version, input: { projectId: VALID_PROJECT_ID, title },
      permissionDecision: decision, idempotencyKey: key, featureFlags: [],
      aiContext: buildMinimalAthenaContext({ requestId: executionId, traceId: executionId, executionId, actor, request: { message: "Create a follow-up", requestSource: "test" } }),
    });
  }
  return { run, projectTasks };
}

describe("routine follow-up execution and recovery", () => {
  it("replays the saved receipt after a lost response without creating another task", async () => {
    const { run, projectTasks } = routineFixture();
    const first = await run("retry-key"); const retry = await run("retry-key");
    expect(first.result.state).toBe("succeeded");
    expect(retry.result).toEqual(first.result);
    expect(projectTasks.create).toHaveBeenCalledTimes(1);
  });
  it("rejects key reuse for changed input without a second mutation", async () => {
    const { run, projectTasks } = routineFixture();
    await run("same-key"); const changed = await run("same-key", "Different commitment");
    expect(changed.result.state).toBe("failed");
    expect(projectTasks.create).toHaveBeenCalledTimes(1);
  });
  it("preserves unkeyed callers and isolates literal keys across tenants", async () => {
    const legacy = routineFixture(); await legacy.run(); await legacy.run();
    expect(legacy.projectTasks.create).toHaveBeenCalledTimes(2);
    const scoped = routineFixture(); await scoped.run("shared", "Call customer", "owner", "org-1"); await scoped.run("shared", "Call customer", "owner", "org-2");
    expect(scoped.projectTasks.create).toHaveBeenCalledTimes(2);
  });
  it("denies field mutation before creating a follow-up", async () => {
    const { run, projectTasks } = routineFixture();
    expect((await run("field-key", "Call customer", "technician")).result.state).toBe("denied");
    expect(projectTasks.create).not.toHaveBeenCalled();
  });
});
