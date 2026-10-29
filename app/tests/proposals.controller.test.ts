import { Request, Response } from "express";

const listByProjectMock = jest.fn();
const getByIdMock = jest.fn();
const previewProjectDraftMock = jest.fn();
const createMock = jest.fn();
const createWithIdempotencyMock = jest.fn();
const updateMock = jest.fn();
const getPdfMock = jest.fn();
const sendMock = jest.fn();
const resendMock = jest.fn();
const markViewedMock = jest.fn();
const acceptMock = jest.fn();
const rejectMock = jest.fn();
const duplicateMock = jest.fn();

jest.mock("../modules/proposals/service", () => ({
  ProposalsService: jest.fn().mockImplementation(() => ({
    listByProject: listByProjectMock,
    getById: getByIdMock,
    previewProjectDraft: previewProjectDraftMock,
    create: createMock,
    createWithIdempotency: createWithIdempotencyMock,
    update: updateMock,
    getPdf: getPdfMock,
    send: sendMock,
    resend: resendMock,
    markViewed: markViewedMock,
    accept: acceptMock,
    reject: rejectMock,
    duplicate: duplicateMock,
  })),
}));

import { proposalsController } from "../backend/controllers/proposals.controller";

function buildResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  } as unknown as Response;
}

function buildRequest(role: string) {
  return {
    params: { id: "proposal-1", projectId: "project-1" },
    query: {},
    body: {},
    headers: { "idempotency-key": "9a8b7c6d-5e4f-4321-8abc-0123456789ab" },
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
  } as unknown as Request;
}

describe("proposalsController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


  it("returns 201 for a new proposal request and 200 for an idempotent replay", async () => {
    const req = buildRequest("admin");
    const res = buildResponse();
    createWithIdempotencyMock
      .mockResolvedValueOnce({ proposal: { id: "proposal-1" }, replayed: false })
      .mockResolvedValueOnce({ proposal: { id: "proposal-1" }, replayed: true });

    await proposalsController.create(req, res);
    expect(createWithIdempotencyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ orgId: "org-1" }),
      "9a8b7c6d-5e4f-4321-8abc-0123456789ab"
    );
    expect(res.setHeader).toHaveBeenLastCalledWith("Idempotency-Replayed", "false");
    expect(res.status).toHaveBeenLastCalledWith(201);

    const replayRes = buildResponse();
    await proposalsController.create(req, replayRes);
    expect(replayRes.setHeader).toHaveBeenCalledWith("Idempotency-Replayed", "true");
    expect(replayRes.status).toHaveBeenCalledWith(200);
  });

  it("rejects technician proposal sends", async () => {
    const req = buildRequest("technician");
    const res = buildResponse();

    await expect(proposalsController.send(req, res)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
