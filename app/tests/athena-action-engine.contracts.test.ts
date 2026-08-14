import { assertValidAthenaAction, assertValidAthenaActionResult } from "../modules/athena-action-engine/resultValidation";
import type { AthenaAction, AthenaActionResult } from "../modules/athena-action-engine/types";
import type { AthenaToolResult } from "../modules/athena-tool-registry/types";

function validAction(): AthenaAction {
  return {
    id: "action-1",
    version: "1.0.0",
    orgId: "org-1",
    actorUserId: "user-1",
    name: "Echo Fixture",
    toolId: "tradeos.athena.fixture.echo",
    toolVersion: "1.0.0",
    input: { message: "hello" },
    risk: "low",
    approvalRequirement: "not_required",
    idempotencyKey: "key-1",
    status: "succeeded",
    attempt: 1,
    executor: {
      kind: "tool",
      name: "Echo Fixture",
      category: "fixture",
      toolId: "tradeos.athena.fixture.echo",
      toolVersion: "1.0.0",
    },
    compensationPolicy: "none",
  };
}

function successToolResult(): AthenaToolResult {
  return {
    success: true,
    summary: "Echoed the provided message.",
    data: { echoed: "hello" },
    events: [],
    warnings: [],
    followUps: [],
    telemetry: { traceId: "trace-1", executionId: "exec-1" },
  };
}

function validActionResult(): AthenaActionResult {
  return {
    version: "1.0.0",
    actionId: "action-1",
    state: "succeeded",
    name: "Echo Fixture",
    toolId: "tradeos.athena.fixture.echo",
    toolVersion: "1.0.0",
    approvalRequirement: "not_required",
    idempotencyKey: "key-1",
    executor: {
      kind: "tool",
      name: "Echo Fixture",
      category: "fixture",
      toolId: "tradeos.athena.fixture.echo",
      toolVersion: "1.0.0",
    },
    compensationPolicy: "none",
    toolResult: successToolResult(),
  };
}

describe("athena:contracts - action (C005)", () => {
  it("accepts a conforming action", () => {
    expect(() => assertValidAthenaAction(validAction())).not.toThrow();
  });

  it("accepts an approval-required action with approvalId, checkpoint, and lastError present", () => {
    const withOptionalFields: AthenaAction = {
      ...validAction(),
      approvalRequirement: "required",
      approvalId: "approval-1",
      checkpoint: { stage: "running" },
      lastError: { code: "athena_action_timeout", category: "timeout", retryable: true, safeSummary: "Timed out.", correlationId: "trace-1" },
    };
    expect(() => assertValidAthenaAction(withOptionalFields)).not.toThrow();
  });

  it("accepts every documented status value", () => {
    for (const status of ["created", "pending", "running", "awaiting_approval", "partially_succeeded", "succeeded", "failed", "denied", "expired", "cancelled"] as const) {
      expect(() => assertValidAthenaAction({ ...validAction(), status })).not.toThrow();
    }
  });

  it("accepts every documented risk and compensation policy value", () => {
    for (const risk of ["low", "medium", "high"] as const) {
      expect(() => assertValidAthenaAction({ ...validAction(), risk })).not.toThrow();
    }
    for (const compensationPolicy of ["none", "compensating_action", "service_transaction", "draft_only"] as const) {
      expect(() => assertValidAthenaAction({ ...validAction(), compensationPolicy })).not.toThrow();
    }
  });

  it("accepts every documented approval requirement value", () => {
    for (const approvalRequirement of ["not_required", "required"] as const) {
      const status = approvalRequirement === "required" ? "awaiting_approval" : "succeeded";
      expect(() => assertValidAthenaAction({ ...validAction(), approvalRequirement, status })).not.toThrow();
    }
  });

  it("rejects an approval-required action that reached execution without an approval id", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), approvalRequirement: "required", status: "succeeded" })).toThrow(/approvalId/);
  });

  it("accepts an approval-required executed action when the approval id is present", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), approvalRequirement: "required", approvalId: "approval-1", status: "succeeded" })).not.toThrow();
  });

  it("rejects approval evidence when approval is not required", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), approvalId: "approval-1" })).toThrow(/not required/);
  });

  it("rejects an action missing a required key", () => {
    const { idempotencyKey: _idempotencyKey, ...rest } = validAction();
    expect(() => assertValidAthenaAction(rest)).toThrow(/idempotencyKey/);
  });

  it("rejects an action carrying an undocumented top-level key", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), extra: "not allowed" })).toThrow(/undocumented/);
  });

  it("rejects a wrong version string", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), version: "2.0.0" as never })).toThrow(/version/);
  });

  it("rejects an unknown status value", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), status: "in_progress" as never })).toThrow(/status/);
  });

  it("rejects an unknown risk value", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), risk: "critical" as never })).toThrow(/risk/);
  });

  it("rejects a non-positive attempt", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), attempt: 0 })).toThrow(/attempt/);
  });

  it("rejects an empty idempotencyKey", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), idempotencyKey: "" })).toThrow(/idempotencyKey/);
  });

  it("rejects an unsupported executor category", () => {
    expect(() => assertValidAthenaAction({ ...validAction(), executor: { ...validAction().executor, category: "billing" as never } })).toThrow(/executor\.category/);
  });
});

describe("athena:contracts - action result envelope", () => {
  it("accepts a conforming succeeded result", () => {
    expect(() => assertValidAthenaActionResult(validActionResult())).not.toThrow();
  });

  it("accepts a conforming result with planId/stepId present", () => {
    const withCorrelation: AthenaActionResult = { ...validActionResult(), planId: "plan-1", stepId: "step-1" };
    expect(() => assertValidAthenaActionResult(withCorrelation)).not.toThrow();
  });

  it("accepts every documented action state", () => {
    for (const state of ["created", "pending", "running", "awaiting_approval", "partially_succeeded", "succeeded", "failed", "denied", "expired", "cancelled"] as const) {
      expect(() => assertValidAthenaActionResult({ ...validActionResult(), state })).not.toThrow();
    }
  });

  it("accepts every documented approval requirement value on the result envelope", () => {
    for (const approvalRequirement of ["not_required", "required"] as const) {
      expect(() => assertValidAthenaActionResult({ ...validActionResult(), approvalRequirement })).not.toThrow();
    }
  });

  it("rejects a result missing a required key", () => {
    const { compensationPolicy: _compensationPolicy, ...rest } = validActionResult();
    expect(() => assertValidAthenaActionResult(rest)).toThrow(/compensationPolicy/);
  });

  it("rejects a result carrying an undocumented top-level key", () => {
    expect(() => assertValidAthenaActionResult({ ...validActionResult(), extra: "not allowed" })).toThrow(/undocumented/);
  });

  it("rejects an unknown state value", () => {
    expect(() => assertValidAthenaActionResult({ ...validActionResult(), state: "in_progress" as never })).toThrow(/state/);
  });

  it("rejects an unsupported result executor category", () => {
    expect(() => assertValidAthenaActionResult({ ...validActionResult(), executor: { ...validActionResult().executor, category: "billing" as never } })).toThrow(/executor\.category/);
  });

  it("rejects a malformed nested toolResult", () => {
    expect(() => assertValidAthenaActionResult({ ...validActionResult(), toolResult: { success: true } })).toThrow(/AthenaToolResult/);
  });

  it("accepts a shape-valid failed result with a successful nested result because state/result consistency is engine-owned", () => {
    expect(() => assertValidAthenaActionResult({ ...validActionResult(), state: "failed" })).not.toThrow();
  });
});
