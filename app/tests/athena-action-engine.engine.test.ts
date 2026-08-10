import { randomUUID } from "node:crypto";
import { createInMemoryAthenaApprovalStore } from "../modules/athena-action-engine/approval";
import { executeAthenaAction } from "../modules/athena-action-engine/engine";
import { createInMemoryAthenaIdempotencyStore } from "../modules/athena-action-engine/idempotency";
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
    input: { message: "hello" },
    aiContext,
    risk: "low",
    permissionDecision: allowDecision(),
    featureFlags: [],
    ...overrides,
  };
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
    const approvals = createInMemoryAthenaApprovalStore();
    approvals.grant({ approvalId: "approval-1", orgId: "org-1", toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", idempotencyKey: "key-1", status: "granted" });

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
    const approvals = createInMemoryAthenaApprovalStore();
    approvals.grant({ approvalId: "approval-1", orgId: "org-1", toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", idempotencyKey: "key-for-a-different-action", status: "granted" });

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
    const approvals = createInMemoryAthenaApprovalStore();
    approvals.grant({ approvalId: "approval-1", orgId: "some-other-org", toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", idempotencyKey: "key-1", status: "granted" });

    const outcome = await executeAthenaAction(
      { toolRegistry: registry, approvalVerifier: approvals },
      buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1", orgId: "org-1" })
    );

    expect(executed).toBe(false);
    expect(outcome.result.state).toBe("awaiting_approval");
  });

  it("rejects a stale (expired) approval", async () => {
    const registry = createAthenaToolRegistry();
    let executed = false;
    registry.register(createEchoFixtureTool({ risk: "high", onExecuted: () => { executed = true; } }));
    const approvals = createInMemoryAthenaApprovalStore();
    approvals.grant({ approvalId: "approval-1", orgId: "org-1", toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", idempotencyKey: "key-1", status: "expired" });

    const outcome = await executeAthenaAction(
      { toolRegistry: registry, approvalVerifier: approvals },
      buildRequest({ permissionDecision: approvalRequiredDecision(), approvalId: "approval-1", idempotencyKey: "key-1" })
    );

    expect(executed).toBe(false);
    expect(outcome.result.state).toBe("awaiting_approval");
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

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.nope" }));

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

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.throws" }));

    expect(outcome.result.state).toBe("failed");
    expect(outcome.result.toolResult.error?.safeSummary).not.toMatch(/DATABASE_URL|secret/);
    expect(JSON.stringify(outcome.result)).not.toMatch(/DATABASE_URL|secret/);
    expect(outcome.audit.reasonCode).toBe("unexpected_error");
  });

  it("times out a non-cooperative tool and reports a distinct expired state, not an ordinary failure", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createHangingFixtureTool({ timeoutMs: 20 }));

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.hanging", input: {} }));

    expect(outcome.result.state).toBe("expired");
    expect(outcome.result.toolResult.error?.code).toBe("athena_action_timeout");
    expect(outcome.audit.reasonCode).toBe("timeout");
  }, 10_000);

  it("aborts on client/request cancellation and reports cancelled, never success", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createHangingFixtureTool({ timeoutMs: 5_000 }));
    const controller = new AbortController();

    const outcomePromise = executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.hanging", input: {}, clientSignal: controller.signal }));
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

    const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.broken" }));

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

      const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.idem-required" }));

      expect(executeCount).toBe(0);
      expect(outcome.result.state).toBe("failed");
      expect(outcome.audit.reasonCode).toBe("idempotency_key_required");
    });

    it("required: a duplicate key does not execute the handler twice and returns the original result", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-required-dup", "required", () => { executeCount += 1; }));
      const store = createInMemoryAthenaIdempotencyStore();

      const first = await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-required-dup", idempotencyKey: "dup-key-1" }));
      const second = await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-required-dup", idempotencyKey: "dup-key-1" }));

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

      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-optional", idempotencyKey: "opt-key-1" }));
      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-optional", idempotencyKey: "opt-key-1" }));

      expect(executeCount).toBe(1);
    });

    it("optional: executes normally (no dedupe possible) when no key is supplied", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-optional-nokey", "optional", () => { executeCount += 1; }));

      const outcome = await executeAthenaAction({ toolRegistry: registry }, buildRequest({ toolId: "tradeos.athena.fixture.idem-optional-nokey" }));

      expect(executeCount).toBe(1);
      expect(outcome.result.state).toBe("succeeded");
    });

    it("not_supported: callers cannot rely on deduplication - the same key executes the handler twice", async () => {
      const registry = createAthenaToolRegistry();
      let executeCount = 0;
      registry.register(idempotencyTool("tradeos.athena.fixture.idem-not-supported", "not_supported", () => { executeCount += 1; }));
      const store = createInMemoryAthenaIdempotencyStore();

      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-not-supported", idempotencyKey: "same-key" }));
      await executeAthenaAction({ toolRegistry: registry, idempotencyStore: store }, buildRequest({ toolId: "tradeos.athena.fixture.idem-not-supported", idempotencyKey: "same-key" }));

      expect(executeCount).toBe(2);
    });
  });
});
