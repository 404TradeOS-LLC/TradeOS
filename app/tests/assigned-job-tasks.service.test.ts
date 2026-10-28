const db = { projectTask: { findMany: jest.fn() } };
jest.mock("../db/client", () => ({ prisma: db }));
import { ProjectTasksService } from "../modules/project-tasks/service";

describe("assigned-job task visibility", () => {
  beforeEach(() => { jest.resetAllMocks(); db.projectTask.findMany.mockResolvedValue([]); });
  it("scopes open tasks to the authenticated user's active assignments and tenant", async () => {
    await new ProjectTasksService(db as never).listByAssignedJobs({ orgId: "org-a", userId: "tech-a" });
    expect(db.projectTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      project: { orgId: "org-a" }, status: { not: "completed" },
      job: { orgId: "org-a", archivedAt: null, status: { notIn: ["completed", "cancelled"] },
        assignments: { some: { orgId: "org-a", userId: "tech-a", removedAt: null, declinedAt: null } } },
    }, take: 50 }));
  });
  it("does not infer personal assignment from free-text assignee names", async () => {
    const date = new Date("2026-10-27T00:00:00Z");
    db.projectTask.findMany.mockResolvedValue([{ id: "task-a", projectId: "project-a", jobId: "job-a", title: "Inspect flashing", status: "blocked", priority: "high", assignedTo: "Another crew member", dueDate: date, notes: null, completedAt: null, createdAt: date, updatedAt: date, project: { name: "Kitchen", status: "active", customer: null }, job: { title: "Roof" } }]);
    const rows = await new ProjectTasksService(db as never).listByAssignedJobs({ orgId: "org-a", userId: "tech-a" });
    expect(rows[0]).toMatchObject({ id: "task-a", jobId: "job-a", jobTitle: "Roof", assignedTo: "Another crew member" });
    expect(JSON.stringify(db.projectTask.findMany.mock.calls[0][0].where)).not.toContain("assignedTo");
  });
  it("bounds reads and rejects absent identity before any query", async () => {
    await new ProjectTasksService(db as never).listByAssignedJobs({ orgId: "org-a", userId: "tech-a", limit: 200 });
    expect(db.projectTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    db.projectTask.findMany.mockClear();
    await expect(new ProjectTasksService(db as never).listByAssignedJobs({ orgId: "org-a", userId: "" })).rejects.toMatchObject({ statusCode: 401 });
    expect(db.projectTask.findMany).not.toHaveBeenCalled();
  });
});
