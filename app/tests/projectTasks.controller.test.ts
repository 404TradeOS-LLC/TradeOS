import { Request, Response } from "express";

const listAssignableMembers = jest.fn();
const updateAssignedStatus = jest.fn();
const listByOrganization = jest.fn();
const listByAssignedJobs = jest.fn();
const create = jest.fn();
const update = jest.fn();
const remove = jest.fn();
const getById = jest.fn();
const record = jest.fn();
const mockPrisma = {
  $transaction: jest.fn(async (callback: (tx: object) => unknown) => callback({})),
};

jest.mock("../db/client", () => ({
  prisma: mockPrisma,
}));

jest.mock("../modules/project-tasks/service", () => ({
  ProjectTasksService: jest.fn().mockImplementation(() => ({
    listAssignableMembers,
    updateAssignedStatus,
    listByOrganization,
    listByAssignedJobs,
    create,
    update,
    remove,
    getById,
  })),
}));

jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record,
  })),
}));

import { projectTasksController } from "../backend/controllers/projectTasks.controller";

describe("projectTasksController.listByOrganization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({}));
  });

  it("passes org scope and query filters into the task service", async () => {
    listByOrganization.mockResolvedValue([{ id: "task-1" }]);

    const req = {
      orgId: "org-1",
      query: {
        limit: "12",
        includeCompleted: "true",
      },
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "dispatcher",
        canonicalRole: "dispatcher",
      },
    } as unknown as Request;
    const res = { json: jest.fn() } as unknown as Response;

    await projectTasksController.listByOrganization(req, res);

    expect(listByOrganization).toHaveBeenCalledWith({
      orgId: "org-1",
      limit: 12,
      includeCompleted: true,
    });
    expect(res.json).toHaveBeenCalledWith([{ id: "task-1" }]);
  });

  it("preserves includeCompleted=false instead of coercing it to true", async () => {
    listByOrganization.mockResolvedValue([]);

    const req = {
      orgId: "org-1",
      query: {
        includeCompleted: "false",
      },
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "dispatcher",
        canonicalRole: "dispatcher",
      },
    } as unknown as Request;
    const res = { json: jest.fn() } as unknown as Response;

    await projectTasksController.listByOrganization(req, res);

    expect(listByOrganization).toHaveBeenCalledWith({
      orgId: "org-1",
      limit: undefined,
      includeCompleted: false,
    });
  });

  it("records a task activity event after an update", async () => {
    getById.mockResolvedValueOnce({
      id: "task-1",
      projectId: "project-1",
      title: "Call inspector",
      status: "todo",
      assignedTo: null,
      dueDate: null,
      priority: "high",
      notes: null,
      completedAt: null,
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T10:00:00.000Z",
    });
    update.mockResolvedValueOnce({
      id: "task-1",
      projectId: "project-1",
      title: "Call inspector",
      status: "blocked",
      assignedTo: "Alex",
      dueDate: "2026-08-11T00:00:00.000Z",
      priority: "high",
      notes: null,
      completedAt: null,
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T11:00:00.000Z",
    });

    const req = {
      orgId: "org-1",
      params: { id: "project-1", taskId: "task-1" },
      body: {
        status: "blocked",
        assignedTo: "Alex",
        dueDate: "2026-08-11T00:00:00.000Z",
      },
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "dispatcher",
        canonicalRole: "dispatcher",
      },
    } as unknown as Request;
    const res = { json: jest.fn() } as unknown as Response;

    await projectTasksController.update(req, res);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        entityType: "task",
        entityId: "task-1",
        eventType: "task.blocked",
      })
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
describe("project task guarded status saves", () => {
  const revision = "2026-10-26T12:00:00.000Z";
  const request = (role = "dispatcher") => ({ orgId: "org-1", params: { id: "project-1", taskId: "task-1" }, body: { status: "completed", expectedUpdatedAt: revision }, auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role } }) as unknown as Request;
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({}));
    getById.mockResolvedValue({ id: "task-1", projectId: "project-1", status: "blocked" });
    update.mockResolvedValue({ id: "task-1", projectId: "project-1", title: "Inspect flashing", status: "completed" });
  });
  it("passes a validated revision to the scoped transaction and records confirmed changes", async () => {
    await projectTasksController.updateStatus(request(), { json: jest.fn() } as unknown as Response);
    expect(update).toHaveBeenCalledWith("task-1", expect.objectContaining({ orgId: "org-1", status: "completed", expectedUpdatedAt: new Date(revision) }));
    expect(record).toHaveBeenCalledTimes(1);
  });
  it("does not audit or report success for a rejected stale save", async () => {
    update.mockRejectedValueOnce(Object.assign(new Error("Stale revision"), { statusCode: 409 }));
    const res = { json: jest.fn() } as unknown as Response;
    await expect(projectTasksController.updateStatus(request(), res)).rejects.toMatchObject({ statusCode: 409 });
    expect(record).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
  it("preserves the technician authorization boundary before transaction or mutation", async () => {
    await expect(projectTasksController.updateStatus(request("technician"), { json: jest.fn() } as unknown as Response)).rejects.toMatchObject({ statusCode: 403 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
  it("rejects invalid revision timestamps before opening a transaction", async () => {
    const req = request(); req.body.expectedUpdatedAt = "not-a-date";
    await expect(projectTasksController.updateStatus(req, { json: jest.fn() } as unknown as Response)).rejects.toThrow();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});


describe("guarded status route payload", () => {
  it("requires the revision and rejects unrelated task edits before mutation", async () => {
    for (const body of [{ status: "completed" }, { status: "completed", expectedUpdatedAt: "2026-10-26T12:00:00.000Z", title: "Overwrite" }]) {
      jest.clearAllMocks();
      const req = { orgId: "org-1", params: { id: "project-1", taskId: "task-1" }, body, auth: { userId: "user-1", orgId: "org-1", role: "dispatcher", canonicalRole: "dispatcher" } } as unknown as Request;
      await expect(projectTasksController.updateStatus(req, { json: jest.fn() } as unknown as Response)).rejects.toThrow();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    }
  });
});


describe("projectTasksController.listByAssignedJobs", () => {
  beforeEach(() => jest.clearAllMocks());
  const request = (query = {}) => ({ orgId: "org-1", auth: { userId: "tech-1", orgId: "org-1", role: "technician", canonicalRole: "technician" }, query }) as unknown as Request;
  it("derives assignment identity from authenticated context", async () => {
    listByAssignedJobs.mockResolvedValue([]);
    const res = { json: jest.fn() } as unknown as Response;
    await projectTasksController.listByAssignedJobs(request({ limit: "20" }), res);
    expect(listByAssignedJobs).toHaveBeenCalledWith({ orgId: "org-1", userId: "tech-1", limit: 20 });
    expect(res.json).toHaveBeenCalledWith([]);
  });
  it("rejects client supplied identity and invalid limits before querying", async () => {
    for (const query of [{ userId: "other" }, { orgId: "other" }, { limit: "51" }, { limit: "0" }]) {
      await expect(projectTasksController.listByAssignedJobs(request(query), {} as Response)).rejects.toThrow();
    }
    expect(listByAssignedJobs).not.toHaveBeenCalled();
  });
  it("requires authenticated identity", async () => {
    await expect(projectTasksController.listByAssignedJobs({ orgId: "org-1", query: {} } as unknown as Request, {} as Response)).rejects.toMatchObject({ statusCode: 401 });
    expect(listByAssignedJobs).not.toHaveBeenCalled();
  });
});


describe("personal task controller", () => {
  const jobId = "11111111-1111-4111-8111-111111111111", taskId = "22222222-2222-4222-8222-222222222222";
  const req = (role = "technician", body = { status: "completed", expectedUpdatedAt: "2026-10-27T10:00:00Z" }) => ({ orgId: "org-a", auth: { userId: "tech-a", orgId: "org-a", role }, params: { jobId, taskId }, body }) as unknown as Request;
  beforeEach(() => { jest.clearAllMocks(); mockPrisma.$transaction.mockImplementation(async (fn: (tx: object) => unknown) => fn({})); });
  it("uses trusted identity and records activity inside the task transaction", async () => {
    updateAssignedStatus.mockResolvedValue({ id: taskId, title: "Inspect", projectId: "project-a", jobId });
    const res = { json: jest.fn() } as unknown as Response;
    await projectTasksController.updateAssignedStatus(req(), res);
    expect(updateAssignedStatus).toHaveBeenCalledWith({ orgId: "org-a", userId: "tech-a", jobId, taskId, status: "completed", expectedUpdatedAt: new Date("2026-10-27T10:00:00Z") });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "tech-a", entityId: taskId, eventType: "task.completed" }));
  });
  it("rejects viewer role, missing revision and extra mutation fields", async () => {
    await expect(projectTasksController.updateAssignedStatus(req("viewer"), {} as Response)).rejects.toMatchObject({ statusCode: 403 });
    for (const body of [{ status: "completed" }, { status: "completed", expectedUpdatedAt: "2026-10-27T10:00:00Z", assignedUserId: "another" }]) await expect(projectTasksController.updateAssignedStatus(req("technician", body as never), {} as Response)).rejects.toThrow();
    expect(updateAssignedStatus).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled();
  });
  it("does not record success when the source rejects a stale save", async () => {
    updateAssignedStatus.mockRejectedValue({ statusCode: 409 });
    await expect(projectTasksController.updateAssignedStatus(req(), {} as Response)).rejects.toMatchObject({ statusCode: 409 });
    expect(record).not.toHaveBeenCalled();
  });
});


test("legacy office roles retain task writes without new identity administration", async () => {
  const res = { json: jest.fn() } as unknown as Response;
  const req = { orgId: "org-a", auth: { userId: "estimator-a", orgId: "org-a", role: "estimator" }, params: { id: "11111111-1111-4111-8111-111111111111" }, query: {} } as unknown as Request;
  await projectTasksController.listTaskAssignees(req, res);
  expect(res.json).toHaveBeenCalledWith({ canAssign: false, members: [] });
  expect(listAssignableMembers).not.toHaveBeenCalled();
});
