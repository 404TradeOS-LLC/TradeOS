import { assertValidAthenaPlan } from "../modules/athena-planner/resultValidation";
import type { AthenaPlan } from "../modules/athena-planner/types";

// Backs the `athena:contracts` gate alongside the kernel/tool-registry/
// context-engine/permissions contract tests. Exercises the exact
// assertValidAthenaPlan function buildAthenaPlan()'s callers should
// validate against, not a test-only duplicate (C004, docs/athena/contracts/README.md).
function validPlan(): AthenaPlan {
  return {
    version: "1.0.0",
    planId: "plan-1",
    status: "ready",
    intent: "draft_response",
    risk: "low",
    steps: [],
    requiredApprovals: [],
    assumptions: [],
  };
}

describe("athena:contracts - plan (C004)", () => {
  it("accepts a conforming plan with no steps", () => {
    expect(() => assertValidAthenaPlan(validPlan())).not.toThrow();
  });

  it("accepts a conforming plan with a tool_call step", () => {
    const plan: AthenaPlan = { ...validPlan(), status: "draft", steps: [{ kind: "tool_call", stepId: "step-1", toolId: "tradeos.athena.fixture.echo", toolVersion: "1.0.0", summary: "Echo.", input: {} }] };
    expect(() => assertValidAthenaPlan(plan)).not.toThrow();
  });

  it("accepts a conforming plan with a clarifying_question step", () => {
    const plan: AthenaPlan = { ...validPlan(), status: "needs_clarification", steps: [{ kind: "clarifying_question", stepId: "step-1", question: "What job?" }] };
    expect(() => assertValidAthenaPlan(plan)).not.toThrow();
  });

  it("accepts every documented status value", () => {
    for (const status of ["draft", "needs_clarification", "awaiting_approval", "ready", "superseded", "cancelled"] as const) {
      expect(() => assertValidAthenaPlan({ ...validPlan(), status })).not.toThrow();
    }
  });

  it("accepts every documented risk value", () => {
    for (const risk of ["low", "medium", "high"] as const) {
      expect(() => assertValidAthenaPlan({ ...validPlan(), risk })).not.toThrow();
    }
  });

  it("rejects a plan missing a required key", () => {
    const { assumptions: _assumptions, ...rest } = validPlan();
    expect(() => assertValidAthenaPlan(rest)).toThrow(/assumptions/);
  });

  it("rejects a plan carrying an undocumented top-level key", () => {
    const withExtra = { ...validPlan(), extra: "not allowed" };
    expect(() => assertValidAthenaPlan(withExtra)).toThrow(/undocumented/);
  });

  it("rejects a wrong version string", () => {
    expect(() => assertValidAthenaPlan({ ...validPlan(), version: "2.0.0" as never })).toThrow(/version/);
  });

  it("rejects an unknown status value", () => {
    expect(() => assertValidAthenaPlan({ ...validPlan(), status: "in_progress" as never })).toThrow(/status/);
  });

  it("rejects an unknown risk value", () => {
    expect(() => assertValidAthenaPlan({ ...validPlan(), risk: "critical" as never })).toThrow(/risk/);
  });

  it("rejects an empty intent string", () => {
    expect(() => assertValidAthenaPlan({ ...validPlan(), intent: "" })).toThrow(/intent/);
  });

  it("rejects a step whose kind is neither tool_call nor clarifying_question - every step must reference a registered tool/version or a user question", () => {
    const invalid = { ...validPlan(), steps: [{ kind: "free_text_action", stepId: "step-1" }] };
    expect(() => assertValidAthenaPlan(invalid)).toThrow(/tool_call.*clarifying_question|clarifying_question.*tool_call/);
  });

  it("rejects a tool_call step missing toolVersion", () => {
    const invalid = { ...validPlan(), status: "draft", steps: [{ kind: "tool_call", stepId: "step-1", toolId: "x", summary: "s", input: {} }] };
    expect(() => assertValidAthenaPlan(invalid)).toThrow(/toolVersion/);
  });

  it("rejects a tool_call step carrying an undocumented key", () => {
    const invalid = { ...validPlan(), status: "draft", steps: [{ kind: "tool_call", stepId: "step-1", toolId: "x", toolVersion: "1.0.0", summary: "s", input: {}, risk: "high" }] };
    expect(() => assertValidAthenaPlan(invalid)).toThrow(/undocumented/);
  });

  it("rejects a clarifying_question step missing question", () => {
    const invalid = { ...validPlan(), status: "needs_clarification", steps: [{ kind: "clarifying_question", stepId: "step-1" }] };
    expect(() => assertValidAthenaPlan(invalid)).toThrow(/question/);
  });

  it("rejects a non-array requiredApprovals", () => {
    expect(() => assertValidAthenaPlan({ ...validPlan(), requiredApprovals: "none" as never })).toThrow(/requiredApprovals/);
  });
});
