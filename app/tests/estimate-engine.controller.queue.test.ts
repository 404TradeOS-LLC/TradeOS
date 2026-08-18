import { Request, Response } from "express";

const listOrganizationQueueMock = jest.fn();

jest.mock("../modules/estimate-engine/service", () => ({
  EstimateEngineService: jest.fn().mockImplementation(() => ({
    listOrganizationQueue: listOrganizationQueueMock,
  })),
}));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({ record: jest.fn() })),
}));

import { estimateEngineController } from "../backend/controllers/estimateEngine.controller";

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

describe("estimateEngineController.listOrganizationQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listOrganizationQueueMock.mockResolvedValue(QUEUE_RESULT);
  });

  it.each(["owner", "admin", "dispatcher", "technician", "estimator", "viewer"])(
    "every organization role (%s) may read the queue",
    async (role) => {
      const req = buildRequest(role);
      const res = buildResponse();
      await estimateEngineController.listOrganizationQueue(req, res);
      expect(res.json).toHaveBeenCalledWith(QUEUE_RESULT);
    }
  );

  it("throws 401 without an authenticated request context", async () => {
    const req = { query: {}, orgId: "org-1" } as unknown as Request;
    await expect(estimateEngineController.listOrganizationQueue(req, buildResponse())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("parses a comma-separated status filter and forwards it to the service", async () => {
    const req = buildRequest("owner", { status: "draft,ready" });
    await estimateEngineController.listOrganizationQueue(req, buildResponse());
    expect(listOrganizationQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", statuses: ["draft", "ready"] })
    );
  });

  it("forwards updatedAfter/updatedBefore/limit/cursor", async () => {
    const req = buildRequest("owner", {
      updatedAfter: "2026-08-01T00:00:00.000Z",
      updatedBefore: "2026-08-31T00:00:00.000Z",
      limit: "10",
      cursor: "abc",
    });
    await estimateEngineController.listOrganizationQueue(req, buildResponse());
    expect(listOrganizationQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAfter: "2026-08-01T00:00:00.000Z",
        updatedBefore: "2026-08-31T00:00:00.000Z",
        limit: 10,
        cursor: "abc",
      })
    );
  });

  it("rejects an unrecognized status value with a validation error", async () => {
    const req = buildRequest("owner", { status: "not-a-real-status" });
    await expect(estimateEngineController.listOrganizationQueue(req, buildResponse())).rejects.toThrow();
    expect(listOrganizationQueueMock).not.toHaveBeenCalled();
  });

  it("rejects a limit above the documented maximum of 50", async () => {
    const req = buildRequest("owner", { limit: "51" });
    await expect(estimateEngineController.listOrganizationQueue(req, buildResponse())).rejects.toThrow();
  });

  it("rejects canonical status 'sent': legacyEstimateStatusMap normalizes raw 'sent' to canonical 'ready', so filtering by 'sent' would be indistinguishable from 'ready' and is excluded rather than left ambiguous", async () => {
    const req = buildRequest("owner", { status: "sent" });
    await expect(estimateEngineController.listOrganizationQueue(req, buildResponse())).rejects.toThrow();
    expect(listOrganizationQueueMock).not.toHaveBeenCalled();
  });

  it("still accepts every other canonical estimate status", async () => {
    const req = buildRequest("owner", { status: "draft,ready,viewed,approved,declined,expired,superseded" });
    await estimateEngineController.listOrganizationQueue(req, buildResponse());
    expect(listOrganizationQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ["draft", "ready", "viewed", "approved", "declined", "expired", "superseded"] })
    );
  });
});
