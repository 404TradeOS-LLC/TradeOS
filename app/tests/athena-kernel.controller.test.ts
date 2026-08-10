const handleRequest = jest.fn();
const isAthenaKernelEnabled = jest.fn();

jest.mock("../modules/athena-kernel/service", () => ({
  ATHENA_MAX_MESSAGE_LENGTH: 4000,
  AthenaKernelService: jest.fn().mockImplementation(() => ({ handleRequest })),
}));

jest.mock("../modules/athena-kernel/flags", () => ({
  isAthenaKernelEnabled,
}));

import { athenaController } from "../backend/controllers/athena.controller";
import { ApiError } from "../backend/middleware/errorHandler";

function responseDouble() {
  const res = {
    locals: {} as Record<string, unknown>,
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as { locals: Record<string, unknown>; status: jest.Mock; json: jest.Mock };
}

function fakeRequest(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    path: "/api/v1/athena/chat",
    body: { message: "What is the status of this project?" },
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role: "owner" },
    once: jest.fn(),
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
});
