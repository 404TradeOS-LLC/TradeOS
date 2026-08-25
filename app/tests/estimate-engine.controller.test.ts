import { Request, Response } from "express";

const createMock = jest.fn();
const getByIdMock = jest.fn();
const listByProjectMock = jest.fn();
const addLineItemMock = jest.fn();
const updateLineItemMock = jest.fn();
const updateEstimateMock = jest.fn();
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
    updateLineItem: updateLineItemMock,
    updateEstimate: updateEstimateMock,
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

  it("passes the nested estimate id so the service can reject mismatched line-item URLs", async () => {
    removeLineItemMock.mockResolvedValue({ estimateId: "estimate-1" });
    recordMock.mockResolvedValue({});

    const req = buildRequest("dispatcher");
    const res = buildResponse();

    await estimateEngineController.removeLineItem(req, res);

    expect(removeLineItemMock).toHaveBeenCalledWith("line-1", "org-1", "estimate-1");
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "estimate-1",
        eventType: "estimate.line_item_removed",
        metadata: { lineItemId: "line-1" },
      })
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("accepts a custom contractor line without a Costbook id", async () => {
    addLineItemMock.mockResolvedValue({ id: "line-1" });
    recordMock.mockResolvedValue({});
    const req = buildRequest("dispatcher", {
      description: "Debris handling",
      quantity: 2,
      unitOfMeasure: "load",
      unitCost: 175,
      section: "Demolition",
      costType: "disposal",
      taxable: false,
    });
    const res = buildResponse();

    await estimateEngineController.addLineItem(req, res);

    expect(addLineItemMock).toHaveBeenCalledWith(expect.objectContaining({
      estimateId: "estimate-1",
      description: "Debris handling",
      unitCost: 175,
      costType: "disposal",
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a line item through the authenticated nested route", async () => {
    updateLineItemMock.mockResolvedValue({ id: "line-1", quantity: 3 });
    recordMock.mockResolvedValue({});
    const req = buildRequest("dispatcher", { quantity: 3, unitCost: 125, taxable: true });
    const res = buildResponse();

    await estimateEngineController.updateLineItem(req, res);

    expect(updateLineItemMock).toHaveBeenCalledWith(expect.objectContaining({
      estimateId: "estimate-1",
      lineItemId: "line-1",
      orgId: "org-1",
      quantity: 3,
      unitCost: 125,
      taxable: true,
    }));
    expect(res.json).toHaveBeenCalledWith({ id: "line-1", quantity: 3 });
  });

  it("rejects an empty line-item update without calling the service", async () => {
    const req = buildRequest("dispatcher", {});
    await expect(estimateEngineController.updateLineItem(req, buildResponse())).rejects.toThrow(/At least one line item field is required/);
    expect(updateLineItemMock).not.toHaveBeenCalled();
  });

  it("updates estimate overhead and tax through the authenticated route", async () => {
    updateEstimateMock.mockResolvedValue({ id: "estimate-1", taxPct: 7 });
    recordMock.mockResolvedValue({});
    const req = buildRequest("dispatcher", { overheadPct: 10, taxPct: 7 });
    const res = buildResponse();

    await estimateEngineController.updateEstimate(req, res);

    expect(updateEstimateMock).toHaveBeenCalledWith({ estimateId: "estimate-1", orgId: "org-1", overheadPct: 10, taxPct: 7 });
    expect(res.json).toHaveBeenCalledWith({ id: "estimate-1", taxPct: 7 });
  });

  it("rejects a pricing mode without its matching percentage", async () => {
    const req = buildRequest("dispatcher", { mode: "markup" });
    await expect(estimateEngineController.setPricingMode(req, buildResponse())).rejects.toThrow(/markupPct is required/);
    expect(setPricingModeMock).not.toHaveBeenCalled();
  });
});
