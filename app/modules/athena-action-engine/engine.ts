import { randomUUID } from "node:crypto";
import type { AthenaToolCompensationPolicy, AthenaToolResult } from "../athena-tool-registry/types";
import type { AthenaToolRegistry } from "../athena-tool-registry/registry";
import { assertValidAthenaToolResult } from "../athena-tool-registry/resultEnvelope";
import { createFailClosedAthenaApprovalVerifier } from "./approval";
import type { AthenaApprovalVerifier } from "./approval";
import {
  AthenaActionDispatchError,
  athenaActionApprovalRequiredError,
  athenaActionCancelledError,
  athenaActionIdempotencyKeyRequiredError,
  athenaActionInvalidInputError,
  athenaActionInvalidResultError,
  athenaActionPermissionDeniedError,
  athenaActionTimeoutError,
  athenaActionToolNotFoundError,
  athenaActionToolRemovedError,
  athenaActionToolVersionNotFoundError,
  athenaActionUnexpectedError,
} from "./errors";
import { buildAthenaIdempotencyScopeKey, createInMemoryAthenaIdempotencyStore } from "./idempotency";
import type { AthenaIdempotencyStore } from "./idempotency";
import { assertActionTransition, isTerminalActionState } from "./lifecycle";
import { AthenaAction, AthenaActionAudit, AthenaActionExecutionRequest, AthenaActionOutcome, AthenaActionReasonCode, AthenaActionResult, AthenaActionState } from "./types";

// A6 Action Engine core (docs/athena/04-system-architecture/README.md's
// "Action Engine" row: "Execute approved tool calls with retries,
// idempotency, rollback" / must not "Trust LLM-only approval or risk
// claims"). This module never derives a permission, risk, or approval
// decision on its own - `request.permissionDecision` is the already-computed
// A4 AthenaPermissionDecision (athena-permissions/policy.ts), and the only
// thing this module adds on top is verifying a caller-supplied approval
// reference through the injected AthenaApprovalVerifier when that decision
// is "approval_required". Every execution path still goes through
// deps.toolRegistry.resolve() for the exact registered AthenaToolDefinition
// - there is no way to hand this module an arbitrary handler.
//
// Process-local singleton defaults: unlike createAthenaToolRegistry() (a
// fresh, isolated catalog per call, per its own module comment), idempotency
// dedup and approval verification are only meaningful if state persists
// ACROSS separate executeAthenaAction() calls within the same process - a
// fresh store per call could never detect a duplicate. These defaults are
// documented, not hidden global state: production callers that need
// cross-instance/durable behavior must inject their own store (see
// idempotency.ts's and approval.ts's module comments for the deferred
// persistence boundary).
const defaultIdempotencyStore: AthenaIdempotencyStore = createInMemoryAthenaIdempotencyStore();
const defaultApprovalVerifier: AthenaApprovalVerifier = createFailClosedAthenaApprovalVerifier();

export interface AthenaActionEngineDeps {
  toolRegistry: Pick<AthenaToolRegistry, "resolve">;
  approvalVerifier?: AthenaApprovalVerifier;
  idempotencyStore?: AthenaIdempotencyStore;
}

interface ZodLikeSchema {
  safeParse(input: unknown): { success: true; data: unknown } | { success: false };
}

function isZodLikeSchema(schema: unknown): schema is ZodLikeSchema {
  return !!schema && typeof (schema as ZodLikeSchema).safeParse === "function";
}

// Internal-only marker distinguishing an engine-forced abort from an
// ordinary tool error - mirrors athena-tool-registry/dispatcher.ts's
// AthenaToolAbortedError. Never crosses the public executeAthenaAction
// boundary.
class AthenaActionAbortedError extends Error {
  constructor(public readonly reason: "timeout" | "client_cancelled") {
    super(`Athena action execution aborted: ${reason}`);
  }
}

// Races tool.execute() against an engine-owned deadline, structurally
// identical to athena-tool-registry/dispatcher.ts's raceWithTimeout (not
// imported - that function is module-private there, and duplicating this
// one small race helper is cheaper than widening A2's own export surface
// for a single reuse). A non-cooperative tool that never resolves is still
// forced to a timeout result once tool.timeoutMs elapses; a cooperative
// tool that checks its cancellationSignal can still observe the abort this
// function fires.
async function raceWithTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, clientSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let settled = false;
  let rejectAbort!: (error: AthenaActionAbortedError) => void;

  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });

  const fireAbort = (reason: "timeout" | "client_cancelled") => {
    if (settled) return;
    settled = true;
    controller.abort();
    rejectAbort(new AthenaActionAbortedError(reason));
  };

  const onClientAbort = () => fireAbort("client_cancelled");
  clientSignal?.addEventListener("abort", onClientAbort);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (clientSignal?.aborted) {
      // Never invoke work() - constructing Promise.race([work(...), ...])
      // would call work() eagerly even though this promise is already
      // settled, letting a non-cooperative or side-effecting tool run after
      // the caller already cancelled.
      onClientAbort();
      return await abortPromise;
    }
    timer = setTimeout(() => fireAbort("timeout"), timeoutMs);
    return await Promise.race([work(controller.signal), abortPromise]);
  } finally {
    settled = true;
    clearTimeout(timer);
    clientSignal?.removeEventListener("abort", onClientAbort);
  }
}

function buildToolFailureResult<TData>(error: ReturnType<typeof athenaActionUnexpectedError>["publicError"], traceId: string, executionId: string): AthenaToolResult<TData> {
  return {
    success: false,
    summary: error.safeSummary,
    data: null,
    events: [],
    warnings: [],
    followUps: [],
    telemetry: { traceId, executionId },
    error,
  };
}

// Executes exactly one already-authorized tool_call step
// (docs/athena/roadmap/A6-action-engine-implementation-plan.md). Never
// invoked by A6 itself for a "deny" decision or an unverified
// "approval_required" decision - the kernel is expected to keep routing
// those to its own existing denied path without calling this function at
// all (see athena-kernel/service.ts) - but this function also independently
// refuses to execute in both cases as defense in depth, exactly mirroring
// the fail-closed posture athena-tool-registry/dispatcher.ts already
// applies to its own (different) internal policy gate.
export async function executeAthenaAction<TInput = unknown, TData = unknown>(deps: AthenaActionEngineDeps, request: AthenaActionExecutionRequest<TInput>): Promise<AthenaActionOutcome<TData>> {
  const approvalVerifier = deps.approvalVerifier ?? defaultApprovalVerifier;
  const idempotencyStore = deps.idempotencyStore ?? defaultIdempotencyStore;
  const correlationId = request.traceId;
  const actionId = randomUUID();
  // C005 requires idempotencyKey to be present on every action record even
  // when the tool itself does not use it for deduplication (idempotency:
  // "not_supported") - a caller-supplied key is preferred, an
  // engine-generated one only fills the contract's required field.
  const idempotencyKey = request.idempotencyKey ?? randomUUID();
  let toolVersionForAudit = request.toolVersion;
  let compensationPolicy: AthenaToolCompensationPolicy = "none";
  let state: AthenaActionState = "created";
  // Tracked separately from `state` for the catch-block safety net below -
  // TypeScript cannot narrow `state`'s type through the `transition()`
  // closure's reassignment, so comparing `state` against a specific literal
  // there would be unreliable. A plain boolean has no such issue.
  let reachedAwaitingApproval = false;

  const transition = (to: AthenaActionState): void => {
    assertActionTransition(state, to);
    state = to;
    if (to === "awaiting_approval") reachedAwaitingApproval = true;
  };

  const buildOutcome = (toolResult: AthenaToolResult<TData>, reasonCode: AthenaActionReasonCode): AthenaActionOutcome<TData> => {
    const action: AthenaAction = {
      id: actionId,
      version: "1.0.0",
      orgId: request.orgId,
      actorUserId: request.actor.id,
      toolId: request.toolId,
      toolVersion: toolVersionForAudit,
      input: request.input,
      risk: request.risk,
      ...(request.approvalId ? { approvalId: request.approvalId } : {}),
      idempotencyKey,
      status: state,
      attempt: 1,
      compensationPolicy,
      ...(toolResult.success === false && toolResult.error ? { lastError: toolResult.error } : {}),
    };
    const result: AthenaActionResult<TData> = {
      version: "1.0.0",
      actionId,
      planId: request.planId,
      stepId: request.stepId,
      state,
      toolId: request.toolId,
      toolVersion: toolVersionForAudit,
      idempotencyKey,
      compensationPolicy,
      toolResult,
    };
    const audit: AthenaActionAudit = { reasonCode, actionId, toolId: request.toolId, toolVersion: toolVersionForAudit, idempotencyKey, compensationPolicy, attempt: 1 };
    return { action, result, audit };
  };

  try {
    // Consume the A4 decision; never recompute it (see module comment).
    const decision = request.permissionDecision;
    if (decision.decision === "deny") {
      transition("denied");
      throw athenaActionPermissionDeniedError(correlationId);
    }

    if (decision.decision === "approval_required") {
      // Approval binding requires a caller-known idempotencyKey (see
      // approval.ts's AthenaApprovalVerificationInput) - an
      // engine-generated fallback key can never have been granted approval
      // in advance, so both approvalId and an explicit idempotencyKey are
      // required together before verification is even attempted.
      if (!request.approvalId || !request.idempotencyKey) {
        transition("awaiting_approval");
        throw athenaActionApprovalRequiredError(correlationId);
      }
      const verification = await approvalVerifier.verify({
        approvalId: request.approvalId,
        orgId: request.orgId,
        toolId: request.toolId,
        toolVersion: request.toolVersion,
        idempotencyKey: request.idempotencyKey,
      });
      if (!verification.valid) {
        transition("awaiting_approval");
        throw athenaActionApprovalRequiredError(correlationId);
      }
      // Valid, correctly-bound approval - fall through to execution below.
    }

    transition("pending");

    const resolution = deps.toolRegistry.resolve(request.toolId, request.toolVersion);
    if (resolution.outcome === "tool_not_found") {
      transition("failed");
      throw athenaActionToolNotFoundError(correlationId);
    }
    if (resolution.outcome === "tool_removed") {
      transition("failed");
      throw athenaActionToolRemovedError(correlationId);
    }
    if (resolution.outcome === "tool_version_not_found") {
      transition("failed");
      throw athenaActionToolVersionNotFoundError(correlationId);
    }
    const tool = resolution.definition;
    toolVersionForAudit = tool.version;
    compensationPolicy = tool.compensationPolicy;

    if (tool.idempotency === "required" && !request.idempotencyKey) {
      transition("failed");
      throw athenaActionIdempotencyKeyRequiredError(correlationId);
    }

    if (!isZodLikeSchema(tool.inputSchema)) {
      // Registration already guarantees this (athena-tool-registry/registry.ts's
      // assertValidToolDefinition) - reaching here means an internal
      // defect, not a caller input problem.
      transition("failed");
      throw athenaActionUnexpectedError(correlationId);
    }
    const parsedInput = tool.inputSchema.safeParse(request.input);
    if (!parsedInput.success) {
      transition("failed");
      throw athenaActionInvalidInputError(correlationId);
    }

    // Only tools that declare real dedup semantics AND received an explicit
    // caller-supplied key are dedup-eligible - a "not_supported" tool must
    // never dedupe even if a key happens to be present (callers cannot
    // depend on suppression that was never promised), and an "optional"
    // tool with no key supplied has nothing to key on.
    const dedupeEligible = tool.idempotency !== "not_supported" && !!request.idempotencyKey;
    const scopeKey = dedupeEligible ? buildAthenaIdempotencyScopeKey(request.orgId, tool.id, tool.version, request.idempotencyKey as string) : undefined;

    const completeIfDedupeEligible = async (outcome: AthenaActionOutcome<TData>): Promise<void> => {
      if (scopeKey) await idempotencyStore.complete(scopeKey, { action: outcome.action, result: outcome.result });
    };

    if (scopeKey) {
      const reservation = await idempotencyStore.reserve<TData>(scopeKey);
      if (reservation.outcome === "duplicate") {
        if (reservation.existing) {
          // Returns the original action's own record/result (including its
          // own actionId/state) verbatim - this call's own freshly-generated
          // actionId/action record are simply discarded, but tool.execute()
          // never runs a second time for this key.
          return { action: reservation.existing.action, result: reservation.existing.result, audit: { reasonCode: "idempotent_duplicate_suppressed", actionId, toolId: tool.id, toolVersion: tool.version, idempotencyKey, compensationPolicy, attempt: 1 } };
        }
        // A concurrent duplicate with no recorded result yet (the original
        // attempt has not completed) - fail closed rather than running a
        // second concurrent attempt for the same key.
        transition("failed");
        throw athenaActionUnexpectedError(correlationId);
      }
    }

    transition("running");

    let raw: unknown;
    try {
      raw = await raceWithTimeout(
        (signal) =>
          tool.execute(parsedInput.data, request.aiContext, {
            executionId: request.executionId,
            requestId: request.requestId,
            traceId: request.traceId,
            orgId: request.orgId,
            actor: request.actor,
            role: request.role,
            deadline: new Date(Date.now() + tool.timeoutMs),
            cancellationSignal: signal,
            approvalId: request.approvalId,
            featureFlags: request.featureFlags,
          }),
        tool.timeoutMs,
        request.clientSignal
      );
    } catch (error) {
      if (error instanceof AthenaActionAbortedError) {
        transition(error.reason === "timeout" ? "expired" : "cancelled");
        const dispatchError = error.reason === "timeout" ? athenaActionTimeoutError(correlationId) : athenaActionCancelledError(correlationId);
        await completeIfDedupeEligible(buildOutcome(buildToolFailureResult(dispatchError.publicError, request.traceId, request.executionId), dispatchError.reasonCode));
        throw dispatchError;
      }
      transition("failed");
      const dispatchError = athenaActionUnexpectedError(correlationId);
      await completeIfDedupeEligible(buildOutcome(buildToolFailureResult(dispatchError.publicError, request.traceId, request.executionId), dispatchError.reasonCode));
      throw dispatchError;
    }

    try {
      assertValidAthenaToolResult(raw);
    } catch {
      transition("failed");
      const dispatchError = athenaActionInvalidResultError(correlationId);
      await completeIfDedupeEligible(buildOutcome(buildToolFailureResult(dispatchError.publicError, request.traceId, request.executionId), dispatchError.reasonCode));
      throw dispatchError;
    }

    // Never trust a tool's own telemetry/error.correlationId for request
    // correlation - the same defensive binding
    // athena-tool-registry/dispatcher.ts already applies.
    const boundResult: AthenaToolResult<TData> = {
      ...(raw as AthenaToolResult<TData>),
      telemetry: { traceId: request.traceId, executionId: request.executionId },
    };
    if (boundResult.success === false && boundResult.error) {
      boundResult.error = { ...boundResult.error, correlationId: request.traceId };
    }

    transition(boundResult.success ? "succeeded" : "failed");
    const outcome = buildOutcome(boundResult, boundResult.success ? "executed" : "tool_failed");
    await completeIfDedupeEligible(outcome);
    return outcome;
  } catch (error) {
    const dispatchError = error instanceof AthenaActionDispatchError ? error : athenaActionUnexpectedError(correlationId);
    // "awaiting_approval" is a legitimate non-terminal resting state reached
    // deliberately above (missing/invalid approval) - only force a genuinely
    // unexpected non-terminal state (e.g. a custom idempotency store or
    // approval verifier implementation throwing mid-transition, leaving
    // `state` at "created"/"pending"/"running") to a safe terminal failure.
    // This is a last-resort fallback outside the normal lifecycle table, not
    // a supported transition - never move an action into an executable
    // state here, only ever into a safe terminal failure or the one
    // sanctioned non-terminal rest state.
    if (!reachedAwaitingApproval && !isTerminalActionState(state)) {
      state = "failed";
    }
    return buildOutcome(buildToolFailureResult(dispatchError.publicError, request.traceId, request.executionId), dispatchError.reasonCode);
  }
}
