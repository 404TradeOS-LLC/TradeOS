const mockPrisma = {
  project: { findFirst: jest.fn() },
  organizationMembership: { findFirst: jest.fn() },
  codesPermitTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { CodesPermitTasksService } from "../modules/costbook/codes/permitTasks.service";

const ORG = "10000000-0000-0000-0000-000000000001";
const PROJECT = "10000000-0000-0000-0000-000000000081";
const OWNER = "10000000-0000-0000-0000-000000000011";
const TECH = "10000000-0000-0000-0000-000000000014";
const REVISION = new Date("2026-11-09T12:00:00.000Z");

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    orgId: ORG,
    projectId: PROJECT,
    assessmentId: null,
    taskKind: "permit",
    title: "File county sign permit",
    permitNumber: null,
    permitStatus: "not_submitted",
    assigneeId: null,
    dueDate: null,
    evidence: [],
    history: [{ action: "created", by: OWNER, at: "2026-11-09T12:00:00.000Z" }],
    createdAt: new Date("2026-11-09T12:00:00.000Z"),
    updatedAt: REVISION,
    ...overrides,
  };
}

describe("CodesPermitTasksService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT, orgId: ORG });
  });

  it("creates a permit task as not_submitted with a created history entry", async () => {
    mockPrisma.codesPermitTask.create.mockResolvedValue(taskRow());
    const service = new CodesPermitTasksService();
    const task = await service.create({
      orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT,
      taskKind: "permit", title: "File county sign permit",
    });
    expect(task.permitStatus).toBe("not_submitted");
    expect(task.history).toHaveLength(1);
    expect(task.history[0].action).toBe("created");
    expect(task.evidence).toEqual([]);
    expect(mockPrisma.codesPermitTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ permitStatus: "not_submitted" }) }),
    );
  });

  it("refuses task creation by technicians and viewers", async () => {
    const service = new CodesPermitTasksService();
    for (const role of ["technician", "viewer", "dispatcher"]) {
      await expect(
        service.create({ orgId: ORG, role, actorId: TECH, projectId: PROJECT, taskKind: "permit", title: "x" }),
      ).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(mockPrisma.codesPermitTask.create).not.toHaveBeenCalled();
  });

  it("rejects unknown task kinds and unknown projects", async () => {
    const service = new CodesPermitTasksService();
    await expect(
      service.create({ orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT, taskKind: "other" as never, title: "x" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    mockPrisma.project.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT, taskKind: "inspection", title: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires the assignee to be an active member of the org", async () => {
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);
    const service = new CodesPermitTasksService();
    await expect(
      service.create({ orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT, taskKind: "permit", title: "x", assigneeId: "stranger" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("never infers a status: update accepts only the explicit status vocabulary", async () => {
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow());
    const service = new CodesPermitTasksService();
    await expect(
      service.update({ orgId: ORG, role: "owner", actorId: OWNER, taskId: "task-1", expectedUpdatedAt: REVISION, permitStatus: "probably_fine" as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.codesPermitTask.update).not.toHaveBeenCalled();
  });

  it("lets an assigned technician update status and append evidence, but not title or assignee", async () => {
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow({ assigneeId: TECH }));
    mockPrisma.codesPermitTask.update.mockResolvedValue(
      taskRow({ assigneeId: TECH, permitStatus: "inspection_scheduled", updatedAt: new Date("2026-11-09T12:00:01.000Z") }),
    );
    const service = new CodesPermitTasksService();
    const updated = await service.update({
      orgId: ORG, role: "technician", actorId: TECH, taskId: "task-1", expectedUpdatedAt: REVISION,
      permitStatus: "inspection_scheduled",
      addEvidence: [{ label: "Inspection receipt", reference: "INSP-2026-118", addedBy: TECH, addedAt: "2026-11-09T12:00:00.000Z" }],
    });
    expect(updated.permitStatus).toBe("inspection_scheduled");
    const updateData = mockPrisma.codesPermitTask.update.mock.calls[0][0].data;
    expect(updateData.evidence).toHaveLength(1);
    expect(updateData.history).toHaveLength(2);

    await expect(
      service.update({ orgId: ORG, role: "technician", actorId: TECH, taskId: "task-1", expectedUpdatedAt: REVISION, title: "Renamed" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("refuses updates from technicians not assigned to the task", async () => {
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow({ assigneeId: OWNER }));
    const service = new CodesPermitTasksService();
    await expect(
      service.update({ orgId: ORG, role: "technician", actorId: TECH, taskId: "task-1", expectedUpdatedAt: REVISION, permitStatus: "approved" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects evidence without an official reference", async () => {
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow());
    const service = new CodesPermitTasksService();
    await expect(
      service.update({
        orgId: ORG, role: "owner", actorId: OWNER, taskId: "task-1", expectedUpdatedAt: REVISION,
        addEvidence: [{ label: "A photo", reference: "   ", addedBy: OWNER, addedAt: "2026-11-09T12:00:00.000Z" }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects stale revisions with 409", async () => {
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow());
    const service = new CodesPermitTasksService();
    await expect(
      service.update({ orgId: ORG, role: "owner", actorId: OWNER, taskId: "task-1", expectedUpdatedAt: new Date("2026-11-08T00:00:00.000Z"), title: "x" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("submit requires an explicit confirmation step", async () => {
    const service = new CodesPermitTasksService();
    await expect(
      service.submit({ orgId: ORG, role: "owner", actorId: OWNER, taskId: "task-1", expectedUpdatedAt: REVISION, confirm: false }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.codesPermitTask.update).not.toHaveBeenCalled();
  });

  it("submit moves only a not_submitted task to submitted and records history", async () => {
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow());
    mockPrisma.codesPermitTask.update.mockResolvedValue(
      taskRow({ permitStatus: "submitted", updatedAt: new Date("2026-11-09T12:00:01.000Z") }),
    );
    const service = new CodesPermitTasksService();
    const submitted = await service.submit({
      orgId: ORG, role: "owner", actorId: OWNER, taskId: "task-1", expectedUpdatedAt: REVISION, confirm: true,
    });
    expect(submitted.permitStatus).toBe("submitted");
    const updateData = mockPrisma.codesPermitTask.update.mock.calls[0][0].data;
    expect(updateData.permitStatus).toBe("submitted");
    expect(updateData.history).toHaveLength(2);
    expect(updateData.history[1].action).toBe("submitted");
  });

  it("submit refuses an already-submitted task and refuses technicians", async () => {
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow({ permitStatus: "submitted" }));
    const service = new CodesPermitTasksService();
    await expect(
      service.submit({ orgId: ORG, role: "owner", actorId: OWNER, taskId: "task-1", expectedUpdatedAt: REVISION, confirm: true }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.submit({ orgId: ORG, role: "technician", actorId: TECH, taskId: "task-1", expectedUpdatedAt: REVISION, confirm: true }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("scopes technician lists to their assigned tasks and hides unassigned tasks from them", async () => {
    mockPrisma.codesPermitTask.findMany.mockResolvedValue([]);
    const service = new CodesPermitTasksService();
    await service.list(ORG, "technician", TECH, PROJECT);
    expect(mockPrisma.codesPermitTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: ORG, projectId: PROJECT, assigneeId: TECH } }),
    );
    mockPrisma.codesPermitTask.findFirst.mockResolvedValue(taskRow({ assigneeId: OWNER }));
    await expect(service.get(ORG, "technician", TECH, "task-1")).rejects.toMatchObject({ statusCode: 404 });
  });
});
