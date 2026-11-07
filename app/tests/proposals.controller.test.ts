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
const acceptOfflineMock = jest.fn();
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
    acceptOffline: acceptOfflineMock,
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
    req.body = { projectId: "11111111-1111-4111-8111-111111111111" };
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

  it("preserves legacy unkeyed proposal creation during client rollout", async () => {
    const req = buildRequest("admin");
    req.body = { projectId: "11111111-1111-4111-8111-111111111111" };
    delete req.headers["idempotency-key"];
    const res = buildResponse();
    createMock.mockResolvedValue({ id: "proposal-legacy" });

    await proposalsController.create(req, res);

    expect(createMock).toHaveBeenCalledWith({
      projectId: "11111111-1111-4111-8111-111111111111",
      orgId: "org-1",
    });
    expect(createWithIdempotencyMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("requires manager document permission before recording offline acceptance", async () => {
    const req = buildRequest("technician");
    req.body = { channel: "in_person", note: "Customer approved the proposal here.", confirmed: true };
    await expect(proposalsController.acceptOffline(req, buildResponse())).rejects.toMatchObject({ statusCode: 403 });
    expect(acceptOfflineMock).not.toHaveBeenCalled();
  });

  it("validates confirmation, channel, and note then records an actor-scoped offline acceptance", async () => {
    const req = buildRequest("owner");
    const res = buildResponse();
    req.body = { channel: "phone", note: "Customer approved the quoted scope over a recorded call.", confirmed: true };
    acceptOfflineMock.mockResolvedValue({ id: "proposal-1", status: "accepted" });
    await proposalsController.acceptOffline(req, res);
    expect(acceptOfflineMock).toHaveBeenCalledWith("proposal-1", {
      channel: "phone", note: "Customer approved the quoted scope over a recorded call.",
    }, "org-1", "user-1");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));

    for (const badBody of [
      { channel: "phone", note: "Customer approved the quoted scope over a recorded call.", confirmed: false },
      { channel: "email", note: "Customer approved the quoted scope over a recorded call.", confirmed: true },
      { channel: "in_person", note: "", confirmed: true },
    ]) {
      req.body = badBody;
      await expect(proposalsController.acceptOffline(req, res)).rejects.toThrow();
    }
    expect(acceptOfflineMock).toHaveBeenCalledTimes(1);
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
