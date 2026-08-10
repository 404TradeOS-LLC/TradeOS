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
import { evaluateAthenaToolPolicy, hasAllRequiredFeatureFlags } from "./policy";
import type { AthenaToolRegistry } from "./registry";
import { assertValidAthenaToolResult } from "./resultEnvelope";
import { AthenaToolDispatchAudit, AthenaToolDispatchOutcome, AthenaToolError, AthenaToolResult } from "./types";

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
  if (clientSignal?.aborted) {
    onClientAbort();
  }

  const timer = setTimeout(() => fireAbort("timeout"), timeoutMs);

  try {
    return await Promise.race([work(controller.signal), abortPromise]);
  } finally {
    settled = true;
    clearTimeout(timer);
    clientSignal?.removeEventListener("abort", onClientAbort);
  }
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
    if (resolution.outcome === "tool_version_not_found") throw athenaToolVersionNotFoundError(correlationId);
    if (resolution.outcome === "tool_removed") throw athenaToolRemovedError(correlationId);

    const tool = resolution.definition;

    // A flag-gated tool a caller doesn't have yet is folded into the same
    // not-found shape as a permission denial, for the same
    // registry-enumeration reason (see policy check below).
    if (!hasAllRequiredFeatureFlags(tool.requiredFeatureFlags, request.featureFlags)) {
      throw athenaToolNotFoundError(correlationId, "authorization_denied");
    }

    const policyDecision = evaluateAthenaToolPolicy(request.role, tool);
    if (policyDecision.decision === "deny") {
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

    const audit: AthenaToolDispatchAudit = {
      reasonCode: "dispatched",
      toolId: request.toolId,
      version: request.version,
      evaluatedRole: policyDecision.role,
      evaluatedPermissions: policyDecision.evaluatedPermissions,
      evaluatedRisk: policyDecision.evaluatedRisk,
    };
    return { result: raw as AthenaToolResult<TData>, audit };
  } catch (error) {
    const dispatchError = error instanceof AthenaToolDispatchError ? error : athenaToolUnexpectedError(correlationId);
    const audit: AthenaToolDispatchAudit = { reasonCode: dispatchError.reasonCode, toolId: request.toolId, version: request.version };
    return { result: buildFailureResult(dispatchError.publicError, request.traceId, request.executionId), audit };
  }
}
