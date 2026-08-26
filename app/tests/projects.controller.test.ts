import { Request, Response } from "express";

const mockPrisma = {
  project: {
    findFirst: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

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
