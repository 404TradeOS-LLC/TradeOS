import { Request, Response } from "express";

const mockPrisma = {
  activityEvent: {
    create: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  siteVisit: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { siteVisitsController } from "../backend/controllers/projects.controller";

function mockReqRes(orgId: string, params: Record<string, string>, body: unknown = {}) {
  const req = {
    orgId,
    params,
    body,
    auth: {
      userId: "user-1",
      orgId,
      role: "owner",
      email: "owner@tradeos.test",
    },
  } as unknown as Request;
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  return { req, res };
}

describe("siteVisitsController.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.siteVisit.create.mockImplementation(({ data }) => Promise.resolve({ id: "visit-1", ...data }));
    mockPrisma.activityEvent.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "activity-1",
        createdAt: new Date("2026-07-05T12:00:00.000Z"),
        ...data,
      })
    );
  });

  it("classifies the project's scope and persists the full IntakeResult against the site visit", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      name: "Smith Residence",
      simpleScope: "Build a 16x20 treated deck with stairs.",
      jobType: null,
      siteAddress: "123 Main St",
      status: "lead",
    });

    const { req, res } = mockReqRes("org-1", { id: "project-1" }, {});
    await siteVisitsController.create(req, res);

    expect(mockPrisma.siteVisit.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.siteVisit.create.mock.calls[0][0].data;

    expect(data.confidenceScore).toBe(data.intakeResultJson.confidenceScore.score);
    expect(Array.isArray(data.aiQuestionsJson)).toBe(true);
    expect(data.aiQuestionsJson.length).toBeGreaterThan(0);
    expect(Array.isArray(data.missingInfoJson)).toBe(true);
    expect(typeof data.missingInfoJson[0]).toBe("string");
    expect(data.missingInfoJson).toEqual(data.intakeResultJson.missingInformation.map((item: { reason: string }) => item.reason));
    expect(data.intakeResultJson).toMatchObject({
      trade: "Deck",
      projectType: "Outdoor Structure",
      category: "Exterior Improvements",
    });
    expect(data.intakeResultJson.missingInformation[0]).toHaveProperty("field");
    expect(data.intakeResultJson.missingInformation[0]).toHaveProperty("importance");
  });

  it("sets the project's jobType from the classified trade and advances status from lead", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      name: "Smith Residence",
      simpleScope: "Build a 16x20 treated deck with stairs.",
      jobType: null,
      siteAddress: "123 Main St",
      status: "lead",
    });

    const { req, res } = mockReqRes("org-1", { id: "project-1" }, {});
    await siteVisitsController.create(req, res);

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { jobType: "Deck", status: "estimating" },
    });
  });

  it("does not overwrite an already-set jobType, but still advances status from lead", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      name: "Smith Residence",
      simpleScope: "Build a 16x20 treated deck with stairs.",
      jobType: "Custom Deck Work",
      siteAddress: "123 Main St",
      status: "lead",
    });

    const { req, res } = mockReqRes("org-1", { id: "project-1" }, {});
    await siteVisitsController.create(req, res);

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "estimating" },
    });
  });

  it("classifies from notes/transcript when the project has no simpleScope", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      name: "Jones Residence",
      simpleScope: null,
      jobType: null,
      siteAddress: null,
      status: "lead",
    });

    const { req, res } = mockReqRes("org-1", { id: "project-1" }, { notes: "Replace a 32 square architectural shingle roof." });
    await siteVisitsController.create(req, res);

    const data = mockPrisma.siteVisit.create.mock.calls[0][0].data;
    expect(data.intakeResultJson.trade).toBe("Roofing");
  });

  it("does not touch project.jobType/status when the scope is unrecognized", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      name: "Doe Residence",
      simpleScope: "Need someone to take a look at some general property work.",
      jobType: null,
      siteAddress: null,
      status: "lead",
    });

    const { req, res } = mockReqRes("org-1", { id: "project-1" }, {});
    await siteVisitsController.create(req, res);

    const data = mockPrisma.siteVisit.create.mock.calls[0][0].data;
    expect(data.intakeResultJson.trade).toBeNull();
    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "estimating" },
    });
  });
});

describe("siteVisitsController.update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.siteVisit.update.mockImplementation(({ data }) => Promise.resolve({ id: "visit-1", ...data }));
  });

  it("re-classifies using merged notes/transcript and persists the refreshed IntakeResult", async () => {
    mockPrisma.siteVisit.findFirst.mockResolvedValue({
      id: "visit-1",
      notes: null,
      transcript: null,
      measurementsJson: null,
      project: { simpleScope: "Kitchen remodel.", jobType: "Kitchen Remodel", siteAddress: null, name: "Lee Residence", orgId: "org-1" },
    });

    const { req, res } = mockReqRes("org-1", { siteVisitId: "visit-1" }, { notes: "Custom cabinets and new countertops confirmed on-site." });
    await siteVisitsController.update(req, res);

    expect(mockPrisma.siteVisit.update).toHaveBeenCalledTimes(1);
    const data = mockPrisma.siteVisit.update.mock.calls[0][0].data;
    expect(data.intakeResultJson.trade).toBe("Kitchen Remodel");
    expect(data.intakeResultJson.missingInformation.map((m: { field: string }) => m.field)).not.toContain("cabinet scope");
    expect(data.confidenceScore).toBe(data.intakeResultJson.confidenceScore.score);
  });

  it("does not mutate the project (update never touches jobType/status)", async () => {
    mockPrisma.siteVisit.findFirst.mockResolvedValue({
      id: "visit-1",
      notes: "Build a 16x20 treated deck with stairs.",
      transcript: null,
      measurementsJson: null,
      project: { simpleScope: null, jobType: null, siteAddress: null, name: "Lee Residence", orgId: "org-1" },
    });

    const { req, res } = mockReqRes("org-1", { siteVisitId: "visit-1" }, {});
    await siteVisitsController.update(req, res);

    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });
});
