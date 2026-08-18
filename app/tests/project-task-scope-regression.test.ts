const mockDb = {
  project: {
    findFirst: jest.fn(),
  },
  job: {
    findFirst: jest.fn(),
  },
  projectTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockDb }));

import { ProjectTasksService } from "../modules/project-tasks/service";

describe("ProjectTasksService relationship scope regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects changing a task to a job outside the task project", async () => {
    mockDb.projectTask.findFirst.mockResolvedValue({
      id: "task-1",
      projectId: "project-1",
      jobId: null,
      title: "Call inspector",
      status: "todo",
      assignedTo: null,
      dueDate: null,
      priority: "medium",
      notes: null,
      completedAt: null,
      createdAt: new Date("2026-08-17T12:00:00.000Z"),
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
    });
    mockDb.job.findFirst.mockResolvedValue(null);

    const service = new ProjectTasksService(mockDb as never);

    await expect(
      service.update("task-1", {
        orgId: "org-1",
        jobId: "11111111-1111-4111-8111-111111111111",
      })
    ).rejects.toThrow("Job 11111111-1111-4111-8111-111111111111 not found");

    expect(mockDb.job.findFirst).toHaveBeenCalledWith({
      where: {
        id: "11111111-1111-4111-8111-111111111111",
        projectId: "project-1",
        archivedAt: null,
        orgId: "org-1",
      },
    });
    expect(mockDb.projectTask.update).not.toHaveBeenCalled();
  });
});