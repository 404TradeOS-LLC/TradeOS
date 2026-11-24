const mockPrisma = {
  project: { findFirst: jest.fn() },
  job: { findFirst: jest.fn(), findMany: jest.fn() },
  organizationMembership: { findFirst: jest.fn() },
  punchItem: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  projectCloseout: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  contract: { findFirst: jest.fn(), findMany: jest.fn() },
  invoice: { findFirst: jest.fn(), findMany: jest.fn() },
  proposal: { findMany: jest.fn() },
  warrantyRecord: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
};

const mockActivityTimeline = {
  record: jest.fn(),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: {} }));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => mockActivityTimeline),
}));
jest.mock("../modules/documents/branding", () => ({
  getDocumentBrand: jest.fn().mockResolvedValue({
    companyName: "Test Co",
    tagline: "",
    logoUrl: null,
    colors: { primary: "#0f172a", secondary: "#f8fafc", accent: "#c2410c" },
    typography: {
      style: "Professional",
      headingFontFamily: "Arial, sans-serif",
      bodyFontFamily: "Arial, sans-serif",
      accentFontFamily: "monospace",
    },
    websiteUrl: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    licenseNumber: "",
    insuranceSummary: "",
    bondingSummary: "",
    serviceAreas: [],
    certifications: [],
    showPoweredByTradeOS: false,
  }),
}));

import { CloseoutService } from "../modules/closeout/service";

const now = new Date("2026-11-24T12:00:00.000Z");

function punchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "punch-1",
    orgId: "org-1",
    projectId: "project-1",
    jobId: "job-1",
    title: "Touch up paint",
    description: "",
    status: "open",
    priority: "medium",
    assignedUserId: null,
    assignedTo: null,
    dueDate: null,
    resolvedAt: null,
    resolvedById: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function closeoutRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "closeout-1",
    orgId: "org-1",
    projectId: "project-1",
    jobId: "job-1",
    status: "draft",
    notes: null,
    completedAt: null,
    completedById: null,
    handedOffAt: null,
    handedOffById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function warrantyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "warranty-1",
    orgId: "org-1",
    projectId: "project-1",
    jobId: null,
    contractId: "contract-1",
    invoiceId: null,
    title: "Workmanship warranty",
    coverageText: "Two-year workmanship warranty per contract section 4.",
    sourceType: "contract",
    sourceId: null,
    startsAt: null,
    endsAt: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function checklistMocks({ completed = true, signed = true, invoiced = true, accepted = true, openPunch = 0 } = {}) {
  mockPrisma.job.findMany.mockResolvedValue(completed ? [{ id: "job-1" }] : []);
  mockPrisma.contract.findMany.mockResolvedValue(signed ? [{ id: "contract-1" }] : []);
  mockPrisma.invoice.findMany.mockResolvedValue(invoiced ? [{ id: "invoice-1" }] : []);
  mockPrisma.proposal.findMany.mockResolvedValue(accepted ? [{ id: "proposal-1", status: "accepted" }] : [{ id: "proposal-1", status: "sent" }]);
  mockPrisma.punchItem.count.mockResolvedValue(openPunch);
}

describe("CloseoutService punch items", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a punch item for a project job and audits punch_item.created", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.job.findFirst.mockResolvedValue({ id: "job-1", projectId: "project-1", orgId: "org-1" });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      user: { fullName: "Tech One", email: "tech@example.invalid" },
    });
    mockPrisma.punchItem.create.mockResolvedValue(
      punchRow({ assignedUserId: "tech-1", assignedTo: "Tech One" }),
    );

    const service = new CloseoutService();
    const item = await service.createPunchItem({
      orgId: "org-1",
      projectId: "project-1",
      jobId: "job-1",
      title: "Touch up paint",
      assignedUserId: "tech-1",
      createdById: "user-1",
    });

    expect(item.assignedTo).toBe("Tech One");
    expect(mockPrisma.punchItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: "org-1", projectId: "project-1", jobId: "job-1", title: "Touch up paint" }) }),
    );
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", entityType: "punch_item", entityId: "punch-1", eventType: "punch_item.created", actorUserId: "user-1" }),
    );
  });

  it("create for an unknown project returns 404 and creates nothing", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const service = new CloseoutService();
    await expect(
      service.createPunchItem({ orgId: "org-1", projectId: "project-9", title: "Nope", createdById: "user-1" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.punchItem.create).not.toHaveBeenCalled();
    expect(mockActivityTimeline.record).not.toHaveBeenCalled();
  });

  it("create with a job from another project returns 404", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.job.findFirst.mockResolvedValue(null);

    const service = new CloseoutService();
    await expect(
      service.createPunchItem({ orgId: "org-1", projectId: "project-1", jobId: "job-9", title: "Nope", createdById: "user-1" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.punchItem.create).not.toHaveBeenCalled();
  });

  it("create with a non-member assignee returns 400", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

    const service = new CloseoutService();
    await expect(
      service.createPunchItem({ orgId: "org-1", projectId: "project-1", title: "Nope", assignedUserId: "ghost-1", createdById: "user-1" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.punchItem.create).not.toHaveBeenCalled();
  });

  it("update of a verified punch item returns 409", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "verified" }));

    const service = new CloseoutService();
    await expect(service.updatePunchItem("punch-1", { orgId: "org-1", title: "Edited" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.punchItem.update).not.toHaveBeenCalled();
    expect(mockPrisma.punchItem.updateMany).not.toHaveBeenCalled();
    expect(mockActivityTimeline.record).not.toHaveBeenCalled();
  });

  it("update writes conditionally on the row still being unverified and attributes the actor", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "open" }));
    mockPrisma.punchItem.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.punchItem.findFirst.mockResolvedValueOnce(punchRow({ status: "open" }));
    mockPrisma.punchItem.findFirst.mockResolvedValueOnce(punchRow({ title: "Edited" }));

    const service = new CloseoutService();
    const updated = await service.updatePunchItem("punch-1", { orgId: "org-1", title: "Edited", actorUserId: "user-1" });

    expect(updated.title).toBe("Edited");
    expect(mockPrisma.punchItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "punch-1", status: { not: "verified" } } }),
    );
    expect(mockPrisma.punchItem.update).not.toHaveBeenCalled();
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "punch_item.updated", actorUserId: "user-1" }),
    );
  });

  it("update returns 409 when a concurrent verify wins the race (conditional write matches nothing)", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "open" }));
    mockPrisma.punchItem.updateMany.mockResolvedValue({ count: 0 });

    const service = new CloseoutService();
    await expect(service.updatePunchItem("punch-1", { orgId: "org-1", title: "Edited" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockActivityTimeline.record).not.toHaveBeenCalled();
  });

  it("resolve allows the assigned technician and records the resolver", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "in_progress", assignedUserId: "tech-1" }));
    mockPrisma.punchItem.update.mockResolvedValue(punchRow({ status: "resolved", resolvedById: "tech-1", resolvedAt: now }));

    const service = new CloseoutService();
    const resolved = await service.resolvePunchItem("punch-1", "org-1", "tech-1", "technician");

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedById).toBe("tech-1");
    expect(mockPrisma.punchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "resolved", resolvedById: "tech-1" }) }),
    );
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "punch_item.resolved", actorUserId: "tech-1", metadata: expect.objectContaining({ previousStatus: "in_progress", newStatus: "resolved" }) }),
    );
  });

  it("resolve denies an unassigned technician with 403", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ assignedUserId: "tech-1" }));

    const service = new CloseoutService();
    await expect(service.resolvePunchItem("punch-1", "org-1", "tech-2", "technician")).rejects.toMatchObject({ statusCode: 403 });
    expect(mockPrisma.punchItem.update).not.toHaveBeenCalled();
    expect(mockActivityTimeline.record).not.toHaveBeenCalled();
  });

  it("resolve allows a dispatcher and resolve from a terminal status returns 409", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "open" }));
    mockPrisma.punchItem.update.mockResolvedValue(punchRow({ status: "resolved", resolvedById: "user-1", resolvedAt: now }));

    const service = new CloseoutService();
    await expect(service.resolvePunchItem("punch-1", "org-1", "user-1", "dispatcher")).resolves.toMatchObject({ status: "resolved" });

    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "verified" }));
    await expect(service.resolvePunchItem("punch-1", "org-1", "user-1", "owner")).rejects.toMatchObject({ statusCode: 409 });
    expect(mockActivityTimeline.record).toHaveBeenCalledTimes(1);
  });

  it("verify requires resolved status and a manager role", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "resolved" }));
    mockPrisma.punchItem.update.mockResolvedValue(punchRow({ status: "verified" }));

    const service = new CloseoutService();
    await expect(service.verifyPunchItem("punch-1", "org-1", "user-1", "owner")).resolves.toMatchObject({ status: "verified" });
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "punch_item.verified" }));

    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "open" }));
    await expect(service.verifyPunchItem("punch-1", "org-1", "user-1", "owner")).rejects.toMatchObject({ statusCode: 409 });

    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "resolved", assignedUserId: "tech-1" }));
    await expect(service.verifyPunchItem("punch-1", "org-1", "tech-1", "technician")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("reopen clears the resolution and returns the item to open", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "verified", resolvedById: "tech-1", resolvedAt: now }));
    mockPrisma.punchItem.update.mockResolvedValue(punchRow({ status: "open", resolvedById: null, resolvedAt: null }));

    const service = new CloseoutService();
    const reopened = await service.reopenPunchItem("punch-1", "org-1", "user-1", "admin");

    expect(reopened.status).toBe("open");
    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.resolvedById).toBeNull();
    expect(mockPrisma.punchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "open", resolvedAt: null, resolvedById: null }) }),
    );
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "punch_item.reopened", metadata: expect.objectContaining({ previousStatus: "verified", newStatus: "open" }) }),
    );
  });

  it("reopen from open returns 409", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(punchRow({ status: "open" }));

    const service = new CloseoutService();
    await expect(service.reopenPunchItem("punch-1", "org-1", "user-1", "owner")).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.punchItem.update).not.toHaveBeenCalled();
  });

  it("cross-organization punch read returns 404", async () => {
    mockPrisma.punchItem.findFirst.mockResolvedValue(null);

    const service = new CloseoutService();
    await expect(service.getPunchItemById("punch-1", "org-2")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("CloseoutService project closeout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("create requires a completed job and records the triggering job", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(null);
    mockPrisma.job.findMany.mockResolvedValue([{ id: "job-1" }]);
    mockPrisma.projectCloseout.create.mockResolvedValue(closeoutRow());

    const service = new CloseoutService();
    const created = await service.createCloseoutForProject({ orgId: "org-1", projectId: "project-1", actorUserId: "user-1" });

    expect(created.status).toBe("draft");
    expect(mockPrisma.projectCloseout.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ projectId: "project-1", jobId: "job-1", status: "draft" }) }),
    );
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "project_closeout.created" }));
  });

  it("create with no completed job returns 409", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(null);
    mockPrisma.job.findMany.mockResolvedValue([]);

    const service = new CloseoutService();
    await expect(service.createCloseoutForProject({ orgId: "org-1", projectId: "project-1" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.projectCloseout.create).not.toHaveBeenCalled();
  });

  it("create when a closeout already exists returns 409", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow());

    const service = new CloseoutService();
    await expect(service.createCloseoutForProject({ orgId: "org-1", projectId: "project-1" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.projectCloseout.create).not.toHaveBeenCalled();
  });

  it("checklist reports every missing artifact and ready only when all are present", async () => {
    checklistMocks({ signed: false, invoiced: false, accepted: false, openPunch: 2 });

    const service = new CloseoutService();
    const checklist = await service.computeChecklist("project-1", "org-1");

    expect(checklist.ready).toBe(false);
    expect(checklist.missing).toEqual(["signed contract", "final invoice", "accepted proposal", "open punch items (2)"]);
    expect(checklist.acceptedProposal.status).toBe("missing");

    checklistMocks({ accepted: true, openPunch: 0 });
    const ready = await service.computeChecklist("project-1", "org-1");
    expect(ready.ready).toBe(true);
    expect(ready.missing).toEqual([]);
  });

  it("checklist treats a project with no proposal at all as not_applicable, not missing", async () => {
    mockPrisma.job.findMany.mockResolvedValue([{ id: "job-1" }]);
    mockPrisma.contract.findMany.mockResolvedValue([{ id: "contract-1" }]);
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: "invoice-1" }]);
    mockPrisma.proposal.findMany.mockResolvedValue([]);
    mockPrisma.punchItem.count.mockResolvedValue(0);

    const service = new CloseoutService();
    const checklist = await service.computeChecklist("project-1", "org-1");

    expect(checklist.acceptedProposal.status).toBe("not_applicable");
    expect(checklist.ready).toBe(true);
  });

  it("markReady moves draft to ready and audits project_closeout.ready", async () => {
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow({ status: "draft" }));
    checklistMocks();
    mockPrisma.projectCloseout.update.mockResolvedValue(closeoutRow({ status: "ready", completedAt: now, completedById: "user-1" }));

    const service = new CloseoutService();
    const result = await service.markCloseoutReady("project-1", "org-1", "user-1", "owner");

    expect(result.closeout.status).toBe("ready");
    expect(result.closeout.completedAt).toBeTruthy();
    expect(result.checklist.ready).toBe(true);
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "project_closeout.ready", actorUserId: "user-1" }),
    );
  });

  it("markReady with missing artifacts returns 409 naming them", async () => {
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow({ status: "draft" }));
    checklistMocks({ signed: false, openPunch: 1 });

    const service = new CloseoutService();
    await expect(service.markCloseoutReady("project-1", "org-1", "user-1", "owner")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("signed contract"),
    });
    expect(mockPrisma.projectCloseout.update).not.toHaveBeenCalled();
    expect(mockActivityTimeline.record).not.toHaveBeenCalled();
  });

  it("markReady from ready returns 409 and markReady by a technician returns 403", async () => {
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow({ status: "ready" }));

    const service = new CloseoutService();
    await expect(service.markCloseoutReady("project-1", "org-1", "user-1", "owner")).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.markCloseoutReady("project-1", "org-1", "tech-1", "technician")).rejects.toMatchObject({ statusCode: 403 });
    expect(mockPrisma.projectCloseout.update).not.toHaveBeenCalled();
  });

  it("markHandedOff moves ready to handed_off and audits the handoff", async () => {
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow({ status: "ready" }));
    checklistMocks();
    mockPrisma.projectCloseout.update.mockResolvedValue(closeoutRow({ status: "handed_off", handedOffAt: now, handedOffById: "user-1" }));

    const service = new CloseoutService();
    const handedOff = await service.markCloseoutHandedOff("project-1", "org-1", "user-1", "dispatcher");

    expect(handedOff.status).toBe("handed_off");
    expect(handedOff.handedOffAt).toBeTruthy();
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "project_closeout.handed_off", actorUserId: "user-1" }),
    );
  });

  it("markHandedOff rechecks the checklist and refuses a handoff with open punch items", async () => {
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow({ status: "ready" }));
    checklistMocks({ openPunch: 1 });

    const service = new CloseoutService();
    await expect(service.markCloseoutHandedOff("project-1", "org-1", "user-1", "owner")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("open punch items (1)"),
    });
    expect(mockPrisma.projectCloseout.update).not.toHaveBeenCalled();
    expect(mockActivityTimeline.record).not.toHaveBeenCalled();
  });

  it("markHandedOff from draft returns 409", async () => {
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow({ status: "draft" }));

    const service = new CloseoutService();
    await expect(service.markCloseoutHandedOff("project-1", "org-1", "user-1", "owner")).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.projectCloseout.update).not.toHaveBeenCalled();
  });
});

describe("CloseoutService warranty records", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a warranty record quoting the source document and audits it", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.contract.findFirst.mockResolvedValue({ id: "contract-1", projectId: "project-1" });
    mockPrisma.warrantyRecord.create.mockResolvedValue(warrantyRow());

    const service = new CloseoutService();
    const record = await service.createWarrantyRecord({
      orgId: "org-1",
      projectId: "project-1",
      contractId: "contract-1",
      title: "Workmanship warranty",
      coverageText: "Two-year workmanship warranty per contract section 4.",
      sourceType: "contract",
      createdById: "user-1",
    });

    expect(record.coverageText).toBe("Two-year workmanship warranty per contract section 4.");
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "warranty_record.created", metadata: expect.objectContaining({ sourceType: "contract" }) }),
    );
  });

  it("create without coverage text returns 400 and creates nothing", async () => {
    const service = new CloseoutService();
    await expect(
      service.createWarrantyRecord({ orgId: "org-1", projectId: "project-1", title: "Empty", coverageText: "  ", sourceType: "other", createdById: "user-1" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.warrantyRecord.create).not.toHaveBeenCalled();
  });

  it("create with a contract from another project returns 404", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.contract.findFirst.mockResolvedValue(null);

    const service = new CloseoutService();
    await expect(
      service.createWarrantyRecord({ orgId: "org-1", projectId: "project-1", contractId: "contract-9", title: "Nope", coverageText: "Terms.", sourceType: "contract", createdById: "user-1" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.warrantyRecord.create).not.toHaveBeenCalled();
  });

  it("update changes only title, coverage, and dates — never the source", async () => {
    mockPrisma.warrantyRecord.findFirst.mockResolvedValue(warrantyRow());
    mockPrisma.warrantyRecord.update.mockResolvedValue(warrantyRow({ title: "Updated title" }));

    const service = new CloseoutService();
    const updated = await service.updateWarrantyRecord("warranty-1", { orgId: "org-1", title: "Updated title" });

    expect(updated.title).toBe("Updated title");
    const data = mockPrisma.warrantyRecord.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("sourceType");
    expect(data).not.toHaveProperty("contractId");
    expect(data).not.toHaveProperty("sourceId");
  });

  it("update records warranty_record.updated with the actor and the changed fields", async () => {
    mockPrisma.warrantyRecord.findFirst.mockResolvedValue(warrantyRow());
    mockPrisma.warrantyRecord.update.mockResolvedValue(
      warrantyRow({ title: "Updated title", coverageText: "Three-year workmanship warranty per contract section 4." }),
    );

    const service = new CloseoutService();
    await service.updateWarrantyRecord("warranty-1", {
      orgId: "org-1",
      title: "Updated title",
      coverageText: "Three-year workmanship warranty per contract section 4.",
      actorUserId: "user-1",
    });

    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "warranty_record.updated",
        actorUserId: "user-1",
        metadata: expect.objectContaining({ changedFields: ["title", "coverageText"] }),
      }),
    );
  });

  it("delete audits warranty_record.deleted and cross-org delete returns 404", async () => {
    mockPrisma.warrantyRecord.findFirst.mockResolvedValue(warrantyRow());
    mockPrisma.warrantyRecord.delete.mockResolvedValue(warrantyRow());

    const service = new CloseoutService();
    await service.deleteWarrantyRecord("warranty-1", "org-1", "user-1");

    expect(mockPrisma.warrantyRecord.delete).toHaveBeenCalledWith({ where: { id: "warranty-1" } });
    expect(mockActivityTimeline.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "warranty_record.deleted", actorUserId: "user-1" }),
    );

    mockPrisma.warrantyRecord.findFirst.mockResolvedValue(null);
    await expect(service.deleteWarrantyRecord("warranty-1", "org-2", "user-1")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("CloseoutService document data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function documentMocks({ warranties = [] as ReturnType<typeof warrantyRow>[] } = {}) {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      name: "S069 Project",
      siteAddress: "1 Main St, Terre Haute, IN 47802",
      updatedAt: now,
      customer: { id: "customer-1", name: "S069 Customer", email: "customer@example.invalid" },
    });
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(closeoutRow());
    mockPrisma.job.findMany.mockResolvedValue([{ id: "job-1", title: "Install", completedAt: now }]);
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: "invoice-1", invoiceNumber: 1, status: "paid", amount: 100, dueDate: null, paidAt: now }]);
    mockPrisma.contract.findMany.mockResolvedValue([{ id: "contract-1", status: "signed", signedAt: now }]);
    mockPrisma.punchItem.findMany.mockResolvedValue([punchRow({ title: "Touch up paint" })]);
    mockPrisma.warrantyRecord.findMany.mockResolvedValue(warranties);
    mockPrisma.proposal.findMany.mockResolvedValue([{ id: "proposal-1", status: "accepted" }]);
    mockPrisma.punchItem.count.mockResolvedValue(1);
  }

  it("renders the closeout frame from real records and quotes warranty coverage verbatim", async () => {
    documentMocks({ warranties: [warrantyRow()] });

    const service = new CloseoutService();
    const data = await service.getCloseoutDocumentData("project-1", "org-1");

    expect(data.project.name).toBe("S069 Project");
    expect(data.checklist.ready).toBe(false);
    expect(data.checklist.openPunchCount).toBe(1);
    expect(data.closeoutHtml).toContain("S069 Project");
    expect(data.closeoutHtml).toContain("Touch up paint");
    expect(data.hasWarrantyRecords).toBe(true);
    expect(data.warrantyMessage).toBeNull();
    expect(data.warrantyHtml).toHaveLength(1);
    expect(data.warrantyHtml[0]).toContain("Two-year workmanship warranty per contract section 4.");
    expect(data.warrantyHtml[0]).not.toContain("1-year");
  });

  it("renders a null warranty start as Not recorded, never the record's creation date", async () => {
    documentMocks({ warranties: [warrantyRow()] });

    const service = new CloseoutService();
    const data = await service.getCloseoutDocumentData("project-1", "org-1");

    expect(data.warrantyHtml).toHaveLength(1);
    expect(data.warrantyHtml[0]).toContain("Not recorded");
    expect(data.warrantyHtml[0]).not.toContain("2026-11-24");
  });

  it("renders an explicitly supplied warranty start as the effective date", async () => {
    documentMocks({ warranties: [warrantyRow({ startsAt: new Date("2026-11-01T00:00:00.000Z") })] });

    const service = new CloseoutService();
    const data = await service.getCloseoutDocumentData("project-1", "org-1");

    expect(data.warrantyHtml).toHaveLength(1);
    expect(data.warrantyHtml[0]).toContain("2026-11-01");
    // The only "Not recorded" left is the manufacturer-coverage line —
    // the effective date itself renders the supplied start.
    expect(data.warrantyHtml[0].match(/Not recorded/g)).toHaveLength(1);
  });

  it("says explicitly when no warranty was given, with no warranty frame", async () => {
    documentMocks({ warranties: [] });

    const service = new CloseoutService();
    const data = await service.getCloseoutDocumentData("project-1", "org-1");

    expect(data.hasWarrantyRecords).toBe(false);
    expect(data.warrantyHtml).toEqual([]);
    expect(data.warrantyMessage).toBe("No warranty was given for this project — no warranty record exists.");
  });

  it("document data for a project without a closeout returns 404", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      name: "S069 Project",
      siteAddress: null,
      updatedAt: now,
      customer: null,
    });
    mockPrisma.projectCloseout.findFirst.mockResolvedValue(null);

    const service = new CloseoutService();
    await expect(service.getCloseoutDocumentData("project-1", "org-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("serves the closeout packet as one HTML document with warranty pages appended", async () => {
    documentMocks({ warranties: [warrantyRow()] });

    const service = new CloseoutService();
    const document = await service.getCloseoutDocumentHtml("project-1", "org-1");

    expect(document.filename).toBe("closeout-s069-project.html");
    expect(document.html.startsWith("<!doctype html>")).toBe(true);
    expect(document.html).toContain("S069 Project");
    expect(document.html).toContain("Touch up paint");
    expect(document.html).toContain("Two-year workmanship warranty per contract section 4.");
    expect(document.html.match(/<article class="frame-page">/g)).toHaveLength(2);
    expect(document.html).not.toContain("1-year");
  });

  it("serves just the closeout frame when no warranty was given", async () => {
    documentMocks({ warranties: [] });

    const service = new CloseoutService();
    const document = await service.getCloseoutDocumentHtml("project-1", "org-1");

    expect(document.filename).toBe("closeout-s069-project.html");
    expect(document.html.match(/<article class="frame-page">/g)).toHaveLength(1);
    expect(document.html).toContain("S069 Project");
  });
});
