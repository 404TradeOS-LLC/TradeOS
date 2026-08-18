import { Request, Response } from "express";

const listOrganizationQueueMock = jest.fn();

jest.mock("../modules/athena-events/transactionalPublishers", () => ({
  TransactionalProposalsService: jest.fn().mockImplementation(() => ({
    listOrganizationQueue: listOrganizationQueueMock,
  })),
}));

import { proposalsController } from "../backend/controllers/proposals.controller";

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

describe("proposalsController.listOrganizationQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listOrganizationQueueMock.mockResolvedValue(QUEUE_RESULT);
  });

  it.each(["owner", "admin", "dispatcher", "technician", "estimator", "viewer"])(
    "every organization role (%s) may read the queue",
    async (role) => {
      const req = buildRequest(role);
      await proposalsController.listOrganizationQueue(req, buildResponse());
      expect(listOrganizationQueueMock).toHaveBeenCalled();
    }
  );

  it("parses sent/viewed/unsigned as strict booleans and staleBefore as a date", async () => {
    const req = buildRequest("owner", { sent: "true", viewed: "false", unsigned: "true", staleBefore: "2026-08-01T00:00:00.000Z" });
    await proposalsController.listOrganizationQueue(req, buildResponse());
    expect(listOrganizationQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ sent: true, viewed: false, unsigned: true, staleBefore: "2026-08-01T00:00:00.000Z" })
    );
  });

  it("rejects a non-strict boolean value (e.g. '1') for sent", async () => {
    const req = buildRequest("owner", { sent: "1" });
    await expect(proposalsController.listOrganizationQueue(req, buildResponse())).rejects.toThrow();
  });

  it("rejects an unrecognized status", async () => {
    const req = buildRequest("owner", { status: "bogus" });
    await expect(proposalsController.listOrganizationQueue(req, buildResponse())).rejects.toThrow();
  });

  it("forwards a multi-status filter", async () => {
    const req = buildRequest("owner", { status: "draft,sent" });
    await proposalsController.listOrganizationQueue(req, buildResponse());
    expect(listOrganizationQueueMock).toHaveBeenCalledWith(expect.objectContaining({ statuses: ["draft", "sent"] }));
  });
});
