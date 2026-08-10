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

import { createInMemoryAthenaApprovalStore } from "../modules/athena-action-engine/approval";
import { createInMemoryAthenaIdempotencyStore } from "../modules/athena-action-engine/idempotency";
import { AthenaKernelService } from "../modules/athena-kernel/service";
import { AthenaProviderAdapter } from "../modules/athena-kernel/provider";
import { athenaCancellationError } from "../modules/athena-kernel/errors";
import { AthenaActorContext } from "../modules/athena-kernel/types";
import { createAthenaContextRegistry } from "../modules/athena-context-engine/registry";
import { createDispatchProvider } from "../modules/athena-context-engine/providers/dispatchProvider";
import { createKnowledgeEngineProvider } from "../modules/athena-context-engine/providers/knowledgeEngineProvider";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import type { AthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";
import type { JobsService } from "../modules/jobs/service";
import type { PaginatedJobsDTO } from "../modules/jobs/types";

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

  describe("A5 router/planner orchestration (ATHENA_ROUTER_PLANNER_ENABLED=true)", () => {
    const routerEnv = { ...baseEnv, ATHENA_ROUTER_PLANNER_ENABLED: "true" } as NodeJS.ProcessEnv;

    function fakeJobsService(result: PaginatedJobsDTO): Pick<JobsService, "list" | "getById"> {
      return {
        async list() {
          return result;
        },
        async getById(_orgId, jobId) {
          const match = result.items.find((job) => job.id === jobId);
          if (!match) throw new Error("not found");
          return match as never;
        },
      };
    }

    it("produces the same draft_response outcome as the flag-off path for a plain question", async () => {
      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a5-1",
        env: routerEnv,
      });

      expect(result.success).toBe(true);
      expect(result.state).toBe("succeeded");
      expect(result.message).toBeNull();
      expect(result.warnings.some((w) => w.code === "athena_draft_responses_disabled")).toBe(true);
    });

    it("still denies a mutation-shaped request without ever calling the provider - identical external behavior to the flag-off path", async () => {
      const provider: AthenaProviderAdapter = { generateDraft: jest.fn() };
      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "Send the invoice to the customer now", requestSource: "http" },
        actor: actor(),
        requestId: "req-a5-2",
        env: { ...routerEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
        provider,
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe("denied");
      expect(result.error?.category).toBe("authorization");
      expect(provider.generateDraft).not.toHaveBeenCalled();
    });

    it("populates context.dispatch through a real assembleAthenaContext() call for a dispatch-overview request", async () => {
      const contextRegistry = createAthenaContextRegistry();
      contextRegistry.register(createDispatchProvider({}, fakeJobsService({ items: [], page: 1, pageSize: 25, total: 0 })));

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "Show me the dispatch board", requestSource: "http" },
        actor: actor(),
        requestId: "req-a5-3",
        env: routerEnv,
        contextRegistry,
      });

      expect(result.success).toBe(true);
      expect(telemetryRows.some((row) => row.spanType === "context")).toBe(true);
    });

    it("populates context.knowledgeEngine for a knowledge-lookup request using the real KnowledgeRuntimeService", async () => {
      const contextRegistry = createAthenaContextRegistry();
      contextRegistry.register(createKnowledgeEngineProvider());

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What's the cost of drywall?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a5-4",
        env: routerEnv,
        contextRegistry,
      });

      expect(result.success).toBe(true);
    });

    it("denies a tool_call step using the resolved tool's real required permissions, never a hardcoded [] - and never calls the provider", async () => {
      const toolRegistry = createAthenaToolRegistry();
      toolRegistry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.needs-billing", permissions: ["billing.write"], risk: "low" }));
      const provider: AthenaProviderAdapter = { generateDraft: jest.fn() };

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor({ role: "technician" }), // technician does not hold billing.write (app/domain/contracts.ts)
        requestId: "req-a5-authz-missing-permission",
        env: { ...routerEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
        provider,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.needs-billing", toolVersion: "1.0.0", summary: "Needs billing.write." }],
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe("denied");
      expect(result.error?.category).toBe("authorization");
      expect(provider.generateDraft).not.toHaveBeenCalled();
    });

    it.each(["medium", "high"] as const)("requires approval for a %s-risk tool_call step with satisfied permissions, and never calls the provider (A6 does not exist)", async (risk) => {
      const toolRegistry = createAthenaToolRegistry();
      toolRegistry.register(createEchoFixtureTool({ id: `tradeos.athena.fixture.risky-${risk}`, permissions: [], risk }));
      const provider: AthenaProviderAdapter = { generateDraft: jest.fn() };

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: `req-a5-authz-risk-${risk}`,
        env: { ...routerEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
        provider,
        toolRegistry,
        candidateTools: [{ toolId: `tradeos.athena.fixture.risky-${risk}`, toolVersion: "1.0.0", summary: "Risky tool." }],
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe("denied");
      expect(result.error?.code).toBe("athena_approval_required_no_action_engine");
      expect(provider.generateDraft).not.toHaveBeenCalled();
    });

    it("does not deny a low-risk tool_call step whose real permissions are satisfied - authorization classification only, the tool still never executes in A5", async () => {
      const toolRegistry = createAthenaToolRegistry();
      let executed = false;
      toolRegistry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.safe-tool", permissions: ["crm.read"], risk: "low", onExecuted: () => { executed = true; } }));

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(), // owner holds crm.read
        requestId: "req-a5-authz-allowed",
        env: routerEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.safe-tool", toolVersion: "1.0.0", summary: "Safe tool." }],
      });

      expect(result.success).toBe(true);
      expect(result.state).toBe("succeeded");
      // No A6 action engine exists yet - A5 never calls tool.execute() even
      // for an authorized step. This assertion is about not being
      // incorrectly denied, not about execution happening.
      expect(executed).toBe(false);
    });

    it("fails closed when a plan step's tool can no longer be resolved at the kernel's authorization stage", async () => {
      const tool = createEchoFixtureTool({ id: "tradeos.athena.fixture.vanishing", permissions: [], risk: "low" });
      let resolveCallCount = 0;
      // Simulates the tool becoming unavailable between planning and
      // authorization (e.g. a concurrent remove()): the first resolve() call
      // is the planner's own resolve-or-throw inside buildAthenaPlan(); the
      // second is the kernel's authorization-stage resolve() this repair
      // adds. A real createAthenaToolRegistry() cannot produce this
      // divergence on its own (register()/remove() keep discover()/resolve()
      // consistent), so this exercises the defensive fail-closed branch via
      // an injected registry.
      const fakeRegistry: Pick<AthenaToolRegistry, "discover" | "resolve"> = {
        discover: () => [tool],
        resolve: () => {
          resolveCallCount += 1;
          return resolveCallCount === 1 ? { outcome: "found", definition: tool } : { outcome: "tool_removed" };
        },
      };
      const provider: AthenaProviderAdapter = { generateDraft: jest.fn() };

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a5-authz-unresolvable",
        env: { ...routerEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv,
        provider,
        toolRegistry: fakeRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.vanishing", toolVersion: "1.0.0", summary: "Vanishing tool." }],
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe("denied");
      expect(result.error?.code).toBe("athena_tool_call_step_unresolvable");
      expect(provider.generateDraft).not.toHaveBeenCalled();
    });

    it("never attempts context assembly for draft_response - no requestedContextIntents means no provider fetch", async () => {
      const contextRegistry = createAthenaContextRegistry();
      let fetched = false;
      const spyProvider = createKnowledgeEngineProvider({
        async fetch(fetchInput) {
          fetched = true;
          return createKnowledgeEngineProvider().fetch(fetchInput);
        },
      });
      contextRegistry.register(spyProvider);

      const service = new AthenaKernelService();
      await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a5-5",
        env: routerEnv,
        contextRegistry,
      });

      expect(fetched).toBe(false);
    });
  });

  describe("A6 action engine orchestration (ATHENA_ACTION_ENGINE_ENABLED=true)", () => {
    const routerOnlyEnv = { ...baseEnv, ATHENA_ROUTER_PLANNER_ENABLED: "true" } as NodeJS.ProcessEnv;
    const actionEnv = { ...baseEnv, ATHENA_ROUTER_PLANNER_ENABLED: "true", ATHENA_ACTION_ENGINE_ENABLED: "true" } as NodeJS.ProcessEnv;

    it("executes a registered low-risk tool_call step exactly once and returns a succeeded outcome", async () => {
      const toolRegistry = createAthenaToolRegistry();
      let executeCount = 0;
      toolRegistry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.a6-success", permissions: [], risk: "low", onExecuted: () => { executeCount += 1; } }));

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a6-success",
        env: actionEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.a6-success", toolVersion: "1.0.0", summary: "Safe tool.", input: { message: "hi" } }],
      });

      expect(executeCount).toBe(1);
      expect(result.success).toBe(true);
      expect(result.state).toBe("succeeded");
    });

    it("never executes a tool_call step when ATHENA_ACTION_ENGINE_ENABLED is false, even for an allow decision - preserves A5 behavior", async () => {
      const toolRegistry = createAthenaToolRegistry();
      let executed = false;
      toolRegistry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.a6-flag-off", permissions: [], risk: "low", onExecuted: () => { executed = true; } }));

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a6-flag-off",
        env: routerOnlyEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.a6-flag-off", toolVersion: "1.0.0", summary: "Safe tool.", input: { message: "hi" } }],
      });

      expect(executed).toBe(false);
      expect(result.success).toBe(true);
      expect(result.state).toBe("succeeded");
    });

    it("never calls the handler when the actor lacks the tool's required permission (A4 deny)", async () => {
      const toolRegistry = createAthenaToolRegistry();
      let executed = false;
      toolRegistry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.a6-needs-billing", permissions: ["billing.write"], risk: "low", onExecuted: () => { executed = true; } }));

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor({ role: "technician" }), // technician does not hold billing.write
        requestId: "req-a6-denied",
        env: actionEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.a6-needs-billing", toolVersion: "1.0.0", summary: "Needs billing.write.", input: { message: "hi" } }],
      });

      expect(executed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.state).toBe("denied");
    });

    it("never executes a high-risk tool_call step when approval is required but none is supplied - never silently downgrades to allow", async () => {
      const toolRegistry = createAthenaToolRegistry();
      let executed = false;
      toolRegistry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.a6-awaiting", permissions: [], risk: "high", onExecuted: () => { executed = true; } }));

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a6-awaiting",
        env: actionEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.a6-awaiting", toolVersion: "1.0.0", summary: "Risky tool.", input: { message: "hi" } }],
      });

      expect(executed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.state).toBe("denied");
    });

    it("executes a high-risk tool_call step once a valid, correctly-bound approval is supplied and verified", async () => {
      const toolRegistry = createAthenaToolRegistry();
      let executed = false;
      toolRegistry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.a6-approved", permissions: [], risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = createInMemoryAthenaApprovalStore();
      approvals.grant({ approvalId: "approval-a6-1", orgId: "org-1", toolId: "tradeos.athena.fixture.a6-approved", toolVersion: "1.0.0", idempotencyKey: "idem-a6-1", status: "granted" });

      const service = new AthenaKernelService();
      const result = await service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: actor(),
        requestId: "req-a6-approved",
        env: actionEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.a6-approved", toolVersion: "1.0.0", summary: "Approved tool.", input: { message: "hi" } }],
        approvalId: "approval-a6-1",
        idempotencyKey: "idem-a6-1",
        approvalVerifier: approvals,
      });

      expect(executed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.state).toBe("succeeded");
    });

    it("a duplicate submission with the same idempotency key does not execute the handler twice", async () => {
      const toolRegistry = createAthenaToolRegistry();
      let executeCount = 0;
      toolRegistry.register({ ...createEchoFixtureTool({ id: "tradeos.athena.fixture.a6-idempotent", permissions: [], risk: "low", onExecuted: () => { executeCount += 1; } }), idempotency: "required" });
      const idempotencyStore = createInMemoryAthenaIdempotencyStore();
      const buildInput = (requestId: string) => ({
        request: { message: "What is the status of this project?", requestSource: "http" as const },
        actor: actor(),
        requestId,
        env: actionEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.a6-idempotent", toolVersion: "1.0.0", summary: "Idempotent tool.", input: { message: "hi" } }],
        idempotencyKey: "idem-a6-dup",
        idempotencyStore,
      });

      const service = new AthenaKernelService();
      const first = await service.handleRequest(buildInput("req-a6-idem-1"));
      const second = await service.handleRequest(buildInput("req-a6-idem-2"));

      expect(executeCount).toBe(1);
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
    });
  });
});
