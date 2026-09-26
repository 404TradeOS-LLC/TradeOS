import { Request, Response } from "express";

const mockPrisma = {
  project: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
const recordActivityMock = jest.fn();
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({ record: recordActivityMock })),
}));

import { projectsController } from "../backend/controllers/projects.controller";

function mockReqRes(orgId: string, id: string) {
  const req = {
    orgId,
    params: { id },
    auth: { userId: "user-1", orgId, role: "dispatcher", canonicalRole: "dispatcher" },
  } as unknown as Request;
  const res = { json: jest.fn() } as unknown as Response;
  return { req, res };
}

describe("projectsController.getById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes Decimal fields on nested estimates to numbers", async () => {
    // Prisma serializes Decimal fields (e.g. totalPrice) as Decimal-like
    // objects whose JSON form is a string, not a plain number — a raw
    // passthrough of the Prisma row would break any consumer calling
    // `.toFixed()` on them. This guards the fix in projects.controller.ts.
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      customer: null,
      estimates: [
        {
          id: "estimate-1",
          orgId: "org-1",
          projectId: "project-1",
          version: 1,
          status: "draft",
          overheadPct: "10.00",
          profitPct: "20.00",
          targetMarginPct: null,
          subtotalCost: "100.00",
          totalPrice: "132.00",
        },
      ],
    });

    const { req, res } = mockReqRes("org-1", "project-1");
    await projectsController.getById(req, res);

    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(typeof payload.estimates[0].totalPrice).toBe("number");
    expect(payload.estimates[0].totalPrice).toBe(132);
    expect(typeof payload.estimates[0].subtotalCost).toBe("number");
  });
});

describe("projectsController customer association and scope persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists selected customer, site address and plain-language scope in the authenticated organization", async () => {
    const body = {
      name: "Deck repair",
      customerId: "22222222-2222-4222-8222-222222222222",
      siteAddress: "12 Main St",
      simpleScope: "Replace rotted deck boards",
    };
    mockPrisma.project.create.mockResolvedValue({ id: "project-1", orgId: "org-1", ...body, status: "lead" });
    recordActivityMock.mockResolvedValue({});
    const { req, res } = mockReqRes("org-1", "project-1");
    req.body = body;
    res.status = jest.fn().mockReturnValue(res);

    await projectsController.create(req, res);

    expect(mockPrisma.project.create).toHaveBeenCalledWith({ data: { ...body, orgId: "org-1" } });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ customerId: body.customerId, siteAddress: body.siteAddress, simpleScope: body.simpleScope }));
  });

  it("scopes project update and persists changed site address and scope", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.project.update.mockResolvedValue({ id: "project-1", orgId: "org-1", siteAddress: "14 Main St", simpleScope: "Add stairs" });
    const { req, res } = mockReqRes("org-1", "project-1");
    req.body = { siteAddress: "14 Main St", simpleScope: "Add stairs" };

    await projectsController.update(req, res);

    expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({ where: { id: "project-1", orgId: "org-1" } });
    expect(mockPrisma.project.update).toHaveBeenCalledWith({ where: { id: "project-1" }, data: req.body });
  });

  it("denies foreign-organization project updates without mutating", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes("org-1", "foreign-project");
    req.body = { simpleScope: "Foreign work" };

    await expect(projectsController.update(req, res)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });
});
