import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createInMemoryAthenaApprovalStore } from "../modules/athena-action-engine/approval";
import type { AthenaApprovalRecord, AthenaApprovalStore } from "../modules/athena-action-engine/approval";
import { executeAthenaAction } from "../modules/athena-action-engine/engine";
import { createInMemoryAthenaIdempotencyStore } from "../modules/athena-action-engine/idempotency";
import { computeCanonicalInputHash } from "../modules/athena-action-engine/inputHash";
import { assertValidAthenaAction } from "../modules/athena-action-engine/resultValidation";
import type { AthenaActionExecutionRequest } from "../modules/athena-action-engine/types";
import { buildMinimalAthenaContext } from "../modules/athena-kernel/context";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";
import { createHangingFixtureTool } from "../modules/athena-tool-registry/fixtures/hangingFixtureTool";
import type { AthenaToolDefinition } from "../modules/athena-tool-registry/types";
import type { AthenaPermissionDecision } from "../modules/athena-permissions/types";

// A6 engine tests (docs/athena/roadmap/A6-action-engine-implementation-plan.md
// "Required tests"). Exercises executeAthenaAction() directly rather than
// through the kernel, mirroring athena-tool-registry.dispatcher.test.ts's
// posture of testing the dispatch seam in isolation. Kernel-level wiring
// (flag on/off, end-to-end denial/execution through AthenaKernelService) is
// covered separately in athena-kernel.service.test.ts's "A6 action engine"
// describe block.

const DEFAULT_INPUT = { message: "hello" };

function allowDecision(overrides: Partial<AthenaPermissionDecision> = {}): AthenaPermissionDecision {
  return {
    version: "1.0.0",
    orgId: "org-1",
    userId: "user-1",
    role: "owner",
    permissions: [],
    capability: "tradeos.athena.fixture.echo",
    deniedFields: [],
    decision: "allow",
    reasonCode: "athena_permission_allowed",
    ...overrides,
  };
}

function denyDecision(overrides: Partial<AthenaPermissionDecision> = {}): AthenaPermissionDecision {
  return allowDecision({ decision: "deny", reasonCode: "athena_permission_denied_missing_permission", ...overrides });
}

function approvalRequiredDecision(overrides: Partial<AthenaPermissionDecision> = {}): AthenaPermissionDecision {
  return allowDecision({ decision: "approval_required", reasonCode: "athena_permission_approval_required_risk_high", ...overrides });
}

function buildRequest(overrides: Partial<AthenaActionExecutionRequest> = {}): AthenaActionExecutionRequest {
  const executionId = randomUUID();
  const traceId = randomUUID();
  const requestId = randomUUID();
  const aiContext = buildMinimalAthenaContext({
    requestId,
    traceId,
    executionId,
    actor: { userId: "user-1", orgId: "org-1", role: "owner", permissions: [] },
    request: { message: "run the fixture tool", requestSource: "test" },
  });
  return {
    planId: "plan-1",
    stepId: "step-1",
    requestId,
    traceId,
    executionId,
    orgId: "org-1",
    actor: { type: "user", id: "user-1" },
    role: "owner",
    toolId: "tradeos.athena.fixture.echo",
    toolVersion: "1.0.0",
    input: DEFAULT_INPUT,
    aiContext,
    permissionDecision: allowDecision(),
    featureFlags: [],
    ...overrides,
  };
}

// Builds an AthenaApprovalRecord bound to the same org/actor/tool/risk/
// idempotencyKey/input(hash)/plan/step buildRequest()'s defaults produce, so
// most tests only need to override the one field they're proving is
// enforced. approvedAt/expiresAt default to "already valid, not yet
// expired" using the real system clock - deliberately not relying on any
// injected fake clock for the common case (see approval.ts's own comment on
// why the clock seam still exists for the specific expiry test below).
function buildApprovalRecord(overrides: Partial<AthenaApprovalRecord> = {}): AthenaApprovalRecord {
  const now = Date.now();
  return {
    approvalId: "approval-1",
    orgId: "org-1",
    actorUserId: "user-1",
    toolId: "tradeos.athena.fixture.echo",
    toolVersion: "1.0.0",
    risk: "high",
    idempotencyKey: "key-1",
    inputHash: computeCanonicalInputHash(DEFAULT_INPUT),
    approvedAt: new Date(now - 1_000),
    expiresAt: new Date(now + 3_600_000),
    status: "granted",
    ...overrides,
  };
}

function grantedApprovalStore(overrides: Partial<AthenaApprovalRecord> = {}): AthenaApprovalStore {
  const store = createInMemoryAthenaApprovalStore();
  store.grant(buildApprovalRecord(overrides));
  return store;
}

describe("athena action engine - executeAthenaAction", () => {
  it("executes a registered low-risk fixture tool exactly once and returns a succeeded result", async () => {
    const registry = createAthenaToolRegistry();
    let executeCount = 0;
    registry.register(createEchoFixtureTool({ onExecuted: () => { executeCount += 1; } }));

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest());

    expect(executeCount).toBe(1);
    expect(outcome.result.state).toBe("succeeded");
    expect(outcome.result.toolResult.success).toBe(true);
    expect(outcome.result.toolResult.data).toEqual({ echoed: "hello" });
    expect(outcome.audit.reasonCode).toBe("executed");
    expect(outcome.result.toolId).toBe("tradeos.athena.fixture.echo");
    expect(outcome.result.toolVersion).toBe("1.0.0");

    // The engine materializes a real C005 AthenaAction record on every call,
    // not only in the contracts test's hand-built fixtures.
    expect(() => assertValidAthenaAction(outcome.action)).not.toThrow();
    expect(outcome.action.id).toBe(outcome.result.actionId);
    expect(outcome.action.status).toBe("succeeded");
    expect(outcome.action.orgId).toBe("org-1");
    expect(outcome.action.actorUserId).toBe("user-1");
    expect(outcome.action.risk).toBe("low");
  });

  it("never calls the handler when the A4 decision is deny", async () => {
    const registry = createAthenaToolRegistry();
    let executed = false;
    registry.register(createEchoFixtureTool({ onExecuted: () => { executed = true; } }));

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ permissionDecision: denyDecision() }));

    expect(executed).toBe(false);
    expect(outcome.result.state).toBe("denied");
    expect(outcome.result.toolResult.success).toBe(false);
    expect(outcome.result.toolResult.error?.category).toBe("authorization");
    expect(outcome.audit.reasonCode).toBe("permission_denied");
    expect(() => assertValidAthenaAction(outcome.action)).not.toThrow();
    expect(outcome.action.status).toBe("denied");
    expect(outcome.action.lastError?.category).toBe("authorization");
  });

  describe("permission decision binding", () => {
    // Blocker 1: an AthenaPermissionDecision is never trusted merely
    // because a caller attached it to this request - it must actually have
    // been issued for this exact org/actor/role/tool.

    it("fails closed when the decision's capability names a different tool than the one being executed", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.tool-a" }));
      registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.tool-b", onExecuted: () => { executed = true; } }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry },
        buildRequest({ toolId: "tradeos.athena.fixture.tool-b", permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.tool-a" }) })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("denied");
      expect(outcome.result.toolResult.success).toBe(false);
      expect(outcome.result.toolResult.error?.category).toBe("authorization");
      expect(outcome.audit.reasonCode).toBe("permission_decision_mismatch");
    });

    it("fails closed when the decision's userId does not match the requesting actor", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ onExecuted: () => { executed = true; } }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry },
        buildRequest({ actor: { type: "user", id: "user-1" }, permissionDecision: allowDecision({ userId: "user-2" }) })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("denied");
      expect(outcome.audit.reasonCode).toBe("permission_decision_mismatch");
    });

    it("fails closed when the decision's orgId does not match the request's org (cross-org decision reuse)", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ onExecuted: () => { executed = true; } }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry },
        buildRequest({ orgId: "org-1", permissionDecision: allowDecision({ orgId: "org-2" }) })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("denied");
      expect(outcome.audit.reasonCode).toBe("permission_decision_mismatch");
    });

    it("fails closed when the decision's role does not match the requesting actor's role", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ onExecuted: () => { executed = true; } }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry },
        buildRequest({ role: "owner", permissionDecision: allowDecision({ role: "technician" }) })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("denied");
      expect(outcome.audit.reasonCode).toBe("permission_decision_mismatch");
    });
  });

  it("always uses the registered tool's own risk for the action record - never a caller-influenced value", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.high-risk", risk: "high" }));
    const approvals = grantedApprovalStore({ toolId: "tradeos.athena.fixture.high-risk", risk: "high" });

    // AthenaActionExecutionRequest carries no `risk` field at all - this
    // simulates a caller bypassing the type system (deserialized/untyped
    // input) and attaching one anyway, to prove the engine still never
    // reads it.
    const maliciousRequest = {
      ...buildRequest({ toolId: "tradeos.athena.fixture.high-risk", permissionDecision: approvalRequiredDecision({ capability: "tradeos.athena.fixture.high-risk" }), approvalId: "approval-1", idempotencyKey: "key-1" }),
      risk: "low",
    } as AthenaActionExecutionRequest;

    const outcome = await executeAthenaAction({ toolRegistry: registry, approvalVerifier: approvals }, maliciousRequest);

    expect(outcome.result.state).toBe("succeeded");
    expect(outcome.action.risk).toBe("high");
  });

  describe("approval binding", () => {
    it("never calls the handler and never downgrades to allow when approval is required but no approvalId is supplied", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));

      const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ permissionDecision: approvalRequiredDecision() }));

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
      expect(outcome.result.toolResult.success).toBe(false);
      expect(outcome.audit.reasonCode).toBe("approval_missing");
    });

    it("never calls the handler when an approvalId is supplied but fails verification (fail-closed default verifier)", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry },
        buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-that-does-not-exist", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
      expect(outcome.audit.reasonCode).toBe("approval_missing");
    });

    it("executes the handler once a valid, correctly-bound approval is verified", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore();

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(true);
      expect(outcome.result.state).toBe("succeeded");
      expect(outcome.audit.reasonCode).toBe("executed");
    });

    it("rejects an approval granted for a different action (idempotencyKey mismatch) even with a matching tool/org", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore({ idempotencyKey: "key-for-a-different-action" });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("rejects an approval granted to a different org (cross-org approval reuse)", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore({ orgId: "some-other-org" });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1", orgId: "org-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("rejects an approval granted for a different actor - cannot be replayed by an unrelated user", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore({ actorUserId: "user-A" });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ actor: { type: "user", id: "user-B" }, permissionDecision: approvalRequiredDecision({ userId: "user-B" }), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("rejects an approval granted at a different risk classification than the tool now resolves to", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore({ risk: "medium" });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("rejects a stale approval past its expiresAt, even though its stored status still says granted", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore({ expiresAt: new Date(Date.now() - 60_000) });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("rejects a stale approval using an injected clock, without relying on a real sleep", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const grantTime = new Date("2026-01-01T00:00:00.000Z");
      const verifyTime = new Date("2026-01-01T02:00:00.000Z"); // 2h later, past a 1h expiry
      const store = createInMemoryAthenaApprovalStore({ now: () => verifyTime });
      store.grant(buildApprovalRecord({ approvedAt: grantTime, expiresAt: new Date(grantTime.getTime() + 3_600_000) }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: store },
        buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("rejects an approval bound to a different plan even with a matching tool/actor/key", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore({ planId: "plan-A", stepId: "step-A" });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ planId: "plan-B", stepId: "step-A", permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("rejects an approval bound to a different step even with a matching plan", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore({ planId: "plan-A", stepId: "step-A" });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ planId: "plan-A", stepId: "step-B", permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("accepts an approval not scoped to any specific plan/step for any plan/step", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      const approvals = grantedApprovalStore(); // no planId/stepId - not scoped

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ planId: "any-plan", stepId: "any-step", permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(true);
      expect(outcome.result.state).toBe("succeeded");
    });

    it("rejects the same approval/key when the actually-submitted input differs from what was approved", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
      // Approved for DEFAULT_INPUT's hash, but the caller submits different input.
      const approvals = grantedApprovalStore();

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ input: { message: "a different message than what was approved" }, permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(false);
      expect(outcome.result.state).toBe("awaiting_approval");
    });

    it("still verifies a valid approval when the submitted input is structurally identical but built with different object key insertion order", async () => {
      const registry = createAthenaToolRegistry();
      let executed = false;
      const recordInputSchema = z.object({ tags: z.record(z.string()) });
      const recordTool: AthenaToolDefinition = {
        ...createEchoFixtureTool({ id: "tradeos.athena.fixture.record-input", risk: "high" }),
        inputSchema: recordInputSchema,
        // Replaces the echo fixture's own execute() entirely (its input
        // shape doesn't match this record-typed schema), so onExecuted must
        // be called directly here instead of relying on the base fixture's
        // own onExecuted plumbing, which this override no longer calls.
        async execute(input, _aiContext, execution) {
          executed = true;
          return {
            success: true,
            summary: "ok",
            data: input,
            events: [],
            warnings: [],
            followUps: [],
            telemetry: { traceId: execution.traceId, executionId: execution.executionId },
          };
        },
      };
      registry.register(recordTool);

      // Approved for tags inserted a-then-b; the actual call inserts b-then-a.
      const approvedInput = { tags: { a: "1", b: "2" } };
      const submittedInput = { tags: { b: "2", a: "1" } };
      const approvals = grantedApprovalStore({ toolId: "tradeos.athena.fixture.record-input", inputHash: computeCanonicalInputHash(approvedInput) });

      const outcome = await executeAthenaAction(
        { toolRegistry: registry, approvalVerifier: approvals },
        buildRequest({ toolId: "tradeos.athena.fixture.record-input", input: submittedInput, permissionDecision: approvalRequiredDecision({ capability: "tradeos.athena.fixture.record-input" }), approvalId: "approval-1", idempotencyKey: "key-1" })
      );

      expect(executed).toBe(true);
      expect(outcome.result.state).toBe("succeeded");
    });
  });

  it("rejects invalid input before the handler runs", async () => {
    const registry = createAthenaToolRegistry();
    let executed = false;
    registry.register(createEchoFixtureTool({ onExecuted: () => { executed = true; } }));

    // Fails echoFixtureInputSchema's min(1) constraint.
    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ input: { message: "" } }));

    expect(executed).toBe(false);
    expect(outcome.result.state).toBe("failed");
    expect(outcome.result.toolResult.error?.category).toBe("validation");
    expect(outcome.audit.reasonCode).toBe("invalid_input");
  });

  it("fails closed for an unknown tool", async () => {
    const registry = createAthenaToolRegistry();

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.nope", permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.nope" }) }));

    expect(outcome.result.state).toBe("failed");
    expect(outcome.audit.reasonCode).toBe("tool_not_found");
  });

  it("fails closed for a removed tool", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool());
    registry.remove("tradeos.athena.fixture.echo", "1.0.0");

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest());

    expect(outcome.result.state).toBe("failed");
    expect(outcome.audit.reasonCode).toBe("tool_removed");
  });

  it("fails closed for the wrong tool version", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool({ version: "1.0.0" }));

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolVersion: "9.9.9" }));

    expect(outcome.result.state).toBe("failed");
    expect(outcome.audit.reasonCode).toBe("tool_version_not_found");
  });

  it("normalizes a thrown exception, never leaking internal details, and marks the action failed", async () => {
    const registry = createAthenaToolRegistry();
    const throwingTool: AthenaToolDefinition = {
      ...createEchoFixtureTool({ id: "tradeos.athena.fixture.throws" }),
      async execute() {
        throw new Error("DATABASE_URL=postgres://secret leaked internal detail");
      },
    };
    registry.register(throwingTool);

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.throws", permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.throws" }) }));

    expect(outcome.result.state).toBe("failed");
    expect(outcome.result.toolResult.error?.safeSummary).not.toMatch(/DATABASE_URL|secret/);
    expect(JSON.stringify(outcome.result)).not.toMatch(/DATABASE_URL|secret/);
    expect(outcome.audit.reasonCode).toBe("unexpected_error");
  });

  it("times out a non-cooperative tool and reports a distinct expired state, not an ordinary failure", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createHangingFixtureTool({ timeoutMs: 20 }));

    const outcome = await executeAthenaAction(
      { toolRegistry: registry },
      buildRequest({ toolId: "tradeos.athena.fixture.hanging", input: {}, permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.hanging" }) })
    );

    expect(outcome.result.state).toBe("expired");
    expect(outcome.result.toolResult.error?.code).toBe("athena_action_timeout");
    expect(outcome.audit.reasonCode).toBe("timeout");
  }, 10_000);

  it("aborts on client/request cancellation and reports cancelled, never success", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createHangingFixtureTool({ timeoutMs: 5_000 }));
    const controller = new AbortController();

    const outcomePromise = executeAthenaAction(
      { toolRegistry: registry },
      buildRequest({ toolId: "tradeos.athena.fixture.hanging", input: {}, permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.hanging" }), clientSignal: controller.signal })
    );
    controller.abort();
    const outcome = await outcomePromise;

    expect(outcome.result.state).toBe("cancelled");
    expect(outcome.result.toolResult.success).toBe(false);
    expect(outcome.audit.reasonCode).toBe("cancelled");
  });

  it("converts a malformed tool result into a safe invalid-result failure instead of returning it directly", async () => {
    const registry = createAthenaToolRegistry();
    const brokenTool: AthenaToolDefinition = {
      ...createEchoFixtureTool({ id: "tradeos.athena.fixture.broken" }),
      async execute() {
        return { success: true } as never;
      },
    };
    registry.register(brokenTool);

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.broken", permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.broken" }) }));

    expect(outcome.result.state).toBe("failed");
    expect(outcome.result.toolResult.error?.code).toBe("athena_action_invalid_result");
    expect(outcome.audit.reasonCode).toBe("invalid_result_envelope");
  });

  describe("idempotency", () => {
    function idempotencyTool(id: string, idempotency: AthenaToolDefinition["idempotency"], onExecuted: () => void): AthenaToolDefinition {
      return { ...createEchoFixtureTool({ id, onExecuted }), idempotency };
    }

    it("required: never calls the handler when no idempotency key is supplied", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-required", "required", () => { executeCount += 1; }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry },
        buildRequest({ toolId: "tradeos.athena.fixture.idem-required", permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.idem-required" }) })
      );

      expect(executeCount).toBe(0);
      expect(outcome.result.state).toBe("failed");
      expect(outcome.audit.reasonCode).toBe("idempotency_key_required");
    });

    it("required: a duplicate key does not execute the handler twice and returns the original result", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-required-dup", "required", () => { executeCount += 1; }));
      const store = createInMemoryAthenaIdempotencyStore();
      const decision = allowDecision({ capability: "tradeos.athena.fixture.idem-required-dup" });

      const first = await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-required-dup", permissionDecision: decision, idempotencyKey: "dup-key-1" }));
      const second = await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-required-dup", permissionDecision: decision, idempotencyKey: "dup-key-1" }));

      expect(executeCount).toBe(1);
      expect(first.result.state).toBe("succeeded");
      expect(second.result.state).toBe("succeeded");
      expect(second.result.actionId).toBe(first.result.actionId);
      expect(second.audit.reasonCode).toBe("idempotent_duplicate_suppressed");
    });

    it("optional: dedupes when a key is supplied", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-optional", "optional", () => { executeCount += 1; }));
      const store = createInMemoryAthenaIdempotencyStore();
      const decision = allowDecision({ capability: "tradeos.athena.fixture.idem-optional" });

      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-optional", permissionDecision: decision, idempotencyKey: "opt-key-1" }));
      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-optional", permissionDecision: decision, idempotencyKey: "opt-key-1" }));

      expect(executeCount).toBe(1);
    });

    it("optional: executes normally (no dedupe possible) when no key is supplied", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-optional-nokey", "optional", () => { executeCount += 1; }));

      const outcome = await executeAthenaAction(
        { toolRegistry: registry },
        buildRequest({ toolId: "tradeos.athena.fixture.idem-optional-nokey", permissionDecision: allowDecision({ capability: "tradeos.athena.fixture.idem-optional-nokey" }) })
      );

      expect(executeCount).toBe(1);
      expect(outcome.result.state).toBe("succeeded");
    });

    it("not_supported: callers cannot rely on deduplication - the same key executes the handler twice", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-not-supported", "not_supported", () => { executeCount += 1; }));
      const store = createInMemoryAthenaIdempotencyStore();
      const decision = allowDecision({ capability: "tradeos.athena.fixture.idem-not-supported" });

      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-not-supported", permissionDecision: decision, idempotencyKey: "same-key" }));
      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-not-supported", permissionDecision: decision, idempotencyKey: "same-key" }));

      expect(executeCount).toBe(2);
    });
  });
});
