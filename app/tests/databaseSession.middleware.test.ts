import express from "express";
import { EventEmitter } from "node:events";
import request from "supertest";

const mockPrisma = { $transaction: jest.fn() };
const transaction = { $queryRaw: jest.fn().mockResolvedValue([]) };

jest.mock("../db/client", () => ({ basePrisma: mockPrisma }));

import { getRequestDatabaseClient } from "../db/requestSession";
import type { AuthContext } from "../backend/auth/context";
import { AuthedRequest } from "../backend/middleware/auth";
import { databaseSession } from "../backend/middleware/databaseSession";
import { ApiError, errorHandler } from "../backend/middleware/errorHandler";

function buildApp(handler: express.RequestHandler) {
  const app = express();
  app.get(
    "/transaction",
    (req, _res, next) => {
      (req as AuthedRequest).auth = { userId: "user-1", orgId: "org-1", role: "owner" } as AuthContext;
      next();
    },
    databaseSession,
    handler
  );
  app.use(errorHandler);
  return app;
}

function trackTransactionOutcome() {
  let outcome: "committed" | "rolled back" | undefined;
  let settle!: () => void;
  const settled = new Promise<void>((resolve) => { settle = resolve; });

  mockPrisma.$transaction.mockImplementation(async (operation: (tx: typeof transaction) => Promise<unknown>) => {
    try {
      const result = await operation(transaction);
      outcome = "committed";
      return result;
    } catch (error) {
      outcome = "rolled back";
      throw error;
    } finally {
      settle();
    }
  });

  return { settled, getOutcome: () => outcome };
}

describe("databaseSession middleware transaction lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rolls back the request transaction when a handler returns an error response", async () => {
    const tracked = trackTransactionOutcome();
    const response = await request(buildApp((_req, _res, next) => next(new ApiError(409, "Proposal changed"))))
      .get("/transaction");

    expect(response.status).toBe(409);
    await tracked.settled;
    expect(tracked.getOutcome()).toBe("rolled back");
  });

  it("commits the request transaction after a successful response", async () => {
    const tracked = trackTransactionOutcome();
    const response = await request(buildApp((_req, res) => { res.status(200).json({ ok: true }); }))
      .get("/transaction");

    expect(response.status).toBe(200);
    await tracked.settled;
    expect(tracked.getOutcome()).toBe("committed");
  });

  it("keeps the handler inside the request transaction", async () => {
    const tracked = trackTransactionOutcome();
    let handlerTransaction: unknown;
    await request(buildApp((_req, res) => {
      handlerTransaction = getRequestDatabaseClient();
      res.status(200).end();
    })).get("/transaction");

    await tracked.settled;
    expect(handlerTransaction).toBe(transaction);
    expect(tracked.getOutcome()).toBe("committed");
  });

  it("rolls back when the client closes before the response finishes", async () => {
    const tracked = trackTransactionOutcome();
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      headersSent: false,
      destroyed: true,
      writableFinished: false,
    }) as unknown as express.Response;
    const req = { auth: { userId: "user-1", orgId: "org-1", role: "owner" } } as AuthedRequest;
    const next = jest.fn();

    databaseSession(req, response, next);
    await new Promise<void>((resolve) => setImmediate(resolve));
    response.emit("close");
    await tracked.settled;

    expect(tracked.getOutcome()).toBe("rolled back");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
