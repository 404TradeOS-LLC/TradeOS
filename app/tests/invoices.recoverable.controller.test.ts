import type { Request, Response } from "express";

const mockCreate = jest.fn();
const mockSession = jest.fn();
jest.mock("../modules/invoices/service", () => ({
  InvoicesService: jest.fn().mockImplementation(() => ({ createWithIdempotency: mockCreate })),
}));
jest.mock("../db/client", () => ({ basePrisma: {} }));
jest.mock("../db/requestSession", () => ({
  runWithDatabaseSession: (...args: unknown[]) => mockSession(...args),
}));

import { invoicesController } from "../backend/controllers/invoices.controller";

function request() {
  return {
    auth: { orgId: "org-1", userId: "user-1", role: "admin" },
    orgId: "org-1",
    headers: { "idempotency-key": "9a8b7c6d-5e4f-4321-8abc-0123456789ab" },
    body: { projectId: "11111111-1111-4111-8111-111111111111" },
  } as unknown as Request;
}

function response() {
  return { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
}

beforeEach(() => jest.resetAllMocks());

test("responds only after the tenant-scoped transaction commits", async () => {
  const req = request();
  const res = response();
  mockCreate.mockResolvedValue({ invoice: { id: "draft-1" }, replayed: false });
  mockSession.mockImplementation(async (_client, auth, operation) => {
    expect(auth).toMatchObject({ orgId: "org-1", userId: "user-1" });
    const result = await operation();
    expect(res.json).not.toHaveBeenCalled();
    return result;
  });
  await invoicesController.createRecoverable(req, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ id: "draft-1" });
});

test("reopens a tenant-scoped transaction for a known concurrent conflict", async () => {
  const req = request();
  const res = response();
  mockSession.mockRejectedValueOnce(Object.assign(new Error("conflict"), { code: "P2034" }));
  mockSession.mockResolvedValueOnce({ invoice: { id: "winner" }, replayed: true });
  await invoicesController.createRecoverable(req, res);
  expect(mockSession).toHaveBeenCalledTimes(2);
  expect(mockSession.mock.calls[1][1]).toBe(mockSession.mock.calls[0][1]);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ id: "winner" });
});

test("missing key cannot open a transaction", async () => {
  const req = request();
  req.headers = {};
  await expect(invoicesController.createRecoverable(req, response())).rejects.toThrow();
  expect(mockSession).not.toHaveBeenCalled();
});
