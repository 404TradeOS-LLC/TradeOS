const mockService = {
  getOrganization: jest.fn(),
  updateOrganization: jest.fn(),
  getPricingUpdateSummary: jest.fn(),
};

const mockAuth = {
  userId: "user-1",
  orgId: "org-1",
  role: "owner",
};

const mockRequireOrgAccess = jest.fn((_req: unknown, orgId: string) => {
  if (orgId !== mockAuth.orgId) {
    throw new Error("Cross-organization access is not allowed");
  }
  return mockAuth;
});

jest.mock("../modules/admin-dashboard/service", () => ({
  AdminDashboardService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock("../backend/requestContext", () => ({
  parsePositiveNumber: jest.fn((value: unknown, fallback: number) => value === undefined ? fallback : Number(value)),
  requireOrgAccess: mockRequireOrgAccess,
}));

import { adminDashboardController } from "../backend/controllers/adminDashboard.controller";

function response() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

function request(orgId: string, body: unknown = {}, query: Record<string, unknown> = {}) {
  return {
    body,
    params: { id: orgId },
    query,
    orgId: mockAuth.orgId,
    auth: mockAuth,
  } as never;
}

describe("Admin dashboard organization tenant boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockService.getOrganization.mockResolvedValue({ id: mockAuth.orgId, name: "Org One", regionCode: null });
    mockService.updateOrganization.mockResolvedValue({ id: mockAuth.orgId, name: "Updated", regionCode: null });
    mockService.getPricingUpdateSummary.mockResolvedValue({ staleMaterialsCount: 0, staleMaterials: [] });
  });

  it("rejects cross-organization reads before querying the service", async () => {
    await expect(
      adminDashboardController.getOrganization(request("org-2"), response() as never)
    ).rejects.toThrow("Cross-organization access is not allowed");

    expect(mockRequireOrgAccess).toHaveBeenCalledWith(expect.anything(), "org-2");
    expect(mockService.getOrganization).not.toHaveBeenCalled();
  });

  it("rejects cross-organization updates before mutating the service", async () => {
    await expect(
      adminDashboardController.updateOrganization(request("org-2", { name: "Hijacked" }), response() as never)
    ).rejects.toThrow("Cross-organization access is not allowed");

    expect(mockRequireOrgAccess).toHaveBeenCalledWith(expect.anything(), "org-2");
    expect(mockService.updateOrganization).not.toHaveBeenCalled();
  });

  it("rejects cross-organization pricing summaries before querying the service", async () => {
    await expect(
      adminDashboardController.pricingUpdateSummary(request("org-2"), response() as never)
    ).rejects.toThrow("Cross-organization access is not allowed");

    expect(mockRequireOrgAccess).toHaveBeenCalledWith(expect.anything(), "org-2");
    expect(mockService.getPricingUpdateSummary).not.toHaveBeenCalled();
  });

  it("uses the authorized path organization for pricing summaries", async () => {
    const res = response();

    await adminDashboardController.pricingUpdateSummary(
      request(mockAuth.orgId, {}, { staleSinceDays: "45" }),
      res as never
    );

    expect(mockRequireOrgAccess).toHaveBeenCalledWith(expect.anything(), mockAuth.orgId);
    expect(mockService.getPricingUpdateSummary).toHaveBeenCalledWith(mockAuth.orgId, 45);
    expect(res.json).toHaveBeenCalledWith({ staleMaterialsCount: 0, staleMaterials: [] });
  });

  it("allows same-organization reads and updates", async () => {
    const readRes = response();
    const updateRes = response();

    await adminDashboardController.getOrganization(request(mockAuth.orgId), readRes as never);
    await adminDashboardController.updateOrganization(
      request(mockAuth.orgId, { name: "Updated" }),
      updateRes as never
    );

    expect(mockService.getOrganization).toHaveBeenCalledWith(mockAuth.orgId);
    expect(mockService.updateOrganization).toHaveBeenCalledWith(mockAuth.orgId, { name: "Updated" });
  });
});
