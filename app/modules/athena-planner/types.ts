// C004 Planner (docs/athena/contracts/README.md). AthenaPlanStep is not
// spelled out anywhere in that doc (only the `steps: AthenaPlanStep[]`
// reference exists) - defined here as a discriminated union, the same
// pattern athena-permissions/types.ts uses for AthenaCapabilityRequest. This
// directly satisfies C004's own validation rule: "every step must reference
// a registered tool/version or a user question" - a third step shape is a
// type error here, not a silent runtime fallthrough.
export type AthenaPlanStatus = "draft" | "needs_clarification" | "awaiting_approval" | "ready" | "superseded" | "cancelled";

export type AthenaPlanStep =
  | { kind: "tool_call"; stepId: string; toolId: string; toolVersion: string; summary: string; input: unknown }
  | { kind: "clarifying_question"; stepId: string; question: string };

// C004 AthenaPlan v1.0.0, verbatim shape from docs/athena/contracts/README.md.
export interface AthenaPlan {
  version: "1.0.0";
  planId: string;
  status: AthenaPlanStatus;
  intent: string;
  risk: "low" | "medium" | "high";
  steps: AthenaPlanStep[];
  requiredApprovals: string[];
  assumptions: string[];
}

// A candidate tool the planner may reference - deliberately not the full
// AthenaToolDefinition (which carries an `execute` function the planner
// must never touch: "Planner ... must not: Invent tools or bypass policy",
// docs/athena/04-system-architecture/README.md). Only enough to verify the
// tool is real (via AthenaToolRegistry.resolve()) and describe the step.
export interface AthenaPlanCandidateTool {
  toolId: string;
  toolVersion: string;
  summary: string;
  input?: unknown;
}

export interface AthenaPlanRouterInput {
  intent: string;
  riskHint: "low" | "medium" | "high";
}
