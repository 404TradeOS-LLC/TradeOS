import { Request, Response } from "express";

// DES-7 (d): a failed manual record-payment attempt is recorded as a
// Payment Failure through POST /api/v1/invoices/:id/payment-failures.

const recordPaymentFailureMock = jest.fn();

jest.mock("../modules/invoices/service", () => ({
  InvoicesService: jest.fn().mockImplementation(() => ({
    recordPaymentFailure: recordPaymentFailureMock,
  })),
}));

import { invoicesController } from "../backend/controllers/invoices.controller";

function buildResponse() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() } as unknown as Response;
}

function buildRequest(role: string, body: Record<string, unknown> = {}) {
  return {
    params: { id: "invoice-1" },
    body,
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
  } as unknown as Request;
}

describe("invoicesController.recordPaymentFailure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordPaymentFailureMock.mockResolvedValue(undefined);
  });

  it("forwards the invoice id, organization scope, reason, and actor to the service", async () => {
    const req = buildRequest("admin", { reason: "Invoice must be sent before a payment can be recorded" });
    const res = buildResponse();

    await invoicesController.recordPaymentFailure(req, res);

    expect(recordPaymentFailureMock).toHaveBeenCalledWith(
      "invoice-1",
      "org-1",
      "Invoice must be sent before a payment can be recorded",
      "user-1",
      "admin"
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("rejects an empty failure reason", async () => {
    const req = buildRequest("admin", { reason: "" });
    const res = buildResponse();

    await expect(invoicesController.recordPaymentFailure(req, res)).rejects.toThrow();
    expect(recordPaymentFailureMock).not.toHaveBeenCalled();
  });
});
