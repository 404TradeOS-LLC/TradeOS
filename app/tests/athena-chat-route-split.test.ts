import express from "express";
import request from "supertest";

// Fluid PR-4 (Lever 3 transaction split) route coverage.
//
// POST /chat must run OUTSIDE the request-scoped RLS transaction (mounted
// before databaseSession) so the Gemini wait holds no pool connection, while
// every other Athena route stays behind databaseSession. These tests prove
// the mount order by running the real routers with a spying databaseSession:
// chat never enters it, capabilities does.

const handleRequest = jest.fn();
const isAthenaKernelEnabled = jest.fn(() => true);
const auditRecord = jest.fn(async () => undefined);
const hasTerminalEvent = jest.fn(() => false);

jest.mock("../modules/athena-kernel/service", () => ({
  ATHENA_MAX_MESSAGE_LENGTH: 4000,
  AthenaKernelService: jest.fn().mockImplementation(() => ({ handleRequest })),
}));

jest.mock("../modules/athena-kernel/flags", () => ({
  isAthenaKernelEnabled,
}));

jest.mock("../modules/athena-audit/store", () => ({
  createPrismaAthenaAuditStore: jest.fn(() => ({ record: auditRecord })),
  createTerminalTrackingAthenaAuditStore: jest.fn(() => ({
    record: auditRecord,
    hasTerminalEvent,
  })),
}));

import { athenaChatRouter, athenaRouter } from "../backend/routes/athena.routes";

const databaseSessionSpy = jest.fn((_req: unknown, _res: unknown, next: () => void) => next());

function buildApp() {
  const app = express();
  app.use(express.json());
  // Stands in for the real requireAuth: the chat controller reads req.auth
  // and req.orgId, never the request body, for the actor.
  app.use("/api/v1", (req, _res, next) => {
    (req as unknown as { auth: unknown }).auth = { userId: "user-1", orgId: "org-1", role: "owner" };
    (req as unknown as { orgId: string }).orgId = "org-1";
    next();
  });
  // Same order as app/backend/server.ts: chat before databaseSession, the
  // remaining Athena routes after it.
  app.use("/api/v1/athena", athenaChatRouter);
  app.use("/api/v1", databaseSessionSpy);
  app.use("/api/v1/athena", athenaRouter);
  return app;
}

describe("Athena chat route split (Fluid PR-4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handleRequest.mockResolvedValue({
      success: true,
      state: "succeeded",
      executionId: "exec-1",
      traceId: "trace-1",
      summary: "ok",
      message: "ok",
      warnings: [],
      followUps: [],
      telemetry: { traceId: "trace-1", executionId: "exec-1" },
    });
  });

  it("runs POST /chat without entering databaseSession", async () => {
    const app = buildApp();

    const response = await request(app)
      .post("/api/v1/athena/chat")
      .send({ message: "What is the status of this project?" });

    expect(response.status).toBe(200);
    expect(handleRequest).toHaveBeenCalledTimes(1);
    expect(handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ userId: "user-1", orgId: "org-1", role: "owner" }),
      })
    );
    // The whole point of the split: the chat request never opens the
    // request-scoped RLS transaction, so a slow provider call cannot hold
    // its pool connection or reach RLS_TRANSACTION_TIMEOUT_MS.
    expect(databaseSessionSpy).not.toHaveBeenCalled();
  });

  it("still runs the other Athena routes behind databaseSession", async () => {
    const app = buildApp();

    const response = await request(app).get("/api/v1/athena/capabilities");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ kernelEnabled: true });
    expect(handleRequest).not.toHaveBeenCalled();
    expect(databaseSessionSpy).toHaveBeenCalledTimes(1);
  });
});
