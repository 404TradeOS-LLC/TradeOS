const db = { $queryRaw: jest.fn(), projectTask: { findFirst: jest.fn(), update: jest.fn() }, organizationMembership: { findFirst: jest.fn() }, jobAssignment: { findFirst: jest.fn() }, project: { findFirst: jest.fn() } };
jest.mock("../db/client", () => ({ prisma: db }));
import { ProjectTasksService } from "../modules/project-tasks/service";
const revision = new Date("2026-10-27T10:00:00Z");
const task = { id: "task-a", projectId: "project-a", jobId: "job-a", assignedUserId: "tech-a", title: "Inspect trim", assignedTo: "Display only", status: "todo", priority: "medium", notes: null, dueDate: null, completedAt: null, createdAt: revision, updatedAt: revision };
const input = { orgId: "org-a", userId: "tech-a", jobId: "job-a", taskId: "task-a", status: "completed" as const, expectedUpdatedAt: revision };
describe("personal field task status", () => {
  beforeEach(() => { jest.resetAllMocks(); db.$queryRaw.mockResolvedValue([{ id: "job-a" }]); db.projectTask.findFirst.mockResolvedValue(task); db.projectTask.update.mockResolvedValue({ ...task, status: "completed", updatedAt: new Date(revision.getTime() + 1) }); });
  it("locks active work and atomically checks personal identity, tenant and revision", async () => {
    const result = await new ProjectTasksService(db as never).updateAssignedStatus(input);
    expect(result.status).toBe("completed");
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.projectTask.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task-a", jobId: "job-a", assignedUserId: "tech-a", project: { orgId: "org-a" }, updatedAt: revision }, data: { status: "completed", completedAt: expect.any(Date), updatedAt: expect.any(Date) } }));
  });
  it("does not update tasks outside active assignments or personal ownership", async () => {
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(new ProjectTasksService(db as never).updateAssignedStatus(input)).rejects.toMatchObject({ statusCode: 404 });
    db.projectTask.findFirst.mockResolvedValueOnce(null);
    await expect(new ProjectTasksService(db as never).updateAssignedStatus(input)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.projectTask.update).not.toHaveBeenCalled();
  });
  it("rejects stale and racing saves instead of overwriting", async () => {
    await expect(new ProjectTasksService(db as never).updateAssignedStatus({ ...input, expectedUpdatedAt: new Date(0) })).rejects.toMatchObject({ statusCode: 409 });
    db.projectTask.update.mockRejectedValueOnce({ code: "P2025" });
    await expect(new ProjectTasksService(db as never).updateAssignedStatus(input)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("preserves office status updates when a historical assignee is no longer active", async () => {
    const result = await new ProjectTasksService(db as never).update("task-a", { orgId: "org-a", status: "completed" });
    expect(result.status).toBe("completed"); expect(db.organizationMembership.findFirst).not.toHaveBeenCalled();
  });
  it("validates active tenant membership and job assignment before assigning a technician", async () => {
    db.project.findFirst.mockResolvedValue({ id: "project-a" });
    db.organizationMembership.findFirst.mockResolvedValue(null);
    await expect(new ProjectTasksService(db as never).create({ orgId: "org-a", projectId: "project-a", assignedUserId: "outsider", title: "Inspect" })).rejects.toMatchObject({ statusCode: 400 });
    db.organizationMembership.findFirst.mockResolvedValue({ role: "technician" });
    await expect(new ProjectTasksService(db as never).create({ orgId: "org-a", projectId: "project-a", assignedUserId: "tech-a", title: "Inspect" })).rejects.toMatchObject({ statusCode: 400 });
  });
});
