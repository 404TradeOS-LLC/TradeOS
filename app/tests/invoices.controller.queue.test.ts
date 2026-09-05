import { Request, Response } from "express";

const listOrganizationQueueMock = jest.fn();

jest.mock("../modules/invoices/service", () => ({
  InvoicesService: jest.fn().mockImplementation(() => ({
    listOrganizationQueue: listOrganizationQueueMock,
  })),
}));

import { invoicesController } from "../backend/controllers/invoices.controller";

function buildResponse() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
}

function buildRequest(role: string, query: Record<string, unknown> = {}) {
  return {
    query,
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
  } as unknown as Request;
}

const QUEUE_RESULT = { items: [], total: 0, nextCursor: null };

describe("invoicesController.listOrganizationQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listOrganizationQueueMock.mockResolvedValue(QUEUE_RESULT);
  });

  it.each(["owner", "admin", "dispatcher", "technician", "estimator", "viewer"])(
    "every organization role (%s) may read the queue",
    async (role) => {
      const req = buildRequest(role);
      await invoicesController.listOrganizationQueue(req, buildResponse());
      expect(listOrganizationQueueMock).toHaveBeenCalled();
    }
  );

  it("throws 401 without an authenticated request context", async () => {
    const req = { query: {}, orgId: "org-1" } as unknown as Request;
    await expect(invoicesController.listOrganizationQueue(req, buildResponse())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("parses overdue/partiallyPaid/unpaid as strict booleans", async () => {
    const req = buildRequest("owner", { overdue: "true", partiallyPaid: "false", unpaid: "true" });
    await invoicesController.listOrganizationQueue(req, buildResponse());
    expect(listOrganizationQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ overdue: true, partiallyPaid: false, unpaid: true })
    );
  });

  it("rejects an unrecognized status", async () => {
    const req = buildRequest("owner", { status: "bogus" });
    await expect(invoicesController.listOrganizationQueue(req, buildResponse())).rejects.toThrow();
  });

  it("forwards a multi-status filter and never trusts a caller-supplied organization id from the query", async () => {
    const req = buildRequest("owner", { status: "sent,overdue", orgId: "org-attacker" });
    await invoicesController.listOrganizationQueue(req, buildResponse());
    expect(listOrganizationQueueMock).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1", statuses: ["sent", "overdue"] }));
  });
});
