import { Request, Response } from "express";

const updateMock = jest.fn();

jest.mock("../modules/invoices/service", () => ({
  InvoicesService: jest.fn().mockImplementation(() => ({
    update: updateMock,
  })),
}));

import { invoicesController } from "../backend/controllers/invoices.controller";

function buildResponse() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
}

function buildRequest(role: string, body: Record<string, unknown> = {}) {
  return {
    params: { id: "invoice-1" },
    body,
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
  } as unknown as Request;
}

describe("invoicesController.update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMock.mockResolvedValue({ id: "invoice-1" });
  });

  it("forwards the invoice id, organization scope, and parsed body to the service", async () => {
    const req = buildRequest("admin", {
      lineItems: [{ description: "Revised scope", quantity: 1, unitOfMeasure: "each", unitPrice: 200 }],
      dueDate: "2026-12-01",
    });
    const res = buildResponse();

    await invoicesController.update(req, res);

    expect(updateMock).toHaveBeenCalledWith({
      id: "invoice-1",
      orgId: "org-1",
      actorUserId: "user-1",
      actorRole: "admin",
      lineItems: [{ description: "Revised scope", quantity: 1, unitOfMeasure: "each", unitPrice: 200 }],
      dueDate: "2026-12-01",
    });
    expect(res.json).toHaveBeenCalledWith({ id: "invoice-1" });
  });

  it("accepts a due-date-only edit with no line items", async () => {
    await invoicesController.update(buildRequest("admin", { dueDate: null }), buildResponse());

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "invoice-1", orgId: "org-1", dueDate: null })
    );
  });

  it("rejects a line item with a zero quantity", async () => {
    const req = buildRequest("admin", {
      lineItems: [{ description: "Revised scope", quantity: 0, unitOfMeasure: "each", unitPrice: 200 }],
    });

    await expect(invoicesController.update(req, buildResponse())).rejects.toThrow();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("throws 401 without an authenticated request context", async () => {
    const req = { params: { id: "invoice-1" }, body: {}, orgId: "org-1" } as unknown as Request;

    await expect(invoicesController.update(req, buildResponse())).rejects.toMatchObject({ statusCode: 401 });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
