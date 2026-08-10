import { AthenaPlan, AthenaPlanStep } from "./types";

const REQUIRED_KEYS = ["version", "planId", "status", "intent", "risk", "steps", "requiredApprovals", "assumptions"] as const;
const ALLOWED_KEYS = new Set<string>(REQUIRED_KEYS);

const VALID_STATUSES = new Set(["draft", "needs_clarification", "awaiting_approval", "ready", "superseded", "cancelled"]);
const VALID_RISKS = new Set(["low", "medium", "high"]);

const TOOL_CALL_KEYS = ["kind", "stepId", "toolId", "toolVersion", "summary", "input"] as const;
const CLARIFYING_QUESTION_KEYS = ["kind", "stepId", "question"] as const;

function assertValidPlanStep(value: unknown, index: number): asserts value is AthenaPlanStep {
  if (typeof value !== "object" || value === null) {
    throw new Error(`AthenaPlan.steps[${index}] must be an object`);
  }
  const step = value as Record<string, unknown>;

  if (step.kind === "tool_call") {
    for (const key of Object.keys(step)) {
      if (!(TOOL_CALL_KEYS as readonly string[]).includes(key)) {
        throw new Error(`AthenaPlan.steps[${index}] (tool_call) has an undocumented key: ${key}`);
      }
    }
    if (typeof step.stepId !== "string" || step.stepId.length === 0) {
      throw new Error(`AthenaPlan.steps[${index}].stepId must be a non-empty string`);
    }
    if (typeof step.toolId !== "string" || step.toolId.length === 0) {
      throw new Error(`AthenaPlan.steps[${index}].toolId must be a non-empty string`);
    }
    if (typeof step.toolVersion !== "string" || step.toolVersion.length === 0) {
      throw new Error(`AthenaPlan.steps[${index}].toolVersion must be a non-empty string`);
    }
    if (typeof step.summary !== "string" || step.summary.length === 0) {
      throw new Error(`AthenaPlan.steps[${index}].summary must be a non-empty string`);
    }
    if (!("input" in step)) {
      throw new Error(`AthenaPlan.steps[${index}] is missing required key: input`);
    }
    return;
  }

  if (step.kind === "clarifying_question") {
    for (const key of Object.keys(step)) {
      if (!(CLARIFYING_QUESTION_KEYS as readonly string[]).includes(key)) {
        throw new Error(`AthenaPlan.steps[${index}] (clarifying_question) has an undocumented key: ${key}`);
      }
    }
    if (typeof step.stepId !== "string" || step.stepId.length === 0) {
      throw new Error(`AthenaPlan.steps[${index}].stepId must be a non-empty string`);
    }
    if (typeof step.question !== "string" || step.question.length === 0) {
      throw new Error(`AthenaPlan.steps[${index}].question must be a non-empty string`);
    }
    return;
  }

  throw new Error(`AthenaPlan.steps[${index}].kind must be "tool_call" or "clarifying_question", got: ${String(step.kind)} - every step must reference a registered tool/version or a user question (C004)`);
}

// Runtime validator for C004 AthenaPlan, mirroring the "reject undocumented
// top-level key" posture already established by athena-tool-registry/
// resultEnvelope.ts (C003), athena-context-engine/resultValidation.ts
// (C010), and athena-permissions/resultValidation.ts (C007).
export function assertValidAthenaPlan(value: unknown): asserts value is AthenaPlan {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaPlan must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`AthenaPlan has an undocumented top-level key: ${key}`);
    }
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaPlan is missing required key: ${key}`);
    }
  }

  if (candidate.version !== "1.0.0") {
    throw new Error('AthenaPlan.version must be "1.0.0"');
  }
  if (typeof candidate.planId !== "string" || candidate.planId.length === 0) {
    throw new Error("AthenaPlan.planId must be a non-empty string");
  }
  if (typeof candidate.status !== "string" || !VALID_STATUSES.has(candidate.status)) {
    throw new Error(`AthenaPlan.status is not a known status: ${String(candidate.status)}`);
  }
  if (typeof candidate.intent !== "string" || candidate.intent.length === 0) {
    throw new Error("AthenaPlan.intent must be a non-empty string");
  }
  if (typeof candidate.risk !== "string" || !VALID_RISKS.has(candidate.risk)) {
    throw new Error(`AthenaPlan.risk is not a known risk: ${String(candidate.risk)}`);
  }
  if (!Array.isArray(candidate.steps)) {
    throw new Error("AthenaPlan.steps must be an array");
  }
  candidate.steps.forEach((step, index) => assertValidPlanStep(step, index));
  if (!Array.isArray(candidate.requiredApprovals) || candidate.requiredApprovals.some((entry) => typeof entry !== "string")) {
    throw new Error("AthenaPlan.requiredApprovals must be an array of strings");
  }
  if (!Array.isArray(candidate.assumptions) || candidate.assumptions.some((entry) => typeof entry !== "string")) {
    throw new Error("AthenaPlan.assumptions must be an array of strings");
  }
}
