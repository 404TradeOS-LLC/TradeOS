import { randomUUID } from "node:crypto";
import type { CanonicalRole, DomainPermission } from "../../domain";
import { canonicalRoles, getRolePermissions } from "../../domain";
import { createFailClosedAthenaApprovalVerifier, createInMemoryAthenaApprovalStore } from "../athena-action-engine/approval";
import { executeAthenaAction } from "../athena-action-engine/engine";
import { computeCanonicalInputHash } from "../athena-action-engine/inputHash";
import { buildMinimalAthenaContext } from "../athena-kernel/context";
import type { AthenaAIContext } from "../athena-kernel/types";
import { evaluateAthenaPermission } from "../athena-permissions/policy";
import { dispatchAthenaTool } from "../athena-tool-registry/dispatcher";
import { assertValidToolDefinition, createAthenaToolRegistry } from "../athena-tool-registry/registry";
import { assertValidAthenaToolResult } from "../athena-tool-registry/resultEnvelope";
import type { AthenaToolDefinition } from "./types";

// A9 reusable contract-test kit (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md "Contract-test kit"). Every assertion
// below exercises a real production boundary already built by an earlier
// milestone - A2's own assertValidToolDefinition/createAthenaToolRegistry/
// dispatchAthenaTool/assertValidAthenaToolResult, A4's own
// evaluateAthenaPermission, and A6's own executeAthenaAction/approval
// primitives - never a mock or a second copy of what any of them already
// enforce. describeAthenaToolContract() is a thin Jest `describe` wrapper
// around these exported functions; the functions are exported and callable
// on their own specifically so this module's own test suite
// (app/tests/athena-tool-sdk.contracts.test.ts) can prove a deliberately
// malformed fixture *fails* them (`expect(() => assertX(bad)).toThrow()`)
// without needing to nest a Jest suite designed to fail CI on purpose.

interface ZodLikeSchema {
  safeParse(input: unknown): { success: true; data: unknown } | { success: false };
}

function isZodLikeSchema(schema: unknown): schema is ZodLikeSchema {
  return !!schema && typeof (schema as ZodLikeSchema).safeParse === "function";
}

const DEFAULT_ROLE: CanonicalRole = "owner";
const DEFAULT_ORG_ID = "athena-tool-sdk-contract-org";
const DEFAULT_USER_ID = "athena-tool-sdk-contract-user";

export interface AthenaToolContractApprovalOptions {
  planId?: string;
  stepId?: string;
  idempotencyKey?: string;
}

export interface AthenaToolContractOptions<TInput> {
  role?: CanonicalRole;
  orgId?: string;
  userId?: string;
  validInput: TInput;
  // Each entry is dispatched and must be rejected at the runtime schema
  // boundary (athena_action_invalid_input). Omitting this entirely still
  // registers a Jest `it.todo` reminder rather than silently skipping
  // coverage - see describeAthenaToolContract().
  invalidInputs?: unknown[];
  featureFlags?: string[];
  // Supply only for a medium/high-risk tool, to exercise full A4→A6
  // execution with a real granted, correctly-bound approval. A low-risk
  // tool never needs this. See assertToolExecutesValidInput.
  approval?: AthenaToolContractApprovalOptions;
}

function buildContractAiContext(orgId: string, userId: string, role: CanonicalRole): { aiContext: AthenaAIContext; executionId: string; traceId: string; requestId: string } {
  const executionId = randomUUID();
  const traceId = randomUUID();
  const requestId = randomUUID();
  const aiContext = buildMinimalAthenaContext({
    requestId,
    traceId,
    executionId,
    actor: { userId, orgId, role, permissions: [...getRolePermissions(role)] },
    request: { message: "athena tool sdk contract suite", requestSource: "test" },
  });
  return { aiContext, executionId, traceId, requestId };
}

// Metadata/schema shape only - delegates to A2's own registration validator
// rather than a second copy of it.
export function assertToolDefinitionShape<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>): void {
  assertValidToolDefinition(tool as AthenaToolDefinition<unknown, unknown>);
}

// Proves the ordinary A2 registry accepts and resolves this definition with
// no SDK-specific registration path.
export function assertToolRegistersAndResolves<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>): void {
  const registry = createAthenaToolRegistry();
  registry.register(tool as AthenaToolDefinition<unknown, unknown>);
  const resolution = registry.resolve(tool.id, tool.version);
  if (resolution.outcome !== "found") {
    throw new Error(`Athena tool did not resolve after registration: ${tool.id}@${tool.version} (outcome: ${resolution.outcome})`);
  }
}

// Executes valid input through the real authority boundary for this tool's
// own declared risk - never a shortcut around either:
//
// - risk "low": A2's own dispatchAthenaTool(), the same function
//   app/tests/athena-tool-registry.dispatcher.test.ts exercises directly.
// - risk "medium"/"high": requires options.approval. Builds a real A4
//   AthenaPermissionDecision via evaluateAthenaPermission() and a real
//   granted, exact-payload-bound approval via
//   createInMemoryAthenaApprovalStore(), then runs A6's own
//   executeAthenaAction() - production execution authority, not a bypass.
//   Without options.approval this throws instructing the caller to supply
//   one or call assertToolRiskIsEnforced() instead - a medium/high-risk tool
//   is never force-executed here.
export async function assertToolExecutesValidInput<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>, options: AthenaToolContractOptions<TInput>): Promise<void> {
  const role = options.role ?? DEFAULT_ROLE;
  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  const userId = options.userId ?? DEFAULT_USER_ID;
  const featureFlags = options.featureFlags ?? tool.requiredFeatureFlags ?? [];

  if (tool.risk === "low") {
    const registry = createAthenaToolRegistry();
    registry.register(tool as AthenaToolDefinition<unknown, unknown>);
    const { aiContext, executionId, traceId, requestId } = buildContractAiContext(orgId, userId, role);
    const outcome = await dispatchAthenaTool(registry, {
      toolId: tool.id,
      version: tool.version,
      input: options.validInput,
      aiContext,
      actor: { type: "user", id: userId },
      role,
      orgId,
      requestId,
      traceId,
      executionId,
      featureFlags,
    });
    assertValidAthenaToolResult(outcome.result);
    if (outcome.audit.reasonCode !== "dispatched") {
      throw new Error(`Low-risk Athena tool "${tool.id}" did not reach execution for valid input (reasonCode: ${outcome.audit.reasonCode}). Confirm options.role/featureFlags grant every declared permission/requiredFeatureFlag.`);
    }
    return;
  }

  if (!options.approval) {
    throw new Error(`Athena tool "${tool.id}" declares risk "${tool.risk}"; pass options.approval to describeAthenaToolContract to exercise full A4/A6-authorized execution, or rely on assertToolRiskIsEnforced to prove it correctly does not execute without one.`);
  }
  if (!isZodLikeSchema(tool.inputSchema)) {
    throw new Error(`Athena tool "${tool.id}" inputSchema is not Zod-like; A2 requires this.`);
  }
  const parsedInput = tool.inputSchema.safeParse(options.validInput);
  if (!parsedInput.success) {
    throw new Error(`options.validInput did not pass "${tool.id}"'s own inputSchema.`);
  }

  const planId = options.approval.planId ?? randomUUID();
  const stepId = options.approval.stepId ?? randomUUID();
  const idempotencyKey = options.approval.idempotencyKey ?? randomUUID();
  const approvalId = randomUUID();
  const inputHash = computeCanonicalInputHash(parsedInput.data);

  const approvalStore = createInMemoryAthenaApprovalStore();
  approvalStore.grant({
    approvalId,
    orgId,
    actorUserId: userId,
    toolId: tool.id,
    toolVersion: tool.version,
    risk: tool.risk,
    idempotencyKey,
    inputHash,
    planId,
    stepId,
    approvedAt: new Date(Date.now() - 1_000),
    expiresAt: new Date(Date.now() + 60_000),
    status: "granted",
  });

  const registry = createAthenaToolRegistry();
  registry.register(tool as AthenaToolDefinition<unknown, unknown>);
  const { aiContext, executionId, traceId, requestId } = buildContractAiContext(orgId, userId, role);
  const permissionDecision = await evaluateAthenaPermission({
    rawRole: role,
    orgId,
    userId,
    // Same bridge athena-kernel/service.ts's own policy_check stage already
    // uses for the identical AthenaToolDefinition.permissions (string[]) ->
    // A4 requiredPermissions (readonly DomainPermission[]) gap - not an A9
    // invention.
    request: { kind: "tool", id: tool.id, requiredPermissions: tool.permissions as DomainPermission[], risk: tool.risk },
  });
  if (permissionDecision.decision === "deny") {
    throw new Error(`Athena tool "${tool.id}" was denied by A4 for contract role "${role}" - pass options.role granting every permission this tool declares.`);
  }

  const outcome = await executeAthenaAction(
    { toolRegistry: registry, approvalVerifier: approvalStore },
    {
      planId,
      stepId,
      requestId,
      traceId,
      executionId,
      orgId,
      actor: { type: "user", id: userId },
      role,
      toolId: tool.id,
      toolVersion: tool.version,
      input: parsedInput.data,
      aiContext,
      permissionDecision,
      approvalId,
      idempotencyKey,
      featureFlags,
    }
  );

  assertValidAthenaToolResult(outcome.result.toolResult);
  if (outcome.audit.reasonCode !== "executed" && outcome.audit.reasonCode !== "tool_failed") {
    throw new Error(`Approved Athena tool "${tool.id}" did not reach execution (reasonCode: ${outcome.audit.reasonCode}).`);
  }
}

// Proves a medium/high-risk tool correctly does NOT execute through A2's own
// dispatchAthenaTool() without a verified approval - a no-op for a low-risk
// tool, since dispatchAthenaTool() legitimately does execute those directly.
// A2's dispatcher folds approval_required into the same not-found-shaped
// denial as an unknown tool id (see dispatcher.ts's registry-enumeration
// comment); this proves that holds for this exact tool, not merely assumed.
export async function assertToolRiskIsEnforced<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>, options: AthenaToolContractOptions<TInput>): Promise<void> {
  if (tool.risk === "low") return;
  const role = options.role ?? DEFAULT_ROLE;
  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  const userId = options.userId ?? DEFAULT_USER_ID;
  const featureFlags = options.featureFlags ?? tool.requiredFeatureFlags ?? [];
  const registry = createAthenaToolRegistry();
  registry.register(tool as AthenaToolDefinition<unknown, unknown>);
  const { aiContext, executionId, traceId, requestId } = buildContractAiContext(orgId, userId, role);
  const outcome = await dispatchAthenaTool(registry, {
    toolId: tool.id,
    version: tool.version,
    input: options.validInput,
    aiContext,
    actor: { type: "user", id: userId },
    role,
    orgId,
    requestId,
    traceId,
    executionId,
    featureFlags,
  });
  if (outcome.result.success !== false || outcome.audit.reasonCode === "dispatched") {
    throw new Error(`Expected Athena tool "${tool.id}" (risk: ${tool.risk}) to be blocked without a verified approval, but it executed.`);
  }
}

// Proves invalid input is rejected at the real runtime schema boundary,
// uniformly across every risk tier. Routed through A6's executeAthenaAction
// (never A2's raw dispatchAthenaTool) because input validation there (step 5
// in engine.ts) runs before approval verification (step 7) - this lets a
// medium/high-risk tool's invalid-input rejection be proven with only an
// "allow"/"approval_required" A4 decision, no approval grant required,
// exactly like the low-risk case. A "deny" decision is refused up front
// (see the thrown error below) because it would prove authorization
// behavior, not input-validation behavior - the two must not be conflated.
export async function assertToolRejectsInvalidInput<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>, invalidInput: unknown, options: AthenaToolContractOptions<TInput>): Promise<void> {
  const role = options.role ?? DEFAULT_ROLE;
  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  const userId = options.userId ?? DEFAULT_USER_ID;
  const featureFlags = options.featureFlags ?? tool.requiredFeatureFlags ?? [];

  const registry = createAthenaToolRegistry();
  registry.register(tool as AthenaToolDefinition<unknown, unknown>);
  const { aiContext, executionId, traceId, requestId } = buildContractAiContext(orgId, userId, role);
  const permissionDecision = await evaluateAthenaPermission({
    rawRole: role,
    orgId,
    userId,
    // Same bridge athena-kernel/service.ts's own policy_check stage already
    // uses for the identical AthenaToolDefinition.permissions (string[]) ->
    // A4 requiredPermissions (readonly DomainPermission[]) gap - not an A9
    // invention.
    request: { kind: "tool", id: tool.id, requiredPermissions: tool.permissions as DomainPermission[], risk: tool.risk },
  });
  if (permissionDecision.decision === "deny") {
    throw new Error(`Athena tool "${tool.id}" was denied by A4 for contract role "${role}" before input could be validated - pass options.role granting every permission this tool declares.`);
  }

  const outcome = await executeAthenaAction(
    { toolRegistry: registry, approvalVerifier: createFailClosedAthenaApprovalVerifier() },
    {
      requestId,
      traceId,
      executionId,
      orgId,
      actor: { type: "user", id: userId },
      role,
      toolId: tool.id,
      toolVersion: tool.version,
      input: invalidInput,
      aiContext,
      permissionDecision,
      featureFlags,
    }
  );

  if (outcome.audit.reasonCode !== "invalid_input") {
    throw new Error(`Expected Athena tool "${tool.id}" to reject invalid input at the runtime schema boundary, got reasonCode: ${outcome.audit.reasonCode}`);
  }
}

// Returns the first canonical role that does NOT hold every one of
// `requiredPermissions`, or undefined if every canonical role already
// satisfies them (in which case there is no meaningful denial scenario to
// construct - see assertToolDeniedWithoutRequiredPermissions below).
function findRoleLackingPermissions(requiredPermissions: readonly string[]): CanonicalRole | undefined {
  return canonicalRoles.find((role) => {
    const granted = getRolePermissions(role);
    return !requiredPermissions.every((permission) => granted.includes(permission as DomainPermission));
  });
}

// Proves A4 actually denies a role that does not hold every permission this
// tool declares - added after an independent review of this kit noted that
// assertToolExecutesValidInput's default contract role ("owner", which holds
// every permission) could make a tool's `permissions` declaration look
// correct even if it were wrong, since the default role would satisfy any
// declared list. A no-op when the tool declares no permissions (nothing to
// deny) or when every canonical role already satisfies the declared list (no
// role exists that could prove a denial).
export async function assertToolDeniedWithoutRequiredPermissions<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>, options: AthenaToolContractOptions<TInput>): Promise<void> {
  if (tool.permissions.length === 0) return;
  const role = findRoleLackingPermissions(tool.permissions);
  if (!role) return;

  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  const userId = options.userId ?? DEFAULT_USER_ID;
  const decision = await evaluateAthenaPermission({
    rawRole: role,
    orgId,
    userId,
    request: { kind: "tool", id: tool.id, requiredPermissions: tool.permissions as DomainPermission[], risk: tool.risk },
  });
  if (decision.decision !== "deny") {
    throw new Error(`Expected role "${role}" (missing at least one permission "${tool.id}" declares: ${tool.permissions.join(", ")}) to be denied by A4, got decision: ${decision.decision}`);
  }
}

// Proves a tool with declared requiredFeatureFlags is actually blocked when
// none of them are present, through the real A2 dispatcher - the same
// independent-review finding as above: assertToolExecutesValidInput and
// assertToolRejectsInvalidInput both default `featureFlags` to
// `tool.requiredFeatureFlags` for their own convenience, which never
// exercises the "flag missing" path on its own. A no-op when the tool
// declares no required feature flags.
export async function assertToolDeniedWithoutRequiredFeatureFlags<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>, options: AthenaToolContractOptions<TInput>): Promise<void> {
  const required = tool.requiredFeatureFlags ?? [];
  if (required.length === 0) return;

  const role = options.role ?? DEFAULT_ROLE;
  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  const userId = options.userId ?? DEFAULT_USER_ID;
  const registry = createAthenaToolRegistry();
  registry.register(tool as AthenaToolDefinition<unknown, unknown>);
  const { aiContext, executionId, traceId, requestId } = buildContractAiContext(orgId, userId, role);
  const outcome = await dispatchAthenaTool(registry, {
    toolId: tool.id,
    version: tool.version,
    input: options.validInput,
    aiContext,
    actor: { type: "user", id: userId },
    role,
    orgId,
    requestId,
    traceId,
    executionId,
    // Deliberately omit every required flag, regardless of options.featureFlags.
    featureFlags: [],
  });
  if (outcome.result.success !== false || outcome.audit.reasonCode === "dispatched") {
    throw new Error(`Expected Athena tool "${tool.id}" to be blocked when none of its required feature flags (${required.join(", ")}) are present, but it executed.`);
  }
}

// Jest wrapper around the assertion functions above. Reusable by any
// first-party tool author (this milestone's own reference tool included,
// see fixtures/recallPreferenceTool.ts) with minimal boilerplate: call this
// once inside a describe block alongside the tool's own unit tests.
export function describeAthenaToolContract<TInput, TData>(tool: AthenaToolDefinition<TInput, TData>, options: AthenaToolContractOptions<TInput>): void {
  describe(`athena tool contract: ${tool.id}@${tool.version}`, () => {
    it("has a valid A2 tool definition shape", () => {
      assertToolDefinitionShape(tool);
    });

    it("registers and resolves through the ordinary A2 registry", () => {
      assertToolRegistersAndResolves(tool);
    });

    it("executes valid input through the real A2/A4/A6 authority boundary and returns a valid result envelope", async () => {
      await assertToolExecutesValidInput(tool, options);
    });

    if (tool.risk !== "low") {
      it("does not execute without a verified approval", async () => {
        await assertToolRiskIsEnforced(tool, options);
      });
    }

    if (tool.permissions.length > 0) {
      it("is denied by A4 for a role missing a declared permission", async () => {
        await assertToolDeniedWithoutRequiredPermissions(tool, options);
      });
    }

    if ((tool.requiredFeatureFlags ?? []).length > 0) {
      it("does not execute when a required feature flag is missing", async () => {
        await assertToolDeniedWithoutRequiredFeatureFlags(tool, options);
      });
    }

    const invalidInputs = options.invalidInputs ?? [];
    if (invalidInputs.length === 0) {
      it.todo(`rejects invalid input (pass options.invalidInputs to describeAthenaToolContract for "${tool.id}" to exercise this)`);
    }
    invalidInputs.forEach((invalidInput, index) => {
      it(`rejects invalid input #${index + 1} at the runtime schema boundary`, async () => {
        await assertToolRejectsInvalidInput(tool, invalidInput, options);
      });
    });
  });
}
