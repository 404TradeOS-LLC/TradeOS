import type { CanonicalRole } from "../../domain";
import type { AthenaAIContext } from "../athena-kernel/types";
import {
  AthenaToolDispatchError,
  athenaToolCancelledError,
  athenaToolInvalidInputError,
  athenaToolInvalidResultError,
  athenaToolNotFoundError,
  athenaToolRemovedError,
  athenaToolTimeoutError,
  athenaToolUnexpectedError,
  athenaToolVersionNotFoundError,
} from "./errors";
import { evaluateAthenaSecurityRisk } from "../athena-security/riskEngine";
import { evaluateAthenaToolPolicy, hasAllRequiredFeatureFlags } from "./policy";
import type { AthenaToolPolicyDecision } from "./policy";
import type { AthenaToolRegistry } from "./registry";
import { assertValidAthenaToolResult } from "./resultEnvelope";
import { AthenaToolDispatchAudit, AthenaToolDispatchOutcome, AthenaToolError, AthenaToolResult, AthenaToolRisk } from "./types";

export interface AthenaToolDispatchRequest<TInput = unknown> {
  toolId: string;
  version: string;
  input: TInput;
  aiContext: AthenaAIContext;
  actor: { type: "user" | "system"; id: string };
  role: CanonicalRole;
  orgId: string;
  requestId: string;
  traceId: string;
  executionId: string;
  approvalId?: string;
  featureFlags: string[];
  // External cancellation source (e.g. a future kernel's own AbortSignal),
  // separate from the dispatcher-owned deadline below - mirrors
  // athena-kernel/service.ts's clientSignal pattern.
  clientSignal?: AbortSignal;
}

interface ZodLikeSchema {
  safeParse(input: unknown): { success: true; data: unknown } | { success: false };
}

function isZodLikeSchema(schema: unknown): schema is ZodLikeSchema {
  return !!schema && typeof (schema as ZodLikeSchema).safeParse === "function";
}

// Internal-only marker distinguishing a dispatcher-forced abort from an
// ordinary tool error, mirroring athena-kernel/service.ts's
// AthenaAbortedError. Never crosses the public dispatchAthenaTool boundary.
class AthenaToolAbortedError extends Error {
  constructor(public readonly reason: "timeout" | "client_cancelled") {
    super(`Athena tool dispatch aborted: ${reason}`);
  }
}

// Races tool.execute() against a dispatcher-owned deadline, exactly as
// athena-kernel/service.ts races provider calls against its own deadline
// (docs/athena/roadmap/A2-tool-registry-implementation-plan.md "Timeout,
// Idempotency, And Cancellation Behavior"). A non-cooperative tool that
// never resolves is still forced to a timeout result once timeoutMs elapses;
// a cooperative tool that checks its cancellationSignal can still observe
// the abort this function fires.
async function raceWithTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, clientSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let settled = false;
  let rejectAbort!: (error: AthenaToolAbortedError) => void;

  // Both the deadline timer and a client-side cancellation must settle this
  // promise immediately, not merely abort controller.signal - aborting the
  // signal alone does not make Promise.race stop waiting on a
  // non-cooperative tool that never checks it.
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });

  const fireAbort = (reason: "timeout" | "client_cancelled") => {
    if (settled) return;
    settled = true;
    controller.abort();
    rejectAbort(new AthenaToolAbortedError(reason));
  };

  const onClientAbort = () => fireAbort("client_cancelled");
  clientSignal?.addEventListener("abort", onClientAbort);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (clientSignal?.aborted) {
      // Never invoke work() - constructing `Promise.race([work(...), ...])`
      // would call work() eagerly even though this promise is already
      // settled, letting a non-cooperative or side-effecting tool run after
      // the caller already cancelled (docs/athena/roadmap/
      // A2-tool-registry-implementation-plan.md "Timeout, Idempotency, And
      // Cancellation Behavior").
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

// Resolves request.role/featureFlags against a specific tool's declared
// requirements into the same tri-state decision used both for the "found"
// happy path and to decide whether an unauthorized caller may see
// tool_version_not_found instead of the folded-in not-found shape (see
// "Hide version resolution from unauthorized callers" above). A missing
// feature flag always forces "deny" even if risk would otherwise only
// require approval - flag gating controls whether a caller may know the
// tool exists at all, which is a stronger requirement than risk approval.
function resolveDispatchDecision(candidate: { permissions: string[]; risk: AthenaToolRisk; requiredFeatureFlags?: string[] }, request: Pick<AthenaToolDispatchRequest, "role" | "featureFlags">): AthenaToolPolicyDecision {
  const policyDecision = evaluateAthenaToolPolicy(request.role, candidate);
  if (!hasAllRequiredFeatureFlags(candidate.requiredFeatureFlags, request.featureFlags)) {
    return { ...policyDecision, decision: "deny" };
  }
  return policyDecision;
}

function buildFailureResult<TData>(error: AthenaToolError, traceId: string, executionId: string): AthenaToolResult<TData> {
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

// Deterministic dispatch path (docs/athena/roadmap/
// A2-tool-registry-implementation-plan.md "Required Backend Seams" and
// "Permission And Risk-Classification Enforcement Outside The LLM"). Never
// wired into a live HTTP path in A2 - callers are tests today, a future A5
// planner later. Resolves the tool, evaluates the permission/risk gate,
// validates input, enforces timeout/cancellation, calls tool.execute(), and
// validates the returned envelope, all before any caller sees a result. No
// planner, plan step, or model output is ever consulted for the permission
// decision.
export async function dispatchAthenaTool<TInput = unknown, TData = unknown>(registry: AthenaToolRegistry, request: AthenaToolDispatchRequest<TInput>): Promise<AthenaToolDispatchOutcome<TData>> {
  const correlationId = request.traceId;

  try {
    const resolution = registry.resolve(request.toolId, request.version);
    if (resolution.outcome === "tool_not_found") throw athenaToolNotFoundError(correlationId);
    if (resolution.outcome === "tool_removed") throw athenaToolRemovedError(correlationId);
    if (resolution.outcome === "tool_version_not_found") {
      // The specific "wrong version" shape is only exposed once the caller
      // is at least known (allow or approval_required) for one version that
      // actually exists under this id - otherwise an unauthorized caller
      // could enumerate registered tool IDs by probing arbitrary versions
      // and comparing athena_tool_version_not_found against
      // athena_tool_not_found. A caller only blocked on risk approval still
      // legitimately knows the tool exists (they hold every required
      // permission), so "approval_required" counts as known here too.
      const knownToCaller = resolution.knownVersions.some((candidate) => resolveDispatchDecision(candidate, request).decision !== "deny");
      if (!knownToCaller) {
        throw athenaToolNotFoundError(correlationId, "authorization_denied");
      }
      throw athenaToolVersionNotFoundError(correlationId);
    }

    const tool = resolution.definition;

    // A flag-gated or permission-denied tool is folded into the same
    // not-found shape as an unknown tool, for the registry-enumeration
    // reason above. A risk-blocked (but otherwise permission-granted) tool
    // gets the same not-found shape too, distinguished only in the internal
    // audit reasonCode - no A6 approval executor exists yet to route
    // approval_required to, so it does not execute either way.
    const policyDecision = resolveDispatchDecision(tool, request);
    if (policyDecision.decision === "deny") {
      throw athenaToolNotFoundError(correlationId, "authorization_denied");
    }
    if (policyDecision.decision === "approval_required") {
      throw athenaToolNotFoundError(correlationId, "approval_required");
    }

    // A11 Risk Evaluation - see athena-kernel/service.ts's identical gate
    // (its own module comment there has the full rationale) for why this
    // sits here, after A2's own permission/risk gate and before execution.
    // Duplicated rather than shared as a single call site because
    // dispatchAthenaTool is a fully independent dispatch path
    // athena-kernel/service.ts does not call (see this function's own
    // module comment above: "Never wired into a live HTTP path in A2... a
    // future A5 planner later" - A5/A6 ultimately built their own path
    // through athena-action-engine/engine.ts instead). Only reachable here
    // with policyDecision.decision === "allow" - deny/approval_required
    // both already threw above - so this can only ever narrow an
    // already-permitted dispatch further, never widen one.
    const securityDecision = evaluateAthenaSecurityRisk({
      orgId: request.orgId,
      tool: { id: tool.id, owner: tool.owner, risk: tool.risk, deprecated: tool.deprecated },
      toolInput: request.input,
      permissionDecision: { decision: policyDecision.decision, reasonCode: "athena_tool_policy_evaluated" },
    });
    if (securityDecision.decision === "deny") {
      throw athenaToolNotFoundError(correlationId, "authorization_denied");
    }

    if (!isZodLikeSchema(tool.inputSchema)) {
      // Registration already guarantees this (registry.ts's
      // assertValidToolDefinition); reaching here means a registry bypassed
      // that check, which is an internal defect, not a caller input problem.
      throw athenaToolUnexpectedError(correlationId);
    }
    const parsedInput = tool.inputSchema.safeParse(request.input);
    if (!parsedInput.success) {
      throw athenaToolInvalidInputError(correlationId);
    }

    const deadline = new Date(Date.now() + tool.timeoutMs);
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
            deadline,
            cancellationSignal: signal,
            approvalId: request.approvalId,
            featureFlags: request.featureFlags,
          }),
        tool.timeoutMs,
        request.clientSignal
      );
    } catch (error) {
      if (error instanceof AthenaToolAbortedError) {
        throw error.reason === "timeout" ? athenaToolTimeoutError(correlationId) : athenaToolCancelledError(correlationId);
      }
      throw athenaToolUnexpectedError(correlationId);
    }

    try {
      assertValidAthenaToolResult(raw);
    } catch {
      throw athenaToolInvalidResultError(correlationId);
    }

    // A tool's own telemetry reference is not trustworthy for request
    // correlation just because it passed shape validation - a buggy or
    // malicious tool could return a stale, fabricated, or unrelated
    // traceId/executionId and still produce a structurally valid envelope.
    // Bind the returned result to this dispatch's own active context rather
    // than trusting whatever the tool reported.
    const boundResult: AthenaToolResult<TData> = {
      ...(raw as AthenaToolResult<TData>),
      telemetry: { traceId: request.traceId, executionId: request.executionId },
    };
    // A tool-returned failure's error.correlationId is equally untrustworthy
    // for request correlation as the top-level telemetry above - a
    // structurally valid error object can still carry a stale, fabricated,
    // or unrelated correlationId. Normalize it to this dispatch's own
    // traceId while preserving every other tool-provided error field that
    // already passed resultEnvelope validation (code, category, retryable,
    // safeSummary).
    if (boundResult.success === false && boundResult.error) {
      boundResult.error = { ...boundResult.error, correlationId: request.traceId };
    }

    const audit: AthenaToolDispatchAudit = {
      reasonCode: "dispatched",
      toolId: request.toolId,
      version: request.version,
      evaluatedRole: policyDecision.role,
      evaluatedPermissions: policyDecision.evaluatedPermissions,
      evaluatedRisk: policyDecision.evaluatedRisk,
    };
    return { result: boundResult, audit };
  } catch (error) {
    const dispatchError = error instanceof AthenaToolDispatchError ? error : athenaToolUnexpectedError(correlationId);
    const audit: AthenaToolDispatchAudit = { reasonCode: dispatchError.reasonCode, toolId: request.toolId, version: request.version };
    return { result: buildFailureResult(dispatchError.publicError, request.traceId, request.executionId), audit };
  }
}
