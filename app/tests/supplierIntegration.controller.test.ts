const mockService = {
  listQueue: jest.fn(),
  enqueue: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
};

jest.mock("../modules/supplier-integration/service", () => ({
  SupplierIntegrationService: jest.fn().mockImplementation(() => mockService),
}));

import { supplierIntegrationController } from "../backend/controllers/supplierIntegration.controller";

function response() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
}

function authedRequest(options: { role?: string; body?: unknown; params?: Record<string, string>; query?: Record<string, string> } = {}) {
  return {
    body: options.body ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    orgId: "org-from-auth",
    auth: {
      userId: "user-1",
      orgId: "org-from-auth",
      role: options.role ?? "admin",
    },
  } as never;
}

describe("supplierIntegrationController Costbook review boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockService.approve.mockResolvedValue({ id: "queue-1", status: "approved" });
    mockService.reject.mockResolvedValue({ id: "queue-1", status: "rejected" });
  });

  it("denies supplier price approval and rejection to dispatcher/read-only Costbook roles", async () => {
    await expect(
      supplierIntegrationController.approve(
        authedRequest({ role: "dispatcher", params: { id: "queue-1" } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");
    await expect(
      supplierIntegrationController.reject(
        authedRequest({ role: "technician", params: { id: "queue-1" } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.approve).not.toHaveBeenCalled();
    expect(mockService.reject).not.toHaveBeenCalled();
  });

  it("allows Costbook writers to approve and reject supplier price updates", async () => {
    const res = response();

    await supplierIntegrationController.approve(authedRequest({ role: "admin", params: { id: "queue-1" } }), res as never);
    await supplierIntegrationController.reject(authedRequest({ role: "owner", params: { id: "queue-1" } }), res as never);

    expect(mockService.approve).toHaveBeenCalledWith("queue-1", "org-from-auth", expect.objectContaining({ role: "admin" }));
    expect(mockService.reject).toHaveBeenCalledWith("queue-1", "org-from-auth", expect.objectContaining({ role: "owner" }));
  });
});
