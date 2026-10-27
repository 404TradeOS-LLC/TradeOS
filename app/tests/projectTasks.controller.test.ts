import { Request, Response } from "express";

const listByOrganization = jest.fn();
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
    listByOrganization,
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
