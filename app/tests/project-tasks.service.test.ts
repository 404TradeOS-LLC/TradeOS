const mockPrisma = {
  project: {
    findFirst: jest.fn(),
  },
  job: { findFirst: jest.fn() },
  projectTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  organizationMembership: { findFirst: jest.fn() },
  jobAssignment: { findFirst: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { ProjectTasksService } from "../modules/project-tasks/service";

describe("ProjectTasksService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a project-scoped task", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.projectTask.create.mockResolvedValue({
      id: "task-1",
      projectId: "project-1",
      title: "Order dumpster",
      status: "todo",
      assignedTo: "Alex",
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
      priority: "high",
      notes: "Needed before demo",
      completedAt: null,
      createdAt: new Date("2026-07-03T12:00:00.000Z"),
      updatedAt: new Date("2026-07-03T12:00:00.000Z"),
    });

    const service = new ProjectTasksService();
    const task = await service.create({
      orgId: "org-1",
      projectId: "project-1",
      title: "Order dumpster",
      assignedTo: "Alex",
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
      priority: "high",
      notes: "Needed before demo",
    });

    expect(task.title).toBe("Order dumpster");
    expect(task.priority).toBe("high");
  });

  it("marks a task completed when the status changes to completed", async () => {
    mockPrisma.projectTask.findFirst.mockResolvedValue({
      id: "task-1",
      projectId: "project-1",
      title: "Order dumpster",
      status: "in_progress",
      assignedTo: "Alex",
      dueDate: null,
      priority: "medium",
      notes: null,
      completedAt: null,
      createdAt: new Date("2026-07-03T12:00:00.000Z"),
      updatedAt: new Date("2026-07-03T12:00:00.000Z"),
    });
    mockPrisma.projectTask.update.mockResolvedValue({
      id: "task-1",
      projectId: "project-1",
      title: "Order dumpster",
      status: "completed",
      assignedTo: "Alex",
      dueDate: null,
      priority: "medium",
      notes: null,
      completedAt: new Date("2026-07-04T08:00:00.000Z"),
      createdAt: new Date("2026-07-03T12:00:00.000Z"),
      updatedAt: new Date("2026-07-04T08:00:00.000Z"),
    });

    const service = new ProjectTasksService();
    const task = await service.update("task-1", { orgId: "org-1", status: "completed" });

    expect(task.status).toBe("completed");
    expect(mockPrisma.projectTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", updatedAt: new Date("2026-07-03T12:00:00.000Z"), project: { orgId: "org-1" } },
        data: expect.objectContaining({
          status: "completed",
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it("lists organization task rows with project and customer context", async () => {
    mockPrisma.projectTask.findMany
      .mockResolvedValueOnce([
        {
          id: "task-1",
          projectId: "project-1",
          jobId: null,
          title: "Call inspector",
          status: "blocked",
          assignedTo: "Alex",
          dueDate: new Date("2026-07-10T00:00:00.000Z"),
          priority: "high",
          notes: "Need final walkthrough time",
          completedAt: null,
          createdAt: new Date("2026-07-07T12:00:00.000Z"),
          updatedAt: new Date("2026-07-10T08:00:00.000Z"),
          project: {
            name: "Lobby refresh",
            status: "awarded",
            customer: { name: "Northside Dental" },
          },
          job: { title: "Final paint and punch" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "task-2",
          projectId: "project-2",
          jobId: null,
          title: "Confirm permit pickup",
          status: "completed",
          assignedTo: "Jamie",
          dueDate: new Date("2026-07-12T00:00:00.000Z"),
          priority: "low",
          notes: null,
          completedAt: new Date("2026-07-11T09:00:00.000Z"),
          createdAt: new Date("2026-07-08T12:00:00.000Z"),
          updatedAt: new Date("2026-07-11T09:00:00.000Z"),
          project: {
            name: "Warehouse retrofit",
            status: "active",
            customer: { name: "Acme Fabrication" },
          },
          job: null,
        },
      ]);

    const service = new ProjectTasksService();
    const tasks = await service.listByOrganization({ orgId: "org-1", includeCompleted: true, limit: 12 });

    expect(mockPrisma.projectTask.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          project: { orgId: "org-1" },
          status: { not: "completed" },
        },
      })
    );
    expect(tasks[0]).toMatchObject({
      id: "task-1",
      projectName: "Lobby refresh",
      customerName: "Northside Dental",
      jobTitle: "Final paint and punch",
    });
    expect(tasks[1]).toMatchObject({
      id: "task-2",
      projectName: "Warehouse retrofit",
      customerName: "Acme Fabrication",
    });
  });

  it("applies the limit after priority sorting instead of before fetching", async () => {
    mockPrisma.projectTask.findMany.mockResolvedValue([
      {
        id: "task-late",
        projectId: "project-1",
        jobId: null,
        title: "Blocked urgent follow-up",
        status: "blocked",
        assignedTo: "Taylor",
        dueDate: new Date("2026-07-10T00:00:00.000Z"),
        priority: "high",
        notes: null,
        completedAt: null,
        createdAt: new Date("2026-07-01T12:00:00.000Z"),
        updatedAt: new Date("2026-07-12T12:00:00.000Z"),
        project: {
          name: "Project A",
          status: "active",
          customer: { name: "Alpha" },
        },
        job: null,
      },
      {
        id: "task-early",
        projectId: "project-2",
        jobId: null,
        title: "Upcoming medium task",
        status: "todo",
        assignedTo: null,
        dueDate: new Date("2026-07-20T00:00:00.000Z"),
        priority: "medium",
        notes: null,
        completedAt: null,
        createdAt: new Date("2026-07-01T12:00:00.000Z"),
        updatedAt: new Date("2026-07-11T12:00:00.000Z"),
        project: {
          name: "Project B",
          status: "active",
          customer: { name: "Beta" },
        },
        job: null,
      },
    ]);

    const service = new ProjectTasksService();
    const tasks = await service.listByOrganization({ orgId: "org-1", includeCompleted: true, limit: 1 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("task-late");
  });

  it("applies the default organization task cap when limit is omitted", async () => {
    mockPrisma.projectTask.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => ({
        id: `task-${index + 1}`,
        projectId: `project-${index + 1}`,
        jobId: null,
        title: `Task ${index + 1}`,
        status: "todo",
        assignedTo: null,
        dueDate: new Date(`2026-07-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`),
        priority: "medium",
        notes: null,
        completedAt: null,
        createdAt: new Date("2026-07-01T12:00:00.000Z"),
        updatedAt: new Date(`2026-07-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`),
        project: {
          name: `Project ${index + 1}`,
          status: "active",
          customer: { name: `Customer ${index + 1}` },
        },
        job: null,
      }))
    );

    const service = new ProjectTasksService();
    const tasks = await service.listByOrganization({ orgId: "org-1", includeCompleted: true });

    expect(tasks).toHaveLength(24);
  });

  it("does not let completed tasks crowd out open tasks when includeCompleted=true", async () => {
    mockPrisma.projectTask.findMany
      .mockResolvedValueOnce([
        {
          id: "task-open-1",
          projectId: "project-1",
          jobId: null,
          title: "Open task one",
          status: "todo",
          assignedTo: null,
          dueDate: new Date("2026-07-20T00:00:00.000Z"),
          priority: "medium",
          notes: null,
          completedAt: null,
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
          updatedAt: new Date("2026-07-20T12:00:00.000Z"),
          project: {
            name: "Project Open 1",
            status: "active",
            customer: { name: "Customer Open 1" },
          },
          job: null,
        },
        {
          id: "task-open-2",
          projectId: "project-2",
          jobId: null,
          title: "Open task two",
          status: "blocked",
          assignedTo: "Alex",
          dueDate: new Date("2026-07-21T00:00:00.000Z"),
          priority: "high",
          notes: null,
          completedAt: null,
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
          updatedAt: new Date("2026-07-21T12:00:00.000Z"),
          project: {
            name: "Project Open 2",
            status: "active",
            customer: { name: "Customer Open 2" },
          },
          job: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const service = new ProjectTasksService();
    const tasks = await service.listByOrganization({ orgId: "org-1", includeCompleted: true, limit: 2 });

    expect(mockPrisma.projectTask.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          project: { orgId: "org-1" },
          status: { not: "completed" },
        }),
        take: 2,
      })
    );
    expect(mockPrisma.projectTask.findMany).toHaveBeenCalledTimes(1);
    expect(tasks.map((task) => task.id)).toEqual(["task-open-1", "task-open-2"]);
  });
});

describe("ProjectTask revision preconditions", () => {
  const revision = new Date("2026-10-26T12:00:00.000Z");
  const existing = { id: "task-1", projectId: "project-1", jobId: null, title: "Inspect flashing", status: "todo", assignedTo: null, dueDate: null, priority: "high", notes: null, completedAt: null, createdAt: revision, updatedAt: revision };
  beforeEach(() => { jest.resetAllMocks(); mockPrisma.projectTask.findFirst.mockResolvedValue(existing); });

  it("keeps a legacy display assignee when Job changes without identity assignment", async () => {
    mockPrisma.projectTask.findFirst.mockResolvedValue({
      ...existing, assignedUserId: null, assignedTo: "Legacy crew label",
    });
    mockPrisma.job.findFirst.mockResolvedValue({ id: "job-2", projectId: "project-1", orgId: "org-1", archivedAt: null });
    mockPrisma.projectTask.update.mockImplementation(async ({ data }: { data: object }) => ({
      ...existing, assignedUserId: null, assignedTo: "Legacy crew label", ...data,
    }));
    await new ProjectTasksService().update("task-1", {
      orgId: "org-1", jobId: "job-2", assignedUserId: null,
    });
    expect(mockPrisma.projectTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignedTo: "Legacy crew label" }),
    }));
  });

  it("preserves an unchanged member assignment and label when the Job changes", async () => {
    const assignedUserId = "member-1";
    mockPrisma.projectTask.findFirst.mockResolvedValue({
      ...existing, assignedUserId, assignedTo: "Alex Rivera",
    });
    mockPrisma.job.findFirst.mockResolvedValue({ id: "job-2", projectId: "project-1", orgId: "org-1", archivedAt: null });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      role: "dispatcher", user: { fullName: "Alex Rivera", email: "alex@example.com" },
    });
    mockPrisma.projectTask.update.mockImplementation(async ({ data }: { data: object }) => ({
      ...existing, assignedUserId, assignedTo: "Alex Rivera", ...data,
    }));

    await new ProjectTasksService().update("task-1", {
      orgId: "org-1", jobId: "job-2",
    });

    expect(mockPrisma.projectTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        jobId: "job-2",
        assignedUserId,
        assignedTo: "Alex Rivera",
      }),
    }));
  });

  it("rejects a stale revision before any write", async () => {
    const service = new ProjectTasksService();
    await expect(service.update("task-1", { orgId: "org-1", status: "completed", expectedUpdatedAt: new Date(revision.getTime() - 1) })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.projectTask.update).not.toHaveBeenCalled();
  });
  it("checks the revision atomically and maps a race at the write to conflict", async () => {
    mockPrisma.projectTask.update.mockRejectedValue({ code: "P2025" });
    const service = new ProjectTasksService();
    await expect(service.update("task-1", { orgId: "org-1", status: "completed", expectedUpdatedAt: revision })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.projectTask.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task-1", updatedAt: revision, project: { orgId: "org-1" } } }));
  });
  it("predicates the write on the read revision when the caller omitted expectedUpdatedAt", async () => {
    mockPrisma.projectTask.update.mockImplementation(async ({ data }: { data: object }) => ({ ...existing, ...data }));
    await new ProjectTasksService().update("task-1", { orgId: "org-1", status: "blocked" });
    expect(mockPrisma.projectTask.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task-1", updatedAt: revision, project: { orgId: "org-1" } } }));
  });
  it("maps a race at the write to conflict even when the caller omitted expectedUpdatedAt", async () => {
    mockPrisma.projectTask.update.mockRejectedValue({ code: "P2025" });
    await expect(new ProjectTasksService().update("task-1", { orgId: "org-1", status: "completed" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("advances the revision even when the clock has not advanced", async () => {
    mockPrisma.projectTask.update.mockImplementation(async ({ data }: { data: object }) => ({ ...existing, ...data }));
    const clock = jest.spyOn(Date, "now").mockReturnValue(revision.getTime());
    try {
      const result = await new ProjectTasksService().update("task-1", { orgId: "org-1", status: "blocked", expectedUpdatedAt: revision });
      expect(result.status).toBe("blocked");
      expect(result.updatedAt).toBe("2026-10-26T12:00:00.001Z");
    } finally { clock.mockRestore(); }
  });
  it("keeps missing and cross-tenant records hidden before revision checks", async () => {
    mockPrisma.projectTask.findFirst.mockResolvedValue(null);
    await expect(new ProjectTasksService().update("task-1", { orgId: "org-2", status: "completed", expectedUpdatedAt: revision })).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.projectTask.findFirst).toHaveBeenCalledWith({ where: { id: "task-1", project: { orgId: "org-2" } } });
    expect(mockPrisma.projectTask.update).not.toHaveBeenCalled();
  });
});
