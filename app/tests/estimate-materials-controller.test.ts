import type { Request, Response } from "express";
import { ApiError } from "../backend/middleware/errorHandler";

const getEstimateMock = jest.fn();
const projectFindMock = jest.fn();
const pdfMock = jest.fn();

jest.mock("../modules/athena-events/transactionalPublishers", () => ({
  TransactionalEstimateEngineService: jest.fn().mockImplementation(() => ({ getById: getEstimateMock })),
}));
jest.mock("../db/client", () => ({
  prisma: { project: { findFirst: projectFindMock } },
}));
jest.mock("../modules/estimate-engine/materials-pdf", () => ({ renderEstimateMaterialsPdf: pdfMock }));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({ record: jest.fn() })),
}));

import { estimateEngineController } from "../backend/controllers/estimateEngine.controller";

function request(role = "owner"): Request {
  return {
    params: { id: "estimate-1" },
    query: {},
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
  } as unknown as Request;
}
function response(): Response {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
  } as unknown as Response;
}

describe("estimate materials PDF controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEstimateMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      lineItems: [
        { description: "Concrete", quantity: 47, unitOfMeasure: "bag", section: "Footer", costType: "material", assemblyId: null, unitCost: 4.49, lineCost: 211.03 },
        { description: "Labor", quantity: 9, unitOfMeasure: "hour", section: "Footer", costType: "labor", assemblyId: null, unitCost: 40, lineCost: 360 },
      ],
    });
    projectFindMock.mockResolvedValue({ name: "Sign job", siteAddress: "123 Main St", customer: { name: "John" } });
    pdfMock.mockResolvedValue(Buffer.from("%PDF-fake"));
  });

  it("requires an authenticated session before reading the estimate or generating a PDF", async () => {
    const req = request();
    delete (req as Request & { auth?: unknown }).auth;
    await expect(estimateEngineController.getMaterialsPdf(req, response())).rejects.toMatchObject({ statusCode: 401 });
    expect(getEstimateMock).not.toHaveBeenCalled();
    expect(pdfMock).not.toHaveBeenCalled();
  });

  it("keeps existing crm.read access for technicians without granting broader writes", async () => {
    await estimateEngineController.getMaterialsPdf(request("technician"), response());
    expect(getEstimateMock).toHaveBeenCalledWith("estimate-1", "org-1");
    expect(pdfMock).toHaveBeenCalledTimes(1);
  });

  it("uses authenticated organization scoping, transmits only material fields, and downloads as a PDF", async () => {
    const res = response();
    await estimateEngineController.getMaterialsPdf(request(), res);
    expect(getEstimateMock).toHaveBeenCalledWith("estimate-1", "org-1");
    expect(projectFindMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "project-1", orgId: "org-1" } }));
    const input = pdfMock.mock.calls[0][0];
    expect(input.items).toEqual([{ description: "Concrete", quantity: 47, unitOfMeasure: "bag", section: "Footer" }]);
    expect(JSON.stringify(input)).not.toMatch(/unitCost|lineCost|211\\.03|360|totalPrice/);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining("attachment; filename="));
    expect(res.send).toHaveBeenCalledWith(Buffer.from("%PDF-fake"));
  });

  it("does not fetch project details or render a PDF for an inaccessible foreign estimate", async () => {
    getEstimateMock.mockRejectedValue(new ApiError(404, "Estimate not found"));
    await expect(estimateEngineController.getMaterialsPdf(request(), response())).rejects.toMatchObject({ statusCode: 404 });
    expect(projectFindMock).not.toHaveBeenCalled();
    expect(pdfMock).not.toHaveBeenCalled();
  });

  it("refuses to issue a misleading empty list when only labor is present", async () => {
    getEstimateMock.mockResolvedValue({ projectId: "project-1", version: 1, lineItems: [{ costType: "labor", assemblyId: null }] });
    await expect(estimateEngineController.getMaterialsPdf(request(), response())).rejects.toMatchObject({ statusCode: 409 });
    expect(pdfMock).not.toHaveBeenCalled();
  });
});
