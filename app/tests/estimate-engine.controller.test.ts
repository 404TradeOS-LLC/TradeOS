import { Request, Response } from "express";

const createMock = jest.fn();
const getByIdMock = jest.fn();
const listByProjectMock = jest.fn();
const addLineItemMock = jest.fn();
const removeLineItemMock = jest.fn();
const setPricingModeMock = jest.fn();
const finalizeMock = jest.fn();
const duplicateMock = jest.fn();
const recordMock = jest.fn();

jest.mock("../modules/estimate-engine/service", () => ({
  EstimateEngineService: jest.fn().mockImplementation(() => ({
    create: createMock,
    getById: getByIdMock,
    listByProject: listByProjectMock,
    addLineItem: addLineItemMock,
    removeLineItem: removeLineItemMock,
    setPricingMode: setPricingModeMock,
    finalize: finalizeMock,
    duplicateFromVersion: duplicateMock,
  })),
}));

jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record: recordMock,
  })),
}));

import { estimateEngineController } from "../backend/controllers/estimateEngine.controller";

function buildResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;

  return res;
}

function buildRequest(role: string, body: unknown = {}) {
  return {
    body,
    params: { id: "estimate-1", projectId: "project-1", lineItemId: "line-1" },
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
  } as unknown as Request;
}

describe("estimateEngineController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects technician estimate creation", async () => {
    const req = buildRequest("technician", { projectId: "550e8400-e29b-41d4-a716-446655440000" });
    const res = buildResponse();

    await expect(estimateEngineController.create(req, res)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(createMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("records an activity event when an estimate is created", async () => {
    const estimate = {
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 2,
      status: "draft",
      overheadPct: 0,
      profitPct: 0,
      targetMarginPct: null,
      subtotalCost: 0,
      totalPrice: 0,
    };
    createMock.mockResolvedValue(estimate);
    recordMock.mockResolvedValue({});

    const req = buildRequest("dispatcher", { projectId: "550e8400-e29b-41d4-a716-446655440000" });
    const res = buildResponse();

    await estimateEngineController.create(req, res);

    expect(createMock).toHaveBeenCalled();
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        entityType: "estimate",
        entityId: "estimate-1",
        eventType: "estimate.created",
        actorUserId: "user-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(estimate);
  });

  it("passes through the optional Athena event reference when estimate publication succeeds", async () => {
    const estimate = {
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 2,
      status: "draft",
      overheadPct: 0,
      profitPct: 0,
      targetMarginPct: null,
      subtotalCost: 0,
      totalPrice: 0,
      athenaEvent: { id: "event-1", type: "EstimateStarted" },
    };
    createMock.mockResolvedValue(estimate);
    recordMock.mockResolvedValue({});

    const req = buildRequest("dispatcher", { projectId: "550e8400-e29b-41d4-a716-446655440000" });
    const res = buildResponse();

    await estimateEngineController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(estimate);
  });

  it("records the line item's actual estimate id, not the URL's, when the two differ", async () => {
    // Regression test: the service resolves the line item's real estimate independently of
    // the route param, so a mismatched/stale URL id must not produce a misleading audit entry.
    removeLineItemMock.mockResolvedValue({ estimateId: "estimate-2" });
    recordMock.mockResolvedValue({});

    const req = buildRequest("dispatcher");
    const res = buildResponse();

    await estimateEngineController.removeLineItem(req, res);

    expect(removeLineItemMock).toHaveBeenCalledWith("line-1", "org-1");
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "estimate-2",
        eventType: "estimate.line_item_removed",
        metadata: { lineItemId: "line-1" },
      })
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
