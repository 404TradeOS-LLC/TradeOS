const handleRequest = jest.fn();
const isAthenaKernelEnabled = jest.fn();
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

import { athenaController } from "../backend/controllers/athena.controller";
import { ApiError } from "../backend/middleware/errorHandler";

function responseDouble() {
  const listeners: Record<string, (() => void) | undefined> = {};
  const res = {
    locals: {} as Record<string, unknown>,
    writableEnded: false,
    status: jest.fn(),
    json: jest.fn(),
    // The controller listens on res (not req) "close" to detect a client
    // disconnecting mid-response - this double lets a test fire that event
    // manually via emitClose().
    once: jest.fn((event: string, listener: () => void) => {
      listeners[event] = listener;
    }),
    removeListener: jest.fn((event: string) => {
      listeners[event] = undefined;
    }),
    emitClose: () => listeners.close?.(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as { locals: Record<string, unknown>; writableEnded: boolean; status: jest.Mock; json: jest.Mock; once: jest.Mock; removeListener: jest.Mock; emitClose: () => void };
}

function fakeRequest(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    path: "/api/v1/athena/chat",
    body: { message: "What is the status of this project?" },
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role: "owner" },
    ...overrides,
  } as unknown as Parameters<typeof athenaController.chat>[0];
}

describe("athenaController.chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 404 (as if the route does not exist) when the kernel is disabled", async () => {
    isAthenaKernelEnabled.mockReturnValue(false);
    const req = fakeRequest();
    const res = responseDouble();

    await expect(athenaController.chat(req, res as never)).rejects.toBeInstanceOf(ApiError);
    expect(handleRequest).not.toHaveBeenCalled();
  });

  it("derives actor/org/role from req.auth/req.orgId, never from the request body", async () => {
    isAthenaKernelEnabled.mockReturnValue(true);
    handleRequest.mockResolvedValue({ success: true, state: "succeeded", executionId: "exec-1", traceId: "trace-1", summary: "ok", message: null, warnings: [], followUps: [], telemetry: { traceId: "trace-1", executionId: "exec-1" } });

    const req = fakeRequest({
      body: { message: "hello", orgId: "attacker-org", userId: "attacker-user" },
      orgId: "real-org",
      auth: { userId: "real-user", orgId: "real-org", role: "technician" },
    });
    const res = responseDouble();

    await athenaController.chat(req, res as never);

    expect(handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ userId: "real-user", orgId: "real-org", role: "technician" }),
      })
    );
  });

  it("rejects an oversized message before calling the kernel service", async () => {
    isAthenaKernelEnabled.mockReturnValue(true);
    const req = fakeRequest({ body: { message: "x".repeat(5000) } });
    const res = responseDouble();

    await expect(athenaController.chat(req, res as never)).rejects.toThrow();
    expect(handleRequest).not.toHaveBeenCalled();
  });

  it("maps a denied kernel result to HTTP 403", async () => {
    isAthenaKernelEnabled.mockReturnValue(true);
    handleRequest.mockResolvedValue({
      success: false,
      state: "denied",
      executionId: "exec-1",
      traceId: "trace-1",
      summary: "denied",
      message: null,
      warnings: [],
      followUps: [],
      telemetry: { traceId: "trace-1", executionId: "exec-1" },
      error: { code: "athena_capability_not_available", category: "authorization", retryable: false, safeSummary: "no", correlationId: "trace-1" },
    });
    const req = fakeRequest();
    const res = responseDouble();

    await athenaController.chat(req, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("maps a successful kernel result to HTTP 200", async () => {
    isAthenaKernelEnabled.mockReturnValue(true);
    handleRequest.mockResolvedValue({ success: true, state: "succeeded", executionId: "exec-1", traceId: "trace-1", summary: "ok", message: null, warnings: [], followUps: [], telemetry: { traceId: "trace-1", executionId: "exec-1" } });
    const req = fakeRequest();
    const res = responseDouble();

    await athenaController.chat(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("aborts the kernel's clientSignal when the response closes early (client disconnect), not on req close", async () => {
    isAthenaKernelEnabled.mockReturnValue(true);
    let capturedSignal: AbortSignal | undefined;
    const req = fakeRequest();
    const res = responseDouble();
    handleRequest.mockImplementation(async ({ clientSignal }: { clientSignal: AbortSignal }) => {
      capturedSignal = clientSignal;
      // Fire the response's close event while the kernel call is still
      // "in flight" from the controller's point of view, mirroring a real
      // client disconnect mid-request.
      res.emitClose();
      return { success: false, state: "cancelled", executionId: "exec-1", traceId: "trace-1", summary: "cancelled", message: null, warnings: [], followUps: [], telemetry: { traceId: "trace-1", executionId: "exec-1" }, error: { code: "athena_client_closed", category: "timeout", retryable: false, safeSummary: "cancelled", correlationId: "trace-1" } };
    });

    await athenaController.chat(req, res as never);

    expect(capturedSignal?.aborted).toBe(true);
    expect(res.once).toHaveBeenCalledWith("close", expect.any(Function));
    expect(res.removeListener).toHaveBeenCalledWith("close", expect.any(Function));
  });

  it("does not abort when res 'close' fires after the response has already been fully sent", async () => {
    isAthenaKernelEnabled.mockReturnValue(true);
    let capturedSignal: AbortSignal | undefined;
    const req = fakeRequest();
    const res = responseDouble();
    handleRequest.mockImplementation(async ({ clientSignal }: { clientSignal: AbortSignal }) => {
      capturedSignal = clientSignal;
      // The listener is still attached at this point (removed only in the
      // controller's finally block, after this promise resolves) - firing
      // close here with writableEnded already true simulates the ordinary
      // "response finished, then the connection closed" case rather than a
      // genuine mid-response disconnect.
      res.writableEnded = true;
      res.emitClose();
      return { success: true, state: "succeeded", executionId: "exec-1", traceId: "trace-1", summary: "ok", message: null, warnings: [], followUps: [], telemetry: { traceId: "trace-1", executionId: "exec-1" } };
    });

    await athenaController.chat(req, res as never);

    expect(capturedSignal?.aborted).toBe(false);
  });
});
