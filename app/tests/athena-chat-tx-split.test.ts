// Fluid PR-4 (Lever 3 transaction split) unit coverage.
//
// The production kernel runs the Gemini wait outside every database
// transaction: the chat route is mounted before databaseSession, the
// controller establishes the validated session actor, and each Athena persist
// opens its own short RLS session from that actor. These tests prove the
// three properties that change with the split, using a fake Prisma client
// whose $transaction is instrumented (open/close counting, set_config
// capture, rollback-by-snapshot) so the transaction boundaries are
// observable:
//
//  1. No transaction is held while the provider is awaited, and the
//     execution record is already committed (visible) before it returns.
//  2. Every short session carries the controller's actor (set_config).
//  3. Each enumerated partial-failure state behaves as documented (see the
//     PR body): earlier writes persist instead of rolling back with the
//     request, and best-effort writes never fail the draft.
//
// Live-PostgreSQL coverage of the same split (tenant isolation, inactive
// membership, successive tenants on a reused connection) lives in
// tests/athena-chat-tx-split.integration.ts.

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

interface FakeGenerationRow {
  id: string;
  orgId: string;
  actorUserId: string;
  executionId?: string;
  requestId: string;
  traceId: string;
  provider: string;
  model: string;
  providerVersion?: string;
  status: string;
  failureCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: { toNumber(): number } | null;
  latencyMs: number;
  toolNamesJson: unknown;
  provenanceJson: unknown;
  retentionExpiresAt: Date;
  createdAt: Date;
  completedAt?: Date | null;
}

type FakeGenerationCreateData = Omit<FakeGenerationRow, "createdAt">;

const executions = new Map<string, FakeExecutionRow>();
const transitions: Array<{ executionId: string; fromState: string; toState: string; reasonCode: string; metadataJson?: unknown }> = [];
const telemetryRows: Array<{ orgId: string; executionId: string; spanType: string; status: string }> = [];
const generationRows: FakeGenerationRow[] = [];
const auditRows: Array<Record<string, unknown>> = [];

const defaultAthenaExecutionCreate = async ({ data }: { data: FakeExecutionRow }) => {
  executions.set(data.id, { ...data });
};
const defaultAthenaExecutionUpdate = async ({ where, data }: { where: { id: string }; data: Partial<FakeExecutionRow> }) => {
  const existing = executions.get(where.id);
  if (existing) executions.set(where.id, { ...existing, ...data });
};
const defaultAthenaExecutionFindFirst = async ({ where }: { where: { id: string } }) => executions.get(where.id) ?? null;
const defaultAthenaExecutionTransitionCreate = async ({ data }: { data: { executionId: string; fromState: string; toState: string; reasonCode: string; metadataJson?: unknown } }) => {
  transitions.push(data);
};
const defaultAthenaTelemetryRecordCreate = async ({ data }: { data: (typeof telemetryRows)[number] }) => {
  telemetryRows.push(data);
};
// Fluid PR-5: the kernel buffers telemetry spans and flushes them in one
// createMany after the response is determined, so the fake records the batch
// the same way the single-create fake records one row.
const defaultAthenaTelemetryRecordCreateMany = async ({ data }: { data: Array<(typeof telemetryRows)[number]> }) => {
  telemetryRows.push(...data);
  return { count: data.length };
};
const defaultAthenaGenerationRunCreate = async ({ data }: { data: FakeGenerationCreateData }) => {
  const row: FakeGenerationRow = { ...data, createdAt: new Date() };
  generationRows.push(row);
  return row;
};
const defaultAthenaAuditEventCreate = async ({ data }: { data: Record<string, unknown> }) => {
  auditRows.push(data);
  return data;
};
// Fluid PR-5: the kernel buffers audit events and flushes them in one
// createMany after the response is determined.
const defaultAthenaAuditEventCreateMany = async ({ data }: { data: Record<string, unknown>[] }) => {
  auditRows.push(...data);
  return { count: data.length };
};
// Sums the in-memory generation rows the way the SECURITY DEFINER function
// would (org + chargeable statuses + UTC-day window + non-null
// estimatedUsd), so the cap tests exercise the service against a faithful
// ledger. The SQL values arrive as [orgId, dayStart, dayEnd].
const defaultAthenaSpendQueryRaw = async (sql: { values: unknown[] }) => {
  const [orgId, start, end] = sql.values as [string, Date, Date];
  let sum = 0;
  for (const row of generationRows) {
    if (row.orgId !== orgId) continue;
    if (row.status !== "succeeded" && row.status !== "failed") continue;
    if (!(row.createdAt >= start && row.createdAt < end)) continue;
    if (row.estimatedUsd == null) continue;
    sum += row.estimatedUsd.toNumber();
  }
  return [{ spend_usd: { toNumber: () => sum } }];
};

const athenaExecutionCreate = jest.fn(defaultAthenaExecutionCreate);
const athenaExecutionUpdate = jest.fn(defaultAthenaExecutionUpdate);
const athenaExecutionFindFirst = jest.fn(defaultAthenaExecutionFindFirst);
const athenaExecutionTransitionCreate = jest.fn(defaultAthenaExecutionTransitionCreate);
const athenaTelemetryRecordCreate = jest.fn(defaultAthenaTelemetryRecordCreate);
const athenaTelemetryRecordCreateMany = jest.fn(defaultAthenaTelemetryRecordCreateMany);
const athenaGenerationRunCreate = jest.fn(defaultAthenaGenerationRunCreate);
const athenaAuditEventCreate = jest.fn(defaultAthenaAuditEventCreate);
const athenaAuditEventCreateMany = jest.fn(defaultAthenaAuditEventCreateMany);
const athenaAuditEventFindFirst = jest.fn(async () => null);
const athenaSpendQueryRaw = jest.fn(defaultAthenaSpendQueryRaw);

// Instrumented transaction: counts open transactions, records every
// set_config call (the RLS session vars), and rolls back the in-memory
// stores by snapshot when the callback throws — the same atomicity the
// database gives a real transaction.
let openTransactions = 0;
let maxOpenTransactions = 0;
const setConfigCalls: Array<{ values: unknown[] }> = [];

const txQueryRaw = jest.fn(async (sql: { values?: unknown[] }) => {
  setConfigCalls.push({ values: [...(sql.values ?? [])] });
  return [];
});

function snapshotStores() {
  return {
    executions: new Map(executions),
    transitions: [...transitions],
    telemetryRows: [...telemetryRows],
    generationRows: [...generationRows],
    auditRows: [...auditRows],
  };
}
function restoreStores(snap: ReturnType<typeof snapshotStores>) {
  executions.clear();
  for (const [key, value] of snap.executions) executions.set(key, value);
  transitions.length = 0;
  transitions.push(...snap.transitions);
  telemetryRows.length = 0;
  telemetryRows.push(...snap.telemetryRows);
  generationRows.length = 0;
  generationRows.push(...snap.generationRows);
  auditRows.length = 0;
  auditRows.push(...snap.auditRows);
}

const fakeTx = {
  athenaExecution: { create: athenaExecutionCreate, update: athenaExecutionUpdate, findFirst: athenaExecutionFindFirst },
  athenaExecutionTransition: { create: athenaExecutionTransitionCreate },
  athenaTelemetryRecordRow: { create: athenaTelemetryRecordCreate, createMany: athenaTelemetryRecordCreateMany },
  athenaGenerationRun: { create: athenaGenerationRunCreate },
  athenaAuditEvent: { create: athenaAuditEventCreate, createMany: athenaAuditEventCreateMany, findFirst: athenaAuditEventFindFirst },
  $queryRaw: txQueryRaw,
};

const fakeTransaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>, _options?: unknown) => {
  openTransactions++;
  maxOpenTransactions = Math.max(maxOpenTransactions, openTransactions);
  const snap = snapshotStores();
  try {
    return await callback(fakeTx);
  } catch (error) {
    restoreStores(snap);
    throw error;
  } finally {
    openTransactions--;
  }
});

jest.mock("../db/client", () => ({
  prisma: {
    athenaExecution: { create: athenaExecutionCreate, update: athenaExecutionUpdate, findFirst: athenaExecutionFindFirst },
    athenaExecutionTransition: { create: athenaExecutionTransitionCreate },
    athenaTelemetryRecordRow: { create: athenaTelemetryRecordCreate, createMany: athenaTelemetryRecordCreateMany },
    athenaGenerationRun: { create: athenaGenerationRunCreate },
    athenaAuditEvent: { create: athenaAuditEventCreate, createMany: athenaAuditEventCreateMany, findFirst: athenaAuditEventFindFirst },
    $queryRaw: athenaSpendQueryRaw,
  },
  basePrisma: { $transaction: fakeTransaction },
}));

// Imports go after the mock (same layout as athena-kernel.service.test.ts):
// the mocked ../db/client factory references the fakes above, so the modules
// that pull it in must be required after they are initialized.
import { randomUUID } from "node:crypto";
import { getRolePermissions } from "../domain";
import { getRequestDatabaseClient, runWithSessionActor } from "../db/requestSession";
import { AthenaKernelService } from "../modules/athena-kernel/service";
import { AthenaProviderAdapter, GoogleGeminiAthenaProvider } from "../modules/athena-kernel/provider";
import type { AthenaActorContext } from "../modules/athena-kernel/types";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";
import {
  createExecutionRecord,
  finalizeExecutionRecord,
  persistGenerationRecord,
} from "../modules/athena-kernel/executionStore";
import { createPrismaAthenaAuditStore } from "../modules/athena-audit/store";
import type { AthenaAuditEvent } from "../modules/athena-audit/types";

const baseEnv = { ATHENA_PROVIDER_MODE: "fake" } as NodeJS.ProcessEnv;
const draftEnv = { ...baseEnv, ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv;

function kernelActor(): AthenaActorContext {
  return { userId: "user-1", orgId: "org-1", role: "owner", permissions: [...getRolePermissions("owner")] };
}

function sessionActor() {
  return { userId: "user-1", orgId: "org-1", role: "owner" as const };
}

async function askDraft(requestId: string, provider: AthenaProviderAdapter, env: NodeJS.ProcessEnv = draftEnv) {
  const service = new AthenaKernelService();
  return service.handleRequest({
    request: { message: "What is the status of this project this week?", requestSource: "http" },
    actor: kernelActor(),
    requestId,
    env,
    provider,
  });
}

describe("Athena chat transaction split (Fluid PR-4)", () => {
  beforeEach(() => {
    executions.clear();
    transitions.length = 0;
    telemetryRows.length = 0;
    generationRows.length = 0;
    auditRows.length = 0;
    jest.clearAllMocks();
    athenaExecutionCreate.mockImplementation(defaultAthenaExecutionCreate);
    athenaExecutionUpdate.mockImplementation(defaultAthenaExecutionUpdate);
    athenaExecutionFindFirst.mockImplementation(defaultAthenaExecutionFindFirst);
    athenaExecutionTransitionCreate.mockImplementation(defaultAthenaExecutionTransitionCreate);
    athenaTelemetryRecordCreate.mockImplementation(defaultAthenaTelemetryRecordCreate);
    athenaTelemetryRecordCreateMany.mockImplementation(defaultAthenaTelemetryRecordCreateMany);
    athenaGenerationRunCreate.mockImplementation(defaultAthenaGenerationRunCreate);
    athenaAuditEventCreate.mockImplementation(defaultAthenaAuditEventCreate);
    athenaAuditEventCreateMany.mockImplementation(defaultAthenaAuditEventCreateMany);
    athenaAuditEventFindFirst.mockImplementation(async () => null);
    athenaSpendQueryRaw.mockImplementation(defaultAthenaSpendQueryRaw);
    openTransactions = 0;
    maxOpenTransactions = 0;
    setConfigCalls.length = 0;
  });

  it("holds no transaction while the provider is awaited, and the execution record is already committed", async () => {
    let releaseProvider!: (result: { text: string; provider: string; model: string; providerVersion: string }) => void;
    let providerCalledResolve!: () => void;
    const providerCalled = new Promise<void>((resolve) => {
      providerCalledResolve = resolve;
    });
    const provider: AthenaProviderAdapter = {
      generateDraft: jest.fn(() => {
        providerCalledResolve();
        return new Promise((resolve) => {
          releaseProvider = resolve;
        });
      }),
    };

    const resultPromise = runWithSessionActor(sessionActor(), () => askDraft("req-tx-split", provider));
    await providerCalled;

    // The headline property: during the provider wait, no transaction is
    // open at all — the pool connection was released when the last short
    // persist committed. Before PR-4 the request-scoped transaction stayed
    // open (and held its connection) for the whole provider wait.
    expect(openTransactions).toBe(0);
    expect(provider.generateDraft).toHaveBeenCalledTimes(1);
    // ...and the execution record is already committed and visible, not
    // hidden inside an uncommitted request transaction.
    expect(executions.size).toBe(1);
    const [execution] = [...executions.values()];
    expect(execution.orgId).toBe("org-1");
    expect(execution.actorUserId).toBe("user-1");
    expect(["created", "context_building", "routing", "planning", "policy_check"]).toContain(execution.state);
    // Every persist so far ran under the controller's actor.
    expect(setConfigCalls.length).toBeGreaterThan(0);
    expect(setConfigCalls.every((call) => call.values[0] === "user-1" && call.values[1] === "org-1" && call.values[2] === "owner")).toBe(true);

    releaseProvider({ text: "Here is your draft.", provider: "fake", model: "athena-fake-v1", providerVersion: "1.0.0" });
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.state).toBe("succeeded");
    expect(result.message).toBe("Here is your draft.");
    expect(executions.get(result.executionId)?.state).toBe("succeeded");
    expect(generationRows).toHaveLength(1);
    expect(generationRows[0]?.orgId).toBe("org-1");
    expect(generationRows[0]?.executionId).toBe(result.executionId);
    expect(openTransactions).toBe(0);
  });

  it("opens one short RLS session per persist carrying the controller's actor, and none without an actor", async () => {
    await runWithSessionActor(sessionActor(), () =>
      createExecutionRecord({
        executionId: "exec-actor",
        orgId: "org-1",
        requestId: "req-actor",
        traceId: "trace-actor",
        actorUserId: "user-1",
        canonicalRole: "owner",
        requestSource: "http",
      })
    );

    // The execution + its initial transition share one short transaction...
    expect(maxOpenTransactions).toBe(1);
    expect(openTransactions).toBe(0);
    // ...whose session carries exactly the controller's actor.
    expect(setConfigCalls).toHaveLength(1);
    expect(setConfigCalls[0]?.values).toEqual(["user-1", "org-1", "owner", "http"]);
    expect(executions.get("exec-actor")).toBeDefined();
    expect(transitions).toHaveLength(1);

    // Without an actor there is no session to establish: the persist still
    // runs (bare transaction), but no set_config is issued and RLS fails
    // closed on the real database.
    await createExecutionRecord({
      executionId: "exec-no-actor",
      orgId: "org-1",
      requestId: "req-no-actor",
      traceId: "trace-no-actor",
      actorUserId: "user-1",
      canonicalRole: "owner",
      requestSource: "http",
    });
    expect(setConfigCalls).toHaveLength(1);
    expect(executions.get("exec-no-actor")).toBeDefined();
  });

  it("records audit events in a short RLS session from the controller's actor", async () => {
    const store = createPrismaAthenaAuditStore();
    const event: AthenaAuditEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      actor: { userId: "user-1", role: "owner" },
      organization: "org-1",
      eventType: "failure",
      metadata: { outcome: "denied" },
      requestId: "req-audit",
      traceId: "trace-audit",
      executionId: "exec-audit",
    };

    await runWithSessionActor(sessionActor(), () => store.record(event));

    expect(setConfigCalls).toHaveLength(1);
    expect(setConfigCalls[0]?.values).toEqual(["user-1", "org-1", "owner", "http"]);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.orgId).toBe("org-1");
  });

  it("records audit events on an explicitly supplied database without opening a global transaction", async () => {
    // CodeRabbit Minor + Codex P2 on PR #1168: createPrismaAthenaAuditStore
    // with an injected transaction client (resolveAuthContext's direct
    // basePrisma.$transaction, which is not registered in the async-local
    // request context) must not open a second transaction on basePrisma —
    // with connection_limit=1 that acquisition times out while the
    // caller's transaction holds the only connection, and the best-effort
    // audit event is silently dropped. The correlation lookup and the
    // insert both run on the supplied client, with no actor or session.
    const store = createPrismaAthenaAuditStore(fakeTx as unknown as Parameters<typeof createPrismaAthenaAuditStore>[0]);
    const event: AthenaAuditEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      actor: { userId: "user-1", role: "owner" },
      organization: "org-1",
      eventType: "execution_completed",
      metadata: { outcome: "succeeded" },
      requestId: "req-audit-injected",
      traceId: "trace-audit-injected",
      executionId: "exec-audit-injected",
    };

    await store.record(event);

    expect(openTransactions).toBe(0);
    expect(setConfigCalls).toHaveLength(0);
    expect(athenaAuditEventFindFirst).toHaveBeenCalledTimes(1);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.orgId).toBe("org-1");
  });

  it("partial failure (5b): a failed tool action rolls its business write back instead of committing it", async () => {
    // Codex P1 on PR #1168: executeAthenaAction converts a tool exception
    // into a failed outcome instead of rejecting, so the short transaction
    // wrapping the action used to commit the tool's partial write (a draft
    // estimate without its required event). The kernel now throws inside
    // the transaction on a failed/expired/cancelled outcome and recovers
    // the outcome outside it, so the failure handling still runs.
    const toolRegistry = createAthenaToolRegistry();
    let executeCount = 0;
    const tool = createEchoFixtureTool({ id: "tradeos.athena.fixture.failing-write", permissions: [], risk: "low" });
    toolRegistry.register({
      ...tool,
      execute: async (_input, _aiContext, execution) => {
        executeCount += 1;
        // Business write inside the action transaction: the draft the tool
        // creates before its event persist fails.
        const db = getRequestDatabaseClient() as unknown as typeof fakeTx | undefined;
        await db?.athenaExecution.create({
          data: { id: "exec-tool-business-write", orgId: "org-1", actorUserId: "user-1", canonicalRole: "owner", state: "created" },
        });
        return {
          success: false,
          summary: "Tool failed after writing.",
          data: null,
          events: [],
          warnings: [],
          followUps: [],
          telemetry: { traceId: execution.traceId, executionId: execution.executionId },
          error: { code: "athena_tool_failed", category: "service", retryable: false, safeSummary: "The tool failed.", correlationId: execution.traceId },
        };
      },
    });

    const service = new AthenaKernelService();
    const result = await runWithSessionActor(sessionActor(), () =>
      service.handleRequest({
        request: { message: "What is the status of this project?", requestSource: "http" },
        actor: kernelActor(),
        requestId: "req-partial-5b",
        env: { ...baseEnv, ATHENA_ROUTER_PLANNER_ENABLED: "true", ATHENA_ACTION_ENGINE_ENABLED: "true" } as NodeJS.ProcessEnv,
        toolRegistry,
        candidateTools: [{ toolId: "tradeos.athena.fixture.failing-write", toolVersion: "1.0.0", summary: "Failing tool.", input: { message: "hi" } }],
      })
    );

    expect(executeCount).toBe(1);
    expect(result.success).toBe(false);
    expect(result.state).toBe("failed");
    // The tool's write rolled back with the action transaction...
    expect(executions.get("exec-tool-business-write")).toBeUndefined();
    // ...while the kernel's own execution record finalized failed in its
    // own short transaction, so the failure stays observable.
    expect(executions.get(result.executionId)?.state).toBe("failed");
  });

  it("partial failure (1): a later persist failure leaves an orphaned non-terminal execution instead of rolling the request back", async () => {
    // Fluid PR-5 moves the failure point: intermediate transitions no
    // longer persist, so a failing execution update is first hit at the
    // terminal transition — after the provider call and the generation
    // persist. The execution record committed in its own short transaction
    // before that, so it survives — non-terminal, visible for diagnosis —
    // and the generation row persists too. Before PR-4 the whole request
    // transaction rolled back and no trace remained; before PR-5 the same
    // failure struck the first intermediate transition and the provider
    // was never reached.
    athenaExecutionUpdate.mockImplementation(async () => {
      throw new Error("database write failed");
    });
    const provider: AthenaProviderAdapter = { generateDraft: jest.fn(async () => ({ text: "Here is your draft.", provider: "fake", model: "athena-fake-v1", providerVersion: "1.0.0" })) };
    const service = new AthenaKernelService();

    await expect(
      runWithSessionActor(sessionActor(), () =>
        service.handleRequest({
          request: { message: "What is the status of this project this week?", requestSource: "http" },
          actor: kernelActor(),
          requestId: "req-partial-1",
          env: draftEnv,
          provider,
        })
      )
    ).rejects.toThrow("database write failed");

    // The provider was reached (no persist happens before it anymore) and
    // its generation committed before the terminal transition failed.
    expect(provider.generateDraft).toHaveBeenCalledTimes(1);
    expect(generationRows).toHaveLength(1);
    expect(executions.size).toBe(1);
    const [execution] = [...executions.values()];
    expect(execution.state).toBe("created");
    // Only the creation transition committed; the failing terminal
    // transition's create rolled back with its update (one short
    // transaction per pair), and the catch block's terminal retry failed
    // the same way.
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ fromState: null, toState: "created" });
  });

  it("partial failure (2): a generation persisted then finalize fails leaves a generation without a succeeded execution", async () => {
    await runWithSessionActor(sessionActor(), () =>
      createExecutionRecord({
        executionId: "exec-partial-2",
        orgId: "org-1",
        requestId: "req-partial-2",
        traceId: "trace-partial-2",
        actorUserId: "user-1",
        canonicalRole: "owner",
        requestSource: "http",
      })
    );
    await runWithSessionActor(sessionActor(), () =>
      persistGenerationRecord({
        orgId: "org-1",
        actorUserId: "user-1",
        executionId: "exec-partial-2",
        requestId: "req-partial-2",
        traceId: "trace-partial-2",
        provider: "fake",
        model: "athena-fake-v1",
        status: "succeeded",
        latencyMs: 5,
        retentionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
    );
    expect(generationRows).toHaveLength(1);

    athenaExecutionUpdate.mockImplementation(async () => {
      throw new Error("database write failed");
    });
    await expect(
      runWithSessionActor(sessionActor(), () =>
        finalizeExecutionRecord({ executionId: "exec-partial-2", safeSummary: "done" })
      )
    ).rejects.toThrow("database write failed");

    // The generation row committed in its own short transaction and stays;
    // the execution was never finalized, so it has no succeeded state.
    expect(generationRows).toHaveLength(1);
    expect(generationRows[0]?.executionId).toBe("exec-partial-2");
    expect(executions.get("exec-partial-2")?.state).toBe("created");
  });

  it("partial failure (3): a generation persist failure after a successful provider call finalizes the execution as failed with no generation row", async () => {
    athenaGenerationRunCreate.mockRejectedValueOnce(new Error("generation persist failed"));
    const provider: AthenaProviderAdapter = {
      generateDraft: jest.fn(async () => ({ text: "Here is your draft.", provider: "fake", model: "athena-fake-v1", providerVersion: "1.0.0" })),
    };

    const result = await runWithSessionActor(sessionActor(), () => askDraft("req-partial-3", provider));

    // The persist error surfaces as a failed draft (it is not swallowed),
    // the execution is finalized failed so the failure is observable, and
    // no generation row exists — the daily spend cap therefore misses this
    // call's spend. Before PR-4 the same failure also rolled the execution
    // record back, leaving nothing at all.
    expect(result.success).toBe(false);
    expect(result.state).toBe("failed");
    expect(executions.get(result.executionId)?.state).toBe("failed");
    expect(generationRows).toHaveLength(0);
  });

  it("partial failure (4): a failed telemetry write never fails the draft", async () => {
    // Fluid PR-5: spans flush in one createMany after the response is
    // determined, so the failure is mocked on the batch call — the draft
    // still succeeds and the execution still finalizes.
    athenaTelemetryRecordCreateMany.mockRejectedValue(new Error("telemetry down"));
    const provider: AthenaProviderAdapter = {
      generateDraft: jest.fn(async () => ({ text: "Here is your draft.", provider: "fake", model: "athena-fake-v1", providerVersion: "1.0.0" })),
    };

    const result = await runWithSessionActor(sessionActor(), () => askDraft("req-partial-4", provider));

    expect(result.success).toBe(true);
    expect(result.state).toBe("succeeded");
    expect(executions.get(result.executionId)?.state).toBe("succeeded");
    expect(generationRows).toHaveLength(1);
  });

  it("partial failure (6): a failed spend-cap read fails the draft without rolling back earlier writes", async () => {
    athenaSpendQueryRaw.mockRejectedValueOnce(new Error("spend read down"));
    const provider = new GoogleGeminiAthenaProvider({ GEMINI_API_KEY: "test-key" } as NodeJS.ProcessEnv);
    const generateDraft = jest.spyOn(provider, "generateDraft");

    const result = await runWithSessionActor(sessionActor(), () => askDraft("req-partial-6", provider));

    // The cap read is the gate before the provider call, so the provider is
    // never reached — and the execution record + transitions committed
    // before the read stay persisted as a failed execution.
    expect(generateDraft).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.state).toBe("failed");
    expect(executions.get(result.executionId)?.state).toBe("failed");
    expect(transitions.length).toBeGreaterThan(0);
    expect(generationRows).toHaveLength(0);
  });

  it("partial failure (8): a deadline exceeded around the provider wait leaves a persisted terminal execution", async () => {
    // The provider race is capped at min(request deadline, provider
    // deadline), so a wait that outlasts the provider deadline ends
    // "cancelled" (provider_timeout); a request deadline that elapses
    // before provider work begins ends "expired". Either way the terminal
    // record now persists for diagnosis — before PR-4 the timeout rolled
    // the whole request transaction back and no trace remained.
    const neverResolvingProvider: AthenaProviderAdapter = {
      generateDraft: () => new Promise(() => undefined),
    };
    const cancelled = await runWithSessionActor(sessionActor(), () =>
      askDraft("req-partial-8a", neverResolvingProvider, {
        ...draftEnv,
        ATHENA_PROVIDER_DEADLINE_MS: "20",
        ATHENA_REQUEST_DEADLINE_MS: "5000",
      } as NodeJS.ProcessEnv)
    );
    expect(cancelled.success).toBe(false);
    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.error?.code).toBe("athena_provider_timeout");
    expect(executions.get(cancelled.executionId)?.state).toBe("cancelled");
    expect(generationRows).toHaveLength(0);

    // Request deadline elapsed before provider work begins (deterministic
    // simulated clock, same pattern as the kernel's own expiry test).
    const originalNow = Date.now;
    let calls = 0;
    jest.spyOn(Date, "now").mockImplementation(() => 1_700_000_000_000 + calls++ * 20);
    try {
      const expired = await runWithSessionActor(sessionActor(), () =>
        askDraft("req-partial-8b", neverResolvingProvider, {
          ...draftEnv,
          ATHENA_REQUEST_DEADLINE_MS: "50",
        } as NodeJS.ProcessEnv)
      );
      expect(expired.success).toBe(false);
      expect(expired.state).toBe("expired");
      expect(expired.error?.code).toBe("athena_deadline_exceeded");
      expect(executions.get(expired.executionId)?.state).toBe("expired");
      expect(generationRows).toHaveLength(0);
    } finally {
      Date.now = originalNow;
    }
  }, 10_000);

  it("write coalescing (Fluid PR-5): a successful draft performs at most 8 Prisma writes", async () => {
    // Lever 3 change 3.3: one successful draft-only request used to perform
    // ~19 Prisma writes (execution create + initial transition, one
    // transition row + execution update per state hop, one telemetry row
    // per span, one audit row per event, one generation row, one finalize
    // update). Coalescing keeps the audit minimum — execution create,
    // terminal transition, terminal audit event, generation record — and
    // nothing else is cut: intermediate hops live only in memory and are
    // summarized on the terminal transition, telemetry spans and audit
    // events are buffered and flushed once each after the response is
    // determined. The count below is the honest kernel-boundary total: the
    // real Prisma audit store is injected, so its writes are counted too.
    // Baseline before PR-5 (same harness, same path): 21 writes.
    const provider: AthenaProviderAdapter = {
      generateDraft: jest.fn(async () => ({ text: "Here is your draft.", provider: "fake", model: "athena-fake-v1", providerVersion: "1.0.0" })),
    };
    const service = new AthenaKernelService();
    const result = await runWithSessionActor(sessionActor(), () =>
      service.handleRequest({
        request: { message: "What is the status of this project this week?", requestSource: "http" },
        actor: kernelActor(),
        requestId: "req-pr5-write-count",
        env: { ...draftEnv, ATHENA_ROUTER_PLANNER_ENABLED: "true" } as NodeJS.ProcessEnv,
        provider,
        auditStore: createPrismaAthenaAuditStore(),
      })
    );

    expect(result.success).toBe(true);
    expect(result.state).toBe("succeeded");

    const writeCalls =
      athenaExecutionCreate.mock.calls.length +
      athenaExecutionUpdate.mock.calls.length +
      athenaExecutionTransitionCreate.mock.calls.length +
      athenaTelemetryRecordCreate.mock.calls.length +
      athenaTelemetryRecordCreateMany.mock.calls.length +
      athenaGenerationRunCreate.mock.calls.length +
      athenaAuditEventCreate.mock.calls.length +
      athenaAuditEventCreateMany.mock.calls.length;
    expect(writeCalls).toBeLessThanOrEqual(8);

    // Audit minimum, with identical fields: the execution record is
    // terminal with its summary, and the generation record exists.
    const execution = executions.get(result.executionId);
    expect(execution?.state).toBe("succeeded");
    expect(execution?.safeSummary).toBe("Athena prepared a draft response.");
    expect(generationRows).toHaveLength(1);
    expect(generationRows[0]).toMatchObject({ orgId: "org-1", executionId: result.executionId, provider: "fake", model: "athena-fake-v1", status: "succeeded" });

    // Exactly two transition rows: the initial "created" row and the one
    // terminal row, which carries the skipped hops as its summary.
    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toMatchObject({ fromState: null, toState: "created", reasonCode: "execution_created" });
    expect(transitions[1]).toMatchObject({ fromState: "policy_check", toState: "succeeded", reasonCode: "draft_response_completed" });
    const trail = (transitions[1]?.metadataJson as { transitionTrail?: Array<{ fromState: string; toState: string; reasonCode: string }> } | undefined)?.transitionTrail;
    expect(trail?.map((hop) => hop.toState)).toEqual(["context_building", "routing", "planning", "policy_check"]);

    // Telemetry and audit rows are all still there — batched, not dropped:
    // one createMany per collection, zero single creates.
    expect(athenaTelemetryRecordCreate).not.toHaveBeenCalled();
    expect(athenaTelemetryRecordCreateMany).toHaveBeenCalledTimes(1);
    expect(telemetryRows.map((row) => row.spanType).sort()).toEqual(["approval", "context", "kernel", "model"]);
    expect(athenaAuditEventCreate).not.toHaveBeenCalled();
    expect(athenaAuditEventCreateMany).toHaveBeenCalledTimes(1);
    expect(auditRows.map((row) => row.eventType).sort()).toEqual(["context_gathered", "request_received", "tools_considered"]);
  });
});
