import { assertValidAthenaToolResult } from "../athena-tool-registry/resultEnvelope";
import { AthenaAction, athenaActionStates, AthenaActionResult } from "./types";

const VALID_STATES = new Set<string>(athenaActionStates);
const VALID_RISKS = new Set(["low", "medium", "high"]);
const VALID_COMPENSATION_POLICIES = new Set(["none", "compensating_action", "service_transaction", "draft_only"]);
// Must stay in sync with AthenaErrorCategory (athena-kernel/types.ts) -
// mirrors athena-tool-registry/resultEnvelope.ts's own duplicated constant,
// same rationale (that module's comment on why it isn't imported from the
// kernel).
const VALID_ERROR_CATEGORIES = new Set(["validation", "authorization", "conflict", "timeout", "provider", "service", "unknown"]);

const VALID_APPROVAL_REQUIREMENTS = new Set(["not_required", "required"]);
const VALID_EXECUTOR_KINDS = new Set(["tool"]);

const ACTION_REQUIRED_KEYS = ["id", "version", "orgId", "actorUserId", "name", "toolId", "toolVersion", "input", "risk", "approvalRequirement", "idempotencyKey", "status", "attempt", "executor", "compensationPolicy"] as const;
const ACTION_ALLOWED_KEYS = new Set<string>([...ACTION_REQUIRED_KEYS, "approvalId", "checkpoint", "lastError"]);

// Runtime validator for C005 AthenaAction (docs/athena/contracts/README.md),
// mirroring the "reject undocumented top-level key" posture already
// established by every sibling Athena contract validator
// (athena-tool-registry/resultEnvelope.ts for C003, athena-permissions/
// resultValidation.ts for C007, athena-planner/resultValidation.ts for
// C004).
export function assertValidAthenaAction(value: unknown): asserts value is AthenaAction {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaAction must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of Object.keys(candidate)) {
    if (!ACTION_ALLOWED_KEYS.has(key)) {
      throw new Error(`AthenaAction has an undocumented top-level key: ${key}`);
    }
  }
  for (const key of ACTION_REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaAction is missing required key: ${key}`);
    }
  }

  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    throw new Error("AthenaAction.id must be a non-empty string");
  }
  if (candidate.version !== "1.0.0") {
    throw new Error('AthenaAction.version must be "1.0.0"');
  }
  if (typeof candidate.orgId !== "string" || candidate.orgId.length === 0) {
    throw new Error("AthenaAction.orgId must be a non-empty string");
  }
  if (typeof candidate.actorUserId !== "string" || candidate.actorUserId.length === 0) {
    throw new Error("AthenaAction.actorUserId must be a non-empty string");
  }
  if (typeof candidate.name !== "string" || candidate.name.length === 0) {
    throw new Error("AthenaAction.name must be a non-empty string");
  }
  if (typeof candidate.toolId !== "string" || candidate.toolId.length === 0) {
    throw new Error("AthenaAction.toolId must be a non-empty string");
  }
  if (typeof candidate.toolVersion !== "string" || candidate.toolVersion.length === 0) {
    throw new Error("AthenaAction.toolVersion must be a non-empty string");
  }
  if (!("input" in candidate)) {
    throw new Error("AthenaAction is missing required key: input");
  }
  if (typeof candidate.risk !== "string" || !VALID_RISKS.has(candidate.risk)) {
    throw new Error(`AthenaAction.risk is not a known risk: ${String(candidate.risk)}`);
  }
  if (typeof candidate.approvalRequirement !== "string" || !VALID_APPROVAL_REQUIREMENTS.has(candidate.approvalRequirement)) {
    throw new Error(`AthenaAction.approvalRequirement is not valid: ${String(candidate.approvalRequirement)}`);
  }
  if (typeof candidate.idempotencyKey !== "string" || candidate.idempotencyKey.length === 0) {
    throw new Error("AthenaAction.idempotencyKey must be a non-empty string");
  }
  if (typeof candidate.status !== "string" || !VALID_STATES.has(candidate.status)) {
    throw new Error(`AthenaAction.status is not a known status: ${String(candidate.status)}`);
  }
  if (typeof candidate.attempt !== "number" || candidate.attempt < 1) {
    throw new Error("AthenaAction.attempt must be a positive number");
  }
  if (typeof candidate.compensationPolicy !== "string" || !VALID_COMPENSATION_POLICIES.has(candidate.compensationPolicy)) {
    throw new Error(`AthenaAction.compensationPolicy is not valid: ${String(candidate.compensationPolicy)}`);
  }
  if (candidate.approvalId !== undefined && (typeof candidate.approvalId !== "string" || candidate.approvalId.length === 0)) {
    throw new Error("AthenaAction.approvalId must be a non-empty string when present");
  }
  if (candidate.checkpoint !== undefined && (typeof candidate.checkpoint !== "object" || candidate.checkpoint === null)) {
    throw new Error("AthenaAction.checkpoint must be an object when present");
  }
  if (typeof candidate.executor !== "object" || candidate.executor === null) {
    throw new Error("AthenaAction.executor must be an object");
  }
  const executor = candidate.executor as Record<string, unknown>;
  if (typeof executor.kind !== "string" || !VALID_EXECUTOR_KINDS.has(executor.kind)) {
    throw new Error(`AthenaAction.executor.kind is not valid: ${String(executor.kind)}`);
  }
  if (typeof executor.name !== "string" || executor.name.length === 0) {
    throw new Error("AthenaAction.executor.name must be a non-empty string");
  }
  if (typeof executor.category !== "string" || executor.category.length === 0) {
    throw new Error("AthenaAction.executor.category must be a non-empty string");
  }
  if (typeof executor.toolId !== "string" || executor.toolId.length === 0) {
    throw new Error("AthenaAction.executor.toolId must be a non-empty string");
  }
  if (typeof executor.toolVersion !== "string" || executor.toolVersion.length === 0) {
    throw new Error("AthenaAction.executor.toolVersion must be a non-empty string");
  }
  if (candidate.lastError !== undefined) {
    if (typeof candidate.lastError !== "object" || candidate.lastError === null) {
      throw new Error("AthenaAction.lastError must be an object when present");
    }
    const lastError = candidate.lastError as Record<string, unknown>;
    if (typeof lastError.code !== "string" || lastError.code.length === 0) {
      throw new Error("AthenaAction.lastError.code must be a non-empty string");
    }
    if (typeof lastError.category !== "string" || !VALID_ERROR_CATEGORIES.has(lastError.category)) {
      throw new Error(`AthenaAction.lastError.category is not a known category: ${String(lastError.category)}`);
    }
  }
}

const RESULT_REQUIRED_KEYS = ["version", "actionId", "state", "name", "toolId", "toolVersion", "approvalRequirement", "idempotencyKey", "executor", "compensationPolicy", "toolResult"] as const;
const RESULT_ALLOWED_KEYS = new Set<string>([...RESULT_REQUIRED_KEYS, "planId", "stepId"]);

// Runtime validator for the A6 AthenaActionResult envelope (not a numbered
// C0xx contract on its own - it wraps the already-validated C003
// AthenaToolResult - but held to the same undocumented-top-level-key
// posture as every other Athena result shape in this codebase).
export function assertValidAthenaActionResult(value: unknown): asserts value is AthenaActionResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaActionResult must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of Object.keys(candidate)) {
    if (!RESULT_ALLOWED_KEYS.has(key)) {
      throw new Error(`AthenaActionResult has an undocumented top-level key: ${key}`);
    }
  }
  for (const key of RESULT_REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaActionResult is missing required key: ${key}`);
    }
  }

  if (candidate.version !== "1.0.0") {
    throw new Error('AthenaActionResult.version must be "1.0.0"');
  }
  if (typeof candidate.actionId !== "string" || candidate.actionId.length === 0) {
    throw new Error("AthenaActionResult.actionId must be a non-empty string");
  }
  if (typeof candidate.state !== "string" || !VALID_STATES.has(candidate.state)) {
    throw new Error(`AthenaActionResult.state is not a known state: ${String(candidate.state)}`);
  }
  if (typeof candidate.name !== "string" || candidate.name.length === 0) {
    throw new Error("AthenaActionResult.name must be a non-empty string");
  }
  if (typeof candidate.toolId !== "string" || candidate.toolId.length === 0) {
    throw new Error("AthenaActionResult.toolId must be a non-empty string");
  }
  if (typeof candidate.toolVersion !== "string" || candidate.toolVersion.length === 0) {
    throw new Error("AthenaActionResult.toolVersion must be a non-empty string");
  }
  if (typeof candidate.approvalRequirement !== "string" || !VALID_APPROVAL_REQUIREMENTS.has(candidate.approvalRequirement)) {
    throw new Error(`AthenaActionResult.approvalRequirement is not valid: ${String(candidate.approvalRequirement)}`);
  }
  if (typeof candidate.idempotencyKey !== "string" || candidate.idempotencyKey.length === 0) {
    throw new Error("AthenaActionResult.idempotencyKey must be a non-empty string");
  }
  if (typeof candidate.executor !== "object" || candidate.executor === null) {
    throw new Error("AthenaActionResult.executor must be an object");
  }
  const executor = candidate.executor as Record<string, unknown>;
  if (typeof executor.kind !== "string" || !VALID_EXECUTOR_KINDS.has(executor.kind)) {
    throw new Error(`AthenaActionResult.executor.kind is not valid: ${String(executor.kind)}`);
  }
  if (typeof executor.name !== "string" || executor.name.length === 0) {
    throw new Error("AthenaActionResult.executor.name must be a non-empty string");
  }
  if (typeof executor.category !== "string" || executor.category.length === 0) {
    throw new Error("AthenaActionResult.executor.category must be a non-empty string");
  }
  if (typeof executor.toolId !== "string" || executor.toolId.length === 0) {
    throw new Error("AthenaActionResult.executor.toolId must be a non-empty string");
  }
  if (typeof executor.toolVersion !== "string" || executor.toolVersion.length === 0) {
    throw new Error("AthenaActionResult.executor.toolVersion must be a non-empty string");
  }
  if (typeof candidate.compensationPolicy !== "string" || !VALID_COMPENSATION_POLICIES.has(candidate.compensationPolicy)) {
    throw new Error(`AthenaActionResult.compensationPolicy is not valid: ${String(candidate.compensationPolicy)}`);
  }
  if (candidate.planId !== undefined && typeof candidate.planId !== "string") {
    throw new Error("AthenaActionResult.planId must be a string when present");
  }
  if (candidate.stepId !== undefined && typeof candidate.stepId !== "string") {
    throw new Error("AthenaActionResult.stepId must be a string when present");
  }

  // Reuses the exact C003 validator every other Athena tool-result caller
  // validates against, rather than a test-only duplicate (same posture as
  // athena-tool-registry/resultEnvelope.ts's own module comment).
  assertValidAthenaToolResult(candidate.toolResult);
}
