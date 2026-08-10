import { Request, Response } from "express";

const listByOrganization = jest.fn();

jest.mock("../modules/project-tasks/service", () => ({
  ProjectTasksService: jest.fn().mockImplementation(() => ({
    listByOrganization,
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
});
