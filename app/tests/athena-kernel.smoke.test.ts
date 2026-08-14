// Backs `npm run athena:smoke` (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md
// "Named Validation Gates" / "Smoke test for authenticated no-op/draft
// path"). Drives the real controller -> kernel service -> execution store ->
// telemetry path end to end with the kernel explicitly enabled, mocking only
// the database layer (no live Postgres required for this gate).
const executions = new Map<string, Record<string, unknown>>();

const athenaExecutionCreate = jest.fn(async ({ data }: { data: { id: string } & Record<string, unknown> }) => {
  executions.set(data.id, { ...data });
});
const athenaExecutionUpdate = jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
  const existing = executions.get(where.id);
  if (existing) executions.set(where.id, { ...existing, ...data });
});
const athenaExecutionFindFirst = jest.fn(async ({ where }: { where: { id: string } }) => executions.get(where.id) ?? null);
const athenaExecutionTransitionCreate = jest.fn(async () => undefined);
const athenaTelemetryRecordCreate = jest.fn(async () => undefined);
const athenaAuditEventFindFirst = jest.fn(async () => null);
const athenaAuditEventCreate = jest.fn(async () => undefined);

jest.mock("../db/client", () => ({
  prisma: {
    athenaExecution: { create: athenaExecutionCreate, update: athenaExecutionUpdate, findFirst: athenaExecutionFindFirst },
    athenaExecutionTransition: { create: athenaExecutionTransitionCreate },
    athenaTelemetryRecordRow: { create: athenaTelemetryRecordCreate },
    athenaAuditEvent: { findFirst: athenaAuditEventFindFirst, create: athenaAuditEventCreate },
  },
}));

import { athenaController } from "../backend/controllers/athena.controller";

function responseDouble() {
  const res = {
    locals: {} as Record<string, unknown>,
    writableEnded: false,
    status: jest.fn(),
    json: jest.fn(),
    // The controller listens on res (not req) "close" to detect a client
    // disconnecting mid-response; a no-op double is enough here since this
    // gate only exercises the authenticated no-op/draft path, not
    // cancellation wiring (covered in athena-kernel.controller.test.ts).
    once: jest.fn(),
    removeListener: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as { locals: Record<string, unknown>; writableEnded: boolean; status: jest.Mock; json: jest.Mock; once: jest.Mock; removeListener: jest.Mock };
}

describe("athena:smoke - authenticated no-op/draft path", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is unreachable when ATHENA_KERNEL_ENABLED is unset (dark by default)", async () => {
    delete process.env.ATHENA_KERNEL_ENABLED;
    const req = {
      method: "POST",
      path: "/api/v1/athena/chat",
      body: { message: "What is the status of this project?" },
      orgId: "org-1",
      auth: { userId: "user-1", orgId: "org-1", role: "owner" },
      once: jest.fn(),
    } as unknown as Parameters<typeof athenaController.chat>[0];
    const res = responseDouble();

    await expect(athenaController.chat(req, res as never)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns a safe no-op success for an authenticated request once enabled, with draft responses off", async () => {
    process.env.ATHENA_KERNEL_ENABLED = "true";
    delete process.env.ATHENA_DRAFT_RESPONSES_ENABLED;

    const req = {
      method: "POST",
      path: "/api/v1/athena/chat",
      body: { message: "What is the status of this project?" },
      orgId: "org-1",
      auth: { userId: "user-1", orgId: "org-1", role: "owner" },
      once: jest.fn(),
    } as unknown as Parameters<typeof athenaController.chat>[0];
    const res = responseDouble();

    await athenaController.chat(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        state: "succeeded",
        message: null,
      })
    );
  });

  it("returns a draft response once ATHENA_PROVIDER_MODE=fake and draft responses are enabled", async () => {
    process.env.ATHENA_KERNEL_ENABLED = "true";
    process.env.ATHENA_PROVIDER_MODE = "fake";
    process.env.ATHENA_DRAFT_RESPONSES_ENABLED = "true";

    const req = {
      method: "POST",
      path: "/api/v1/athena/chat",
      body: { message: "What is the status of this project this week?" },
      orgId: "org-1",
      auth: { userId: "user-1", orgId: "org-1", role: "owner" },
      once: jest.fn(),
    } as unknown as Parameters<typeof athenaController.chat>[0];
    const res = responseDouble();

    await athenaController.chat(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.message).toEqual(expect.any(String));
  });

  it("never mutates a business record - denies a mutation-shaped request", async () => {
    process.env.ATHENA_KERNEL_ENABLED = "true";

    const req = {
      method: "POST",
      path: "/api/v1/athena/chat",
      body: { message: "Send the invoice to the customer" },
      orgId: "org-1",
      auth: { userId: "user-1", orgId: "org-1", role: "owner" },
      once: jest.fn(),
    } as unknown as Parameters<typeof athenaController.chat>[0];
    const res = responseDouble();

    await athenaController.chat(req, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.state).toBe("denied");
  });
});
