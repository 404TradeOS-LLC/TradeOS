import { Request, Response } from "express";

const getById = jest.fn();
const update = jest.fn();
const remove = jest.fn();
const record = jest.fn();

const mockPrisma = {
  $transaction: jest.fn(async (callback: (tx: object) => unknown) => callback({})),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

jest.mock("../modules/project-tasks/service", () => ({
  ProjectTasksService: jest.fn().mockImplementation(() => ({
    getById,
    update,
    remove,
  })),
}));

jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({ record })),
}));

import { projectTasksController } from "../backend/controllers/projectTasks.controller";

describe("project task nested route scope regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({}));
  });

  it("rejects updating a task through a different project route", async () => {
    getById.mockResolvedValue({
      id: "task-1",
      projectId: "project-a",
      title: "Call inspector",
      status: "todo",
      assignedTo: null,
      dueDate: null,
      priority: "medium",
    });

    const req = {
      orgId: "org-1",
      params: { id: "project-b", taskId: "task-1" },
      body: { status: "blocked" },
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "dispatcher",
        canonicalRole: "dispatcher",
      },
    } as unknown as Request;
    const res = { json: jest.fn() } as unknown as Response;

    await expect(projectTasksController.update(req, res)).rejects.toMatchObject({ statusCode: 404 });
    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects deleting a task through a different project route", async () => {
    getById.mockResolvedValue({
      id: "task-1",
      projectId: "project-a",
      title: "Call inspector",
      status: "todo",
      assignedTo: null,
      priority: "medium",
    });

    const req = {
      orgId: "org-1",
      params: { id: "project-b", taskId: "task-1" },
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "dispatcher",
        canonicalRole: "dispatcher",
      },
    } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;

    await expect(projectTasksController.remove(req, res)).rejects.toMatchObject({ statusCode: 404 });
    expect(remove).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});