import { Request, Response } from "express";

const getOrganizationSummary = jest.fn();

jest.mock("../modules/intelligence/financialSummary", () => ({
  FinancialSummaryService: jest.fn().mockImplementation(() => ({ getOrganizationSummary })),
}));

import { intelligenceController } from "../backend/controllers/intelligence.controller";

function response() {
  return { json: jest.fn() } as unknown as Response;
}

describe("intelligenceController.financialSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOrganizationSummary.mockResolvedValue({ generatedAt: "2026-09-14T12:00:00.000Z" });
  });

  it.each(["owner", "admin", "dispatcher", "technician", "estimator", "viewer"])("allows %s to read organization financial intelligence", async (role) => {
    const req = {
      orgId: "org-1",
      query: { orgId: "org-attacker" },
      auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
    } as unknown as Request;
    const res = response();

    await intelligenceController.financialSummary(req, res);

    expect(getOrganizationSummary).toHaveBeenCalledWith("org-1");
    expect(res.json).toHaveBeenCalledWith({ generatedAt: "2026-09-14T12:00:00.000Z" });
  });

  it("requires an authenticated permission context", async () => {
    const req = { orgId: "org-1", query: {} } as unknown as Request;

    await expect(intelligenceController.financialSummary(req, response())).rejects.toMatchObject({ statusCode: 401 });
    expect(getOrganizationSummary).not.toHaveBeenCalled();
  });
});
