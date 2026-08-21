const mockService = {
  listQueue: jest.fn(),
  listQueuePage: jest.fn(),
  enqueue: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
};

jest.mock("../modules/supplier-integration/service", () => ({
  SupplierIntegrationService: jest.fn().mockImplementation(() => mockService),
}));

import { supplierIntegrationController } from "../backend/controllers/supplierIntegration.controller";

const queueId = "33333333-3333-4333-8333-333333333333";

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
    mockService.listQueuePage.mockResolvedValue({ items: [{ id: queueId }], total: 1, nextCursor: "next-token" });
    mockService.approve.mockResolvedValue({ id: queueId, status: "approved" });
    mockService.reject.mockResolvedValue({ id: queueId, status: "rejected" });
  });

  it("forwards the complete paginated supplier review query and response envelope", async () => {
    const res = response();
    const supplierId = "11111111-1111-4111-8111-111111111111";
    const materialId = "22222222-2222-4222-8222-222222222222";

    await supplierIntegrationController.listQueue(
      authedRequest({
        role: "technician",
        query: {
          limit: "50",
          cursor: "cursor-token",
          q: " wire ",
          sort: "status",
          order: "asc",
          status: "pending",
          supplierId,
          materialId,
        },
      }),
      res as never
    );

    expect(mockService.listQueuePage).toHaveBeenCalledWith("org-from-auth", {
      limit: 50,
      cursor: "cursor-token",
      q: "wire",
      sort: "status",
      order: "asc",
      filters: { status: "pending", supplierId, materialId },
    });
    expect(res.json).toHaveBeenCalledWith({ items: [{ id: queueId }], total: 1, nextCursor: "next-token" });
  });

  it("rejects malformed supplier review catalog queries before calling the service", async () => {
    await expect(
      supplierIntegrationController.listQueue(
        authedRequest({ role: "technician", query: { order: "sideways" } }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.listQueuePage).not.toHaveBeenCalled();
  });

  it("propagates supplier review service errors to the shared error-handler boundary", async () => {
    mockService.listQueuePage.mockRejectedValueOnce(new Error("queue unavailable"));

    await expect(
      supplierIntegrationController.listQueue(authedRequest({ role: "technician" }), response() as never)
    ).rejects.toThrow("queue unavailable");
  });

  it("denies supplier price approval and rejection to dispatcher/read-only Costbook roles", async () => {
    await expect(
      supplierIntegrationController.approve(
        authedRequest({ role: "dispatcher", params: { id: queueId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");
    await expect(
      supplierIntegrationController.reject(
        authedRequest({ role: "technician", params: { id: queueId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.approve).not.toHaveBeenCalled();
    expect(mockService.reject).not.toHaveBeenCalled();
  });

  it("allows Costbook managers to approve and reject supplier price updates", async () => {
    const res = response();

    await supplierIntegrationController.approve(authedRequest({ role: "admin", params: { id: queueId } }), res as never);
    await supplierIntegrationController.reject(authedRequest({ role: "owner", params: { id: queueId } }), res as never);

    expect(mockService.approve).toHaveBeenCalledWith(queueId, "org-from-auth", expect.objectContaining({ role: "admin" }));
    expect(mockService.reject).toHaveBeenCalledWith(queueId, "org-from-auth", expect.objectContaining({ role: "owner" }));
  });
});
