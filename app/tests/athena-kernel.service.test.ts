interface FakeExecutionRow {
  id: string;
  orgId: string;
  actorUserId: string;
  canonicalRole: string;
  state: string;
  safeSummary?: string | null;
  safeErrorCode?: string | null;
  roundTrips?: number;
}

const executions = new Map<string, FakeExecutionRow>();
const transitions: Array<{ executionId: string; fromState: string; toState: string; reasonCode: string }> = [];
const telemetryRows: Array<{ orgId: string; executionId: string; spanType: string; status: string; redaction: string; metadataJson: unknown; costJson: unknown }> = [];

const athenaExecutionCreate = jest.fn(async ({ data }: { data: FakeExecutionRow }) => {
  executions.set(data.id, { ...data });
});
const athenaExecutionUpdate = jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeExecutionRow> }) => {
  const existing = executions.get(where.id);
  if (existing) executions.set(where.id, { ...existing, ...data });
});
const athenaExecutionFindFirst = jest.fn(async ({ where }: { where: { id: string } }) => executions.get(where.id) ?? null);
const athenaExecutionTransitionCreate = jest.fn(async ({ data }: { data: { executionId: string; fromState: string; toState: string; reasonCode: string } }) => {
  transitions.push(data);
});
const athenaTelemetryRecordCreate = jest.fn(async ({ data }: { data: (typeof telemetryRows)[number] }) => {
  telemetryRows.push(data);
});

jest.mock("../db/client", () => ({
  prisma: {
    athenaExecution: { create: athenaExecutionCreate, update: athenaExecutionUpdate, findFirst: athenaExecutionFindFirst },
    athenaExecutionTransition: { create: athenaExecutionTransitionCreate },
    athenaTelemetryRecordRow: { create: athenaTelemetryRecordCreate },
  },
}));

import { AthenaKernelService } from "../modules/athena-kernel/service";
import { AthenaProviderAdapter } from "../modules/athena-kernel/provider";
import { athenaCancellationError } from "../modules/athena-kernel/errors";
import { AthenaActorContext } from "../modules/athena-kernel/types";

const baseEnv = { ATHENA_PROVIDER_MODE: "fake" } as NodeJS.ProcessEnv;

function actor(overrides: Partial<AthenaActorContext> = {}): AthenaActorContext {
  return { userId: "user-1", orgId: "org-1", role: "owner", permissions: [], ...overrides };
}

describe("AthenaKernelService", () => {
  beforeEach(() => {
    executions.clear();
    transitions.length = 0;
    telemetryRows.length = 0;
    jest.clearAllMocks();
  });

  it("persists actor/org/role/request-source as server-derived - never taken from message content", async () => {
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "What is the status of this project?", requestSource: "http" },
      actor: actor({ userId: "user-42", orgId: "org-42", role: "dispatcher" }),
      requestId: "req-42",
      env: baseEnv,
    });

    const stored = executions.get(result.executionId);
    expect(stored?.actorUserId).toBe("user-42");
    expect(stored?.orgId).toBe("org-42");
    expect(stored?.canonicalRole).toBe("dispatcher");
  });

  it("normalizes an unrecognized/legacy role before it reaches persistence or policy", async () => {
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "What is the status of this project?", requestSource: "http" },
      actor: actor({ role: "estimator" as unknown as AthenaActorContext["role"] }),
      requestId: "req-legacy",
      env: baseEnv,
    });

    expect(executions.get(result.executionId)?.canonicalRole).toBe("dispatcher");
  });

  it("returns a safe no-op success when ATHENA_DRAFT_RESPONSES_ENABLED is unset (default false)", async () => {
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "What is the status of this project?", requestSource: "http" },
      actor: actor(),
      requestId: "req-1",
      env: baseEnv,
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe("succeeded");
    expect(result.message).toBeNull();
    expect(result.warnings.some((w) => w.code === "athena_draft_responses_disabled")).toBe(true);
  });

  it("produces a draft message through the fake provider when draft responses are enabled", async () => {
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "What is the status of this project this week?", requestSource: "http" },
      actor: actor(),
      requestId: "req-2",
      env: { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe("succeeded");
    expect(result.message).not.toBeNull();
    expect(telemetryRows.some((row) => row.spanType === "model")).toBe(true);
  });

  it("denies a mutation-shaped request without ever calling the provider", async () => {
    const provider: AthenaProviderAdapter = { generateDraft: jest.fn() };
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "Send the invoice to the customer now", requestSource: "http" },
      actor: actor(),
      requestId: "req-3",
      env: { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
      provider,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe("denied");
    expect(result.error?.category).toBe("authorization");
    expect(provider.generateDraft).not.toHaveBeenCalled();
  });

  it("asks for clarification on an ambiguous/too-short message and tracks the round trip", async () => {
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "hi", requestSource: "http" },
      actor: actor(),
      requestId: "req-4",
      env: baseEnv,
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe("needs_clarification");
    expect(result.followUps.length).toBeGreaterThan(0);
    expect(executions.get(result.executionId)?.roundTrips).toBe(1);
  });

  it("rejects an empty message as a validation failure", async () => {
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "   ", requestSource: "http" },
      actor: actor(),
      requestId: "req-5",
      env: baseEnv,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe("failed");
    expect(result.error?.category).toBe("validation");
  });

  it("cancels immediately when the client signal is already aborted", async () => {
    const service = new AthenaKernelService();
    const clientController = new AbortController();
    clientController.abort();

    const result = await service.handleRequest({
      request: { message: "What is the status of this project?", requestSource: "http" },
      actor: actor(),
      requestId: "req-6",
      env: baseEnv,
      clientSignal: clientController.signal,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe("cancelled");
    expect(result.error?.code).toBe("athena_client_closed");
  });

  it("expires the execution when the request deadline has already passed before provider work begins", async () => {
    const originalNow = Date.now;
    let calls = 0;
    // Deterministic simulated clock (avoids real-timer flakiness): each
    // Date.now() observation advances by 20ms, so a 50ms deadline is
    // guaranteed to have elapsed by the time the pre-provider deadline
    // check runs (several observations into the request).
    jest.spyOn(Date, "now").mockImplementation(() => 1_700_000_000_000 + calls++ * 20);

    try {
      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-7",
        env: { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true", ATHENA_REQUEST_DEADLINE_MS: "50" } as NodeJS.ProcessEnv,
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe("expired");
      expect(result.error?.category).toBe("timeout");
      expect(result.error?.code).toBe("athena_deadline_exceeded");
    } finally {
      Date.now = originalNow;
    }
  });

  it("maps a provider-side failure to a terminal failed state without leaking the raw error", async () => {
    const provider: AthenaProviderAdapter = {
      generateDraft: jest.fn().mockRejectedValue(new Error("raw upstream provider stack trace, do not leak")),
    };
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "What is the status of this project?", requestSource: "http" },
      actor: actor(),
      requestId: "req-8",
      env: { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
      provider,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe("failed");
    expect(result.error?.safeSummary).not.toMatch(/raw upstream/);
  });

  it("enforces the provider deadline even when the provider never resolves (non-cooperative provider)", async () => {
    // Ignores its AbortSignal entirely - the kernel's own race against
    // ATHENA_PROVIDER_DEADLINE_MS must still bound this call, not the
    // provider's cooperation.
    const neverResolvingProvider: AthenaProviderAdapter = {
      generateDraft: () => new Promise(() => undefined),
    };
    const service = new AthenaKernelService();

    const result = await service.handleRequest({
      request: { message: "What is the status of this project this week?", requestSource: "http" },
      actor: actor(),
      requestId: "req-provider-hang",
      env: { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true", ATHENA_PROVIDER_DEADLINE_MS: "20", ATHENA_REQUEST_DEADLINE_MS: "5000" } as NodeJS.ProcessEnv,
      provider: neverResolvingProvider,
    });

    expect(result.success).toBe(false);
    expect(result.state).not.toBe("succeeded");
    expect(result.state).toBe("cancelled");
    expect(result.error?.category).toBe("timeout");
    expect(result.error?.code).toBe("athena_provider_timeout");
  }, 10_000);

  it("cancels mid-flight when the client disconnects during a slow provider call, reflecting client cancellation rather than the provider's own rejection reason", async () => {
    // Cooperative provider: reacts to abort, but only after a real delay -
    // giving the client a genuine window to disconnect while the provider
    // call is still in flight, rather than before it ever starts.
    const slowCooperativeProvider: AthenaProviderAdapter = {
      generateDraft: ({ signal }) =>
        new Promise((resolve, reject) => {
          const onAbort = () => reject(athenaCancellationError("Provider observed cancellation mid-flight."));
          signal.addEventListener("abort", onAbort, { once: true });
          setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve({ text: "late response that should never be used", provider: "slow", model: "slow-1" });
          }, 200);
        }),
    };

    const clientController = new AbortController();
    setTimeout(() => clientController.abort(), 20);

    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "What is the status of this project this week?", requestSource: "http" },
      actor: actor(),
      requestId: "req-client-abort-midflight",
      env: { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true", ATHENA_PROVIDER_DEADLINE_MS: "5000", ATHENA_REQUEST_DEADLINE_MS: "5000" } as NodeJS.ProcessEnv,
      provider: slowCooperativeProvider,
      clientSignal: clientController.signal,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe("cancelled");
    // The provider itself threw a cancellation-flavored AthenaKernelError,
    // but the kernel's own client-disconnect reason must win - this must
    // never surface as a generic failed result or the provider's own
    // "athena_cancelled" code.
    expect(result.state).not.toBe("failed");
    expect(result.error?.code).toBe("athena_client_closed");
    expect(result.error?.code).not.toBe("athena_cancelled");
  }, 10_000);

  it("never writes the raw message text into any persisted telemetry record", async () => {
    const service = new AthenaKernelService();
    const secretMessage = "please summarize project UNLIKELY_STRING_MARKER_12345 for me";
    await service.handleRequest({
      request: { message: secretMessage, requestSource: "http" },
      actor: actor(),
      requestId: "req-9",
      env: { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
    });

    expect(telemetryRows.length).toBeGreaterThan(0);
    for (const row of telemetryRows) {
      expect(row.redaction).toBe("metadata_only");
      expect(JSON.stringify(row.metadataJson)).not.toContain("UNLIKELY_STRING_MARKER_12345");
      expect(JSON.stringify(row.costJson ?? {})).not.toContain("UNLIKELY_STRING_MARKER_12345");
    }
  });

  it("emits a kernel span and finalizes the execution record even when telemetry recording itself fails", async () => {
    athenaTelemetryRecordCreate.mockRejectedValueOnce(new Error("telemetry sink unavailable"));
    const service = new AthenaKernelService();
    const result = await service.handleRequest({
      request: { message: "What is the status of this project?", requestSource: "http" },
      actor: actor(),
      requestId: "req-10",
      env: baseEnv,
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe("succeeded");
  });
});
