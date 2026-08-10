import { Request, Response } from "express";

const listByOrganization = jest.fn();
const create = jest.fn();
const update = jest.fn();
const remove = jest.fn();
const getById = jest.fn();
const record = jest.fn();

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
      params: { taskId: "task-1" },
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
  });
});
