import { randomUUID } from "node:crypto";
import { normalizeRole } from "../../domain";
import type { DomainPermission } from "../../domain";
import { assembleAthenaContext } from "../athena-context-engine/assembler";
import type { AthenaContextRegistry } from "../athena-context-engine/registry";
import type { AthenaApprovalVerifier } from "../athena-action-engine/approval";
import { executeAthenaAction } from "../athena-action-engine/engine";
import type { AthenaIdempotencyStore } from "../athena-action-engine/idempotency";
import { buildAthenaPlan } from "../athena-planner/planner";
import type { AthenaPlanCandidateTool } from "../athena-planner/types";
import { evaluateAthenaPermission } from "../athena-permissions/policy";
import { classifyAthenaIntent } from "../athena-router/classifier";
import { createAthenaToolRegistry } from "../athena-tool-registry/registry";
import type { AthenaToolRegistry } from "../athena-tool-registry/registry";
import { buildMinimalAthenaContext } from "./context";
import { createLiveAthenaContextRegistry } from "./contextRegistry";
import * as executionStore from "./executionStore";
import { AthenaKernelError, athenaValidationError, normalizeAthenaError } from "./errors";
import { getAthenaFlags } from "./flags";
import { assertTransition, getMaxRoundTrips, nextRoundTripCount } from "./lifecycle";
import { classifyAthenaCapability, evaluateAthenaPolicy } from "./policy";
import { AthenaProviderAdapter, resolveAthenaProvider } from "./provider";
import { buildTelemetryRecord, recordAthenaTelemetry } from "./telemetry";
import { AthenaActorContext, AthenaCancellationReason, AthenaKernelRequest, AthenaKernelResult, AthenaKernelState, AthenaTelemetryCost, AthenaToolError } from "./types";

export const ATHENA_MAX_MESSAGE_LENGTH = 4_000;
const DEFAULT_REQUEST_DEADLINE_MS = 15_000;
const DEFAULT_PROVIDER_DEADLINE_MS = 8_000;

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

// Internal-only marker distinguishing "the kernel-owned AbortController
// fired" from an ordinary business error, so the outer handler can map it to
// the correct terminal state (expired vs cancelled) instead of a generic
// failed. Never crosses the public handleRequest boundary.
class AthenaAbortedError extends Error {
  constructor(public readonly reason: AthenaCancellationReason) {
    super(`Athena kernel execution aborted: ${reason}`);
  }
}

export interface AthenaKernelHandleInput {
  request: AthenaKernelRequest;
  actor: AthenaActorContext;
  requestId: string;
  clientSignal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  provider?: AthenaProviderAdapter;
  // Injectable for tests, same DI pattern as `provider` above - defaults to
  // createLiveAthenaContextRegistry() (real JobsService/KnowledgeRuntimeService).
  // Only ever consulted when flags.routerPlannerEnabled is true.
  contextRegistry?: AthenaContextRegistry;
  // Injectable for tests/future A12 integration, same DI pattern as
  // `contextRegistry` above - defaults to a fresh, empty createAthenaToolRegistry()
  // (A2 has no production tools registered yet). One instance is used for
  // both plan construction and per-step authorization below, so the two
  // stages can never see divergent tool metadata (see the module comment on
  // the routerPlannerEnabled branch).
  toolRegistry?: Pick<AthenaToolRegistry, "discover" | "resolve">;
  // Test-only override for candidate selection. Production always derives
  // candidates from toolRegistry.discover(actor), which already filters by
  // the actor's role/permissions and feature flags - so a role that lacks a
  // tool's permission never even sees it as a candidate there. Overriding
  // this directly lets a test force a specific tool_call step into the plan
  // regardless of discover()'s own filtering, so a permission-mismatch test
  // exercises the kernel's evaluateAthenaPermission() denial path itself,
  // not registry-level candidate filtering.
  candidateTools?: AthenaPlanCandidateTool[];
  // A6 DI seams, same posture as the ones above - production has no
  // real caller-facing approval/idempotency submission surface yet (that is
  // future work; see docs/athena/roadmap/A6-action-engine-implementation-plan.md),
  // so these only matter to tests today. approvalId/idempotencyKey are
  // applied uniformly to every tool_call step in the plan - safe because a
  // production plan never has more than zero steps (A2 has no registered
  // tools), and every A6 test plan in this repo exercises exactly one step.
  approvalId?: string;
  idempotencyKey?: string;
  approvalVerifier?: AthenaApprovalVerifier;
  idempotencyStore?: AthenaIdempotencyStore;
}

// Runtime coordinator for one Athena request (docs/athena/05-runtime/README.md
// "Kernel"). A1 implements the non-mutating shell only: it never calls a
// tool, application service, or anything beyond this module's own
// execution-store/telemetry seams. Business execution for real tools starts
// at A2 and must follow Athena -> Tool -> Application Service -> Domain
// Logic -> Infrastructure; A1 has no tools to route to.
export class AthenaKernelService {
  async handleRequest(input: AthenaKernelHandleInput): Promise<AthenaKernelResult> {
    const env = input.env ?? process.env;
    const flags = getAthenaFlags(env);
    const executionId = randomUUID();
    const traceId = randomUUID();
    const canonicalRole = normalizeRole(input.actor.role);
    const actor: AthenaActorContext = { ...input.actor, role: canonicalRole };
    const kernelStart = Date.now();

    const requestDeadlineMs = parsePositiveIntEnv(env.ATHENA_REQUEST_DEADLINE_MS, DEFAULT_REQUEST_DEADLINE_MS);
    const providerDeadlineMs = parsePositiveIntEnv(env.ATHENA_PROVIDER_DEADLINE_MS, DEFAULT_PROVIDER_DEADLINE_MS);
    const deadline = new Date(kernelStart + requestDeadlineMs);

    // Kernel-owned AbortController (HIGH-P1/HIGH-P5,
    // docs/athena/reviews/A1-parallel-readiness-review.md): constructed
    // here, fired on this kernel's own deadline timer or client disconnect.
    // It is not derived from databaseSession.ts's response-lifecycle
    // listeners, waitForResponse, or Prisma transaction timeout behavior -
    // those exist to hold the request's database transaction open, not to
    // signal cancellation.
    const controller = new AbortController();
    let cancellationReason: AthenaCancellationReason | undefined;
    const abort = (reason: AthenaCancellationReason) => {
      cancellationReason = cancellationReason ?? reason;
      controller.abort();
    };
    const deadlineTimer = setTimeout(() => abort("deadline_exceeded"), requestDeadlineMs);
    const onClientAbort = () => abort("client_closed");
    input.clientSignal?.addEventListener("abort", onClientAbort);
    // AbortSignal never fires "abort" retroactively for a signal that was
    // already aborted before the listener was attached (e.g. the HTTP
    // client disconnected in the gap between the controller registering the
    // request and calling the kernel) - check explicitly rather than
    // silently proceeding as if nothing happened.
    if (input.clientSignal?.aborted) {
      abort("client_closed");
    }

    let state: AthenaKernelState = "created";
    let roundTrips = 0;

    const applyTransition = async (to: AthenaKernelState, reasonCode: string, metadata?: Record<string, unknown>) => {
      assertTransition(state, to);
      await executionStore.recordTransition({
        executionId,
        orgId: actor.orgId,
        fromState: state,
        toState: to,
        reasonCode,
        metadata,
        roundTrips,
      });
      state = to;
    };

    const enterRoundTripState = async (to: "needs_clarification" | "degraded", reasonCode: string) => {
      roundTrips = nextRoundTripCount(roundTrips, getMaxRoundTrips(env));
      await applyTransition(to, reasonCode);
    };

    const throwIfAborted = () => {
      if (controller.signal.aborted) {
        throw new AthenaAbortedError(cancellationReason ?? "shutdown");
      }
    };

    const emitSpan = async (spanType: "kernel" | "context" | "model" | "approval" | "action", status: "ok" | "error" | "denied" | "degraded", durationMs: number, metadata: Record<string, unknown>, cost?: AthenaTelemetryCost) => {
      try {
        const record = buildTelemetryRecord({
          orgId: actor.orgId,
          requestId: input.requestId,
          traceId,
          executionId,
          spanType,
          status,
          durationMs,
          metadata,
          cost,
        });
        await recordAthenaTelemetry(record, env);
      } catch {
        // Telemetry failure must never flip a real business result
        // (docs/athena/contracts/README.md C011 "Error behavior").
      }
    };

    try {
      await executionStore.createExecutionRecord({
        executionId,
        orgId: actor.orgId,
        requestId: input.requestId,
        traceId,
        actorUserId: actor.userId,
        canonicalRole,
        requestSource: input.request.requestSource,
      });

      const message = input.request.message.trim();
      if (message.length === 0) {
        throw athenaValidationError("A message is required.");
      }
      if (message.length > ATHENA_MAX_MESSAGE_LENGTH) {
        throw athenaValidationError(`Messages must be ${ATHENA_MAX_MESSAGE_LENGTH} characters or fewer.`);
      }

      throwIfAborted();
      await applyTransition("context_building", "context_assembly_started");
      const contextStart = Date.now();
      const context = buildMinimalAthenaContext({
        requestId: input.requestId,
        traceId,
        executionId,
        actor,
        request: input.request,
      });
      await emitSpan("context", "ok", Date.now() - contextStart, {
        sectionsIncluded: ["request", "organization", "user", "permissions", "selectedScope", "telemetry", ...(context.conversation ? ["conversation"] : [])],
        sectionsOmitted: ["weather", "calendar", "dispatch", "customers", "costbook", "knowledgeEngine", "inventory", "notifications"],
        maxBytes: context.budget.maxBytes,
      });

      throwIfAborted();
      await applyTransition("routing", "context_ready");

      if (message.length < 3) {
        await enterRoundTripState("needs_clarification", "message_too_short");
        const clarification = this.buildClarificationResult(executionId, traceId);
        await executionStore.finalizeExecutionRecord({ executionId, safeSummary: clarification.summary });
        return clarification;
      }

      if (!flags.routerPlannerEnabled) {
        // A1's original routing/planning stand-ins, byte-for-byte unchanged.
        const capability = classifyAthenaCapability(message);

        throwIfAborted();
        await applyTransition("planning", "capability_classified", { capability });
        throwIfAborted();
        await applyTransition("policy_check", "plan_ready");

        const policyStart = Date.now();
        const decision = evaluateAthenaPolicy({
          rawRole: input.actor.role,
          orgId: actor.orgId,
          userId: actor.userId,
          capability,
        });
        await emitSpan("approval", decision.decision === "allow" ? "ok" : "denied", Date.now() - policyStart, {
          capability: decision.capability,
          reasonCode: decision.reasonCode,
          decision: decision.decision,
          deniedFields: decision.deniedFields,
        });

        if (decision.decision !== "allow") {
          await applyTransition("denied", decision.reasonCode);
          const denied = this.buildDeniedResult(executionId, traceId, decision.reasonCode);
          await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
          return denied;
        }
      } else {
        // A5 router/planner orchestration (docs/athena/roadmap/
        // A5-router-planner-implementation-plan.md). Deterministic, no
        // model call for routing/planning itself - only produceDraftResponse
        // below ever calls the AI provider.
        const routerResult = classifyAthenaIntent(message);

        throwIfAborted();
        await applyTransition("planning", "intent_classified", { intent: routerResult.intent });

        // A2 has no production tools registered yet (A12 work), so
        // toolRegistry.discover() returns [] here today and plan.steps is
        // always []. Exactly one registry instance is constructed and
        // reused for both plan construction and the per-step authorization
        // loop below - never two independently constructed registries -
        // so planning and authorization can never disagree about what a
        // tool actually requires.
        const toolRegistry = input.toolRegistry ?? createAthenaToolRegistry();
        const candidateTools: AthenaPlanCandidateTool[] =
          input.candidateTools ??
          toolRegistry.discover({ role: actor.role, featureFlags: [] }).map((tool) => ({ toolId: tool.id, toolVersion: tool.version, summary: tool.description, input: {} }));
        const plan = buildAthenaPlan({ routerResult, candidateTools, toolRegistry });

        throwIfAborted();
        await applyTransition("policy_check", "plan_ready", { planId: plan.planId, planStatus: plan.status });

        const policyStart = Date.now();

        if (plan.status === "needs_clarification") {
          // mutate_business_record - fall back to the existing, unmodified
          // A1 policy path so external behavior (403, identical reason code)
          // is byte-identical to the flag-off branch regardless of flag
          // state. This is the concrete, per-request instance of the
          // roadmap's "route to human-readable fallback" rollback.
          const decision = evaluateAthenaPolicy({ rawRole: input.actor.role, orgId: actor.orgId, userId: actor.userId, capability: "mutate_business_record" });
          await emitSpan("approval", "denied", Date.now() - policyStart, {
            capability: decision.capability,
            reasonCode: decision.reasonCode,
            decision: decision.decision,
            deniedFields: decision.deniedFields,
            planId: plan.planId,
          });
          await applyTransition("denied", decision.reasonCode);
          const denied = this.buildDeniedResult(executionId, traceId, decision.reasonCode);
          await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
          return denied;
        }

        // Dormant in production (plan.steps is always [] today, since
        // toolRegistry.discover() has nothing to return) - proves the
        // per-step A4 permission gate exists for when A12 tools and A6
        // action execution land, without wiring a real approval executor
        // here (that is A6's job; approval_required still maps to denied).
        // AthenaPlanStep itself carries no permission/risk metadata, so
        // each step is re-resolved against the same toolRegistry instance
        // used for planning above - this is how the tool's actual
        // registered requirements, never a hardcoded default, reach A4.
        for (const step of plan.steps) {
          if (step.kind !== "tool_call") continue;

          const resolution = toolRegistry.resolve(step.toolId, step.toolVersion);
          if (resolution.outcome !== "found") {
            // Fail closed: a plan step whose tool can no longer be resolved
            // (removed, or an injected registry whose discover()/resolve()
            // diverge) must never fall back to a permissive default.
            const reasonCode = "athena_tool_call_step_unresolvable";
            await emitSpan("approval", "denied", Date.now() - policyStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, reasonCode });
            await applyTransition("denied", reasonCode);
            const denied = this.buildDeniedResult(executionId, traceId, reasonCode);
            await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
            return denied;
          }

          const tool = resolution.definition;
          const stepDecision = await evaluateAthenaPermission({
            rawRole: input.actor.role,
            orgId: actor.orgId,
            userId: actor.userId,
            // The registered tool's real permissions/risk - never a
            // hardcoded [] / "low". An invalid/unrecognized permission
            // string in tool.permissions still fails closed here (it can
            // never match a granted DomainPermission), so this cast never
            // widens access even if a tool definition's permissions array
            // were malformed.
            request: { kind: "tool", id: step.toolId, requiredPermissions: tool.permissions as DomainPermission[], risk: tool.risk },
          });

          if (stepDecision.decision === "deny") {
            await emitSpan("approval", "denied", Date.now() - policyStart, {
              planId: plan.planId,
              stepId: step.stepId,
              toolId: step.toolId,
              decision: stepDecision.decision,
              reasonCode: stepDecision.reasonCode,
            });
            await applyTransition("denied", stepDecision.reasonCode);
            const denied = this.buildDeniedResult(executionId, traceId, stepDecision.reasonCode);
            await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
            return denied;
          }

          if (!flags.actionEngineEnabled) {
            // A6 does not exist from this path's perspective - approval_required
            // still maps to denied (byte-identical to A5's original
            // behavior), and "allow" falls through unexecuted, exactly as
            // before ATHENA_ACTION_ENGINE_ENABLED existed.
            if (stepDecision.decision === "approval_required") {
              const reasonCode = "athena_approval_required_no_action_engine";
              await emitSpan("approval", "degraded", Date.now() - policyStart, {
                planId: plan.planId,
                stepId: step.stepId,
                toolId: step.toolId,
                decision: stepDecision.decision,
                reasonCode,
              });
              await applyTransition("denied", reasonCode);
              const denied = this.buildDeniedResult(executionId, traceId, reasonCode);
              await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
              return denied;
            }
            await emitSpan("approval", "ok", Date.now() - policyStart, {
              planId: plan.planId,
              stepId: step.stepId,
              toolId: step.toolId,
              decision: stepDecision.decision,
              reasonCode: stepDecision.reasonCode,
            });
            continue;
          }

          // A6 enabled: hand the already-evaluated A4 decision to the
          // Action Engine. A6 enforces it (deny is unreachable here; it
          // already returned above) - it never re-derives permissions, risk,
          // or approval itself (docs/athena/roadmap/
          // A6-action-engine-implementation-plan.md "Approval enforcement").
          await emitSpan("approval", stepDecision.decision === "allow" ? "ok" : "degraded", Date.now() - policyStart, {
            planId: plan.planId,
            stepId: step.stepId,
            toolId: step.toolId,
            decision: stepDecision.decision,
            reasonCode: stepDecision.reasonCode,
          });

          throwIfAborted();
          const actionStart = Date.now();
          const actionOutcome = await executeAthenaAction(
            { toolRegistry, approvalVerifier: input.approvalVerifier, idempotencyStore: input.idempotencyStore },
            {
              planId: plan.planId,
              stepId: step.stepId,
              requestId: input.requestId,
              traceId,
              executionId,
              orgId: actor.orgId,
              actor: { type: "user", id: actor.userId },
              role: actor.role,
              toolId: step.toolId,
              toolVersion: step.toolVersion,
              input: step.input,
              aiContext: context,
              permissionDecision: stepDecision,
              approvalId: input.approvalId,
              idempotencyKey: input.idempotencyKey,
              featureFlags: [],
              clientSignal: controller.signal,
            }
          );

          const actionState = actionOutcome.result.state;
          const actionStatus: "ok" | "error" | "denied" = actionState === "succeeded" ? "ok" : actionState === "denied" || actionState === "awaiting_approval" ? "denied" : "error";
          await emitSpan("action", actionStatus, Date.now() - actionStart, {
            planId: plan.planId,
            stepId: step.stepId,
            toolId: step.toolId,
            toolVersion: step.toolVersion,
            actionId: actionOutcome.result.actionId,
            state: actionState,
            reasonCode: actionOutcome.audit.reasonCode,
          });

          if (actionState !== "succeeded") {
            const toolError = actionOutcome.result.toolResult.error ?? normalizeAthenaError(new Error("athena_action_failed"), traceId);
            if (actionState === "denied" || actionState === "awaiting_approval") {
              await applyTransition("denied", toolError.code);
              const denied = this.buildDeniedResult(executionId, traceId, toolError.code);
              await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
              return denied;
            }
            // failed / expired / cancelled / (partially_succeeded, not
            // reachable in this milestone - see athena-action-engine/lifecycle.ts)
            // all use the kernel's existing escape-state edges from
            // policy_check (athena-kernel/lifecycle.ts's escapeStates),
            // legal today with no lifecycle.ts change.
            const finalState: AthenaKernelState = actionState === "expired" ? "expired" : actionState === "cancelled" ? "cancelled" : "failed";
            await applyTransition(finalState, toolError.code);
            const failure = this.buildErrorResult(executionId, traceId, finalState, toolError);
            await executionStore.finalizeExecutionRecord({ executionId, safeSummary: failure.summary, safeErrorCode: failure.error?.code });
            return failure;
          }
          // succeeded: continue authorizing/executing any remaining steps,
          // then fall through to the unchanged draft-response stage below.
        }

        await emitSpan("approval", "ok", Date.now() - policyStart, { planId: plan.planId, planStatus: plan.status, intent: plan.intent });

        // Closes A3's own named forward-reference (athena-context-engine/
        // types.ts's requestedIntents comment: "Empty until A5's planner
        // supplies real intents"). Enriches the C001 context object with a
        // real dispatch/knowledgeEngine section when the router requested
        // one - produceDraftResponse() below does not yet consume this
        // enriched context as an LLM prompt input (that prompt-assembly
        // integration is out of scope for A5); this only proves the
        // assembly pipeline runs end-to-end with a real, live-DB-backed
        // provider and records it in telemetry.
        if (routerResult.requestedContextIntents.length > 0) {
          throwIfAborted();
          const liveContextStart = Date.now();
          const contextRegistry = input.contextRegistry ?? createLiveAthenaContextRegistry();
          const assemblyResult = await assembleAthenaContext(contextRegistry, {
            orgId: actor.orgId,
            actor: { userId: actor.userId, role: actor.role },
            permissions: [...actor.permissions],
            selectedScope: context.selectedScope,
            // Neither real A3 provider (dispatch, knowledgeEngine) declares
            // requiredFeatureFlags today - [] is honest, not a placeholder.
            featureFlags: [],
            requestedIntents: routerResult.requestedContextIntents,
            explicitSections: [],
            clientSignal: controller.signal,
          });
          if (assemblyResult.sections.dispatch) context.dispatch = assemblyResult.sections.dispatch;
          if (assemblyResult.sections.knowledgeEngine) context.knowledgeEngine = assemblyResult.sections.knowledgeEngine;
          await emitSpan("context", assemblyResult.stoppedByCriticalFailure ? "degraded" : "ok", Date.now() - liveContextStart, {
            sectionsIncluded: Object.keys(assemblyResult.sections),
            requestedIntents: routerResult.requestedContextIntents,
          });
        }
      }

      if (Date.now() > deadline.getTime() || controller.signal.aborted) {
        throw new AthenaAbortedError(cancellationReason ?? "deadline_exceeded");
      }

      const draftResult = await this.produceDraftResponse({
        message,
        flags,
        provider: input.provider ?? resolveAthenaProvider(env),
        signal: controller.signal,
        deadline,
        providerDeadlineMs,
        abort,
        getCancellationReason: () => cancellationReason,
        emitSpan,
      });

      await applyTransition("succeeded", "draft_response_completed");
      await executionStore.finalizeExecutionRecord({ executionId, safeSummary: draftResult.summary });
      return {
        success: true,
        executionId,
        traceId,
        state: "succeeded",
        summary: draftResult.summary,
        message: draftResult.message,
        warnings: draftResult.warnings,
        followUps: [],
        telemetry: { traceId, executionId },
      };
    } catch (error) {
      if (error instanceof AthenaAbortedError) {
        const isExpired = error.reason === "deadline_exceeded";
        const finalState: AthenaKernelState = isExpired ? "expired" : "cancelled";
        const toolError: AthenaToolError = {
          code: isExpired ? "athena_deadline_exceeded" : `athena_${error.reason}`,
          category: "timeout",
          retryable: isExpired || error.reason === "provider_timeout",
          safeSummary: isExpired ? "Athena did not have time to respond. Please try again." : "This Athena request was cancelled.",
          correlationId: traceId,
        };
        await this.safeApplyTerminal(applyTransition, finalState, error.reason);
        await executionStore.finalizeExecutionRecord({ executionId, safeSummary: toolError.safeSummary, safeErrorCode: toolError.code });
        return this.buildErrorResult(executionId, traceId, finalState, toolError);
      }

      const toolError = normalizeAthenaError(error, traceId);
      const finalState: AthenaKernelState = "failed";
      await this.safeApplyTerminal(applyTransition, finalState, toolError.code);
      await executionStore.finalizeExecutionRecord({ executionId, safeSummary: toolError.safeSummary, safeErrorCode: toolError.code });
      return this.buildErrorResult(executionId, traceId, finalState, toolError);
    } finally {
      clearTimeout(deadlineTimer);
      input.clientSignal?.removeEventListener("abort", onClientAbort);

      const finalRecord = await executionStore.getExecutionRecord(executionId).catch(() => null);
      const finalState = (finalRecord?.state as AthenaKernelState | undefined) ?? state;
      const kernelStatus: "ok" | "error" | "denied" = finalState === "denied" ? "denied" : finalState === "succeeded" || finalState === "needs_clarification" ? "ok" : "error";
      await emitSpan("kernel", kernelStatus, Date.now() - kernelStart, {
        finalState,
        requestSource: input.request.requestSource,
        canonicalRole,
      });
    }
  }

  private async safeApplyTerminal(
    applyTransition: (to: AthenaKernelState, reasonCode: string) => Promise<void>,
    to: AthenaKernelState,
    reasonCode: string
  ): Promise<void> {
    try {
      await applyTransition(to, reasonCode);
    } catch {
      // The transition may already be illegal (e.g. aborted mid-transition
      // into a terminal state) - the finalized execution record and
      // returned result are still safe/accurate either way.
    }
  }

  private buildClarificationResult(executionId: string, traceId: string): AthenaKernelResult {
    return {
      success: true,
      executionId,
      traceId,
      state: "needs_clarification",
      summary: "Athena needs more detail before it can help.",
      message: null,
      warnings: [],
      followUps: [{ kind: "question", label: "Can you share more detail about what you'd like help with?" }],
      telemetry: { traceId, executionId },
    };
  }

  private buildDeniedResult(executionId: string, traceId: string, reasonCode: string): AthenaKernelResult {
    const error: AthenaToolError = {
      code: reasonCode,
      category: "authorization",
      retryable: false,
      safeSummary: "Athena can't perform that action yet.",
      correlationId: traceId,
    };
    return {
      success: false,
      executionId,
      traceId,
      state: "denied",
      summary: error.safeSummary,
      message: null,
      warnings: [],
      followUps: [{ kind: "question", label: "Ask Athena a question instead of requesting a change." }],
      telemetry: { traceId, executionId },
      error,
    };
  }

  private buildErrorResult(executionId: string, traceId: string, state: AthenaKernelState, error: AthenaToolError): AthenaKernelResult {
    return {
      success: false,
      executionId,
      traceId,
      state,
      summary: error.safeSummary,
      message: null,
      warnings: [],
      followUps: [],
      telemetry: { traceId, executionId },
      error,
    };
  }

  private async produceDraftResponse(input: {
    message: string;
    flags: ReturnType<typeof getAthenaFlags>;
    provider: AthenaProviderAdapter;
    signal: AbortSignal;
    deadline: Date;
    providerDeadlineMs: number;
    abort: (reason: AthenaCancellationReason) => void;
    getCancellationReason: () => AthenaCancellationReason | undefined;
    emitSpan: (spanType: "model", status: "ok" | "error", durationMs: number, metadata: Record<string, unknown>, cost?: AthenaTelemetryCost) => Promise<void>;
  }): Promise<{ summary: string; message: string | null; warnings: { code: string; message: string }[] }> {
    if (!input.flags.draftResponsesEnabled) {
      return {
        summary: "Athena acknowledged your request. Draft responses are disabled in this environment.",
        message: null,
        warnings: [{ code: "athena_draft_responses_disabled", message: "Draft responses are disabled in this environment." }],
      };
    }

    const providerDeadline = new Date(Math.min(input.deadline.getTime(), Date.now() + input.providerDeadlineMs));
    const modelStart = Date.now();

    // The provider deadline passed into generateDraft() is advisory - a
    // non-cooperative provider that ignores its AbortSignal can otherwise
    // hang this await forever, keeping the kernel (and the request-scoped
    // transaction it runs inside) open indefinitely. Race the provider call
    // against a kernel-owned timer so the deadline is enforced here even if
    // the provider promise itself never settles.
    let providerTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const providerTimeoutPromise = new Promise<never>((_, reject) => {
      const remainingMs = Math.max(0, providerDeadline.getTime() - Date.now());
      providerTimeoutTimer = setTimeout(() => {
        input.abort("provider_timeout");
        reject(new AthenaAbortedError("provider_timeout"));
      }, remainingMs);
    });

    try {
      const result = await Promise.race([input.provider.generateDraft({ message: input.message, signal: input.signal, deadline: providerDeadline }), providerTimeoutPromise]);
      // Missing provider usage data is recorded as absent, not estimated
      // from prompt text (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md
      // "Cost attribution"). costTrackingEnabled=false omits the field
      // entirely rather than recording zeroed-out usage.
      const cost: AthenaTelemetryCost | undefined = input.flags.costTrackingEnabled
        ? { provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedUsd: result.estimatedUsd }
        : undefined;
      await input.emitSpan("model", "ok", Date.now() - modelStart, { provider: result.provider, model: result.model }, cost);
      return { summary: "Athena prepared a draft response.", message: result.text, warnings: [] };
    } catch (error) {
      const errorCode = error instanceof AthenaAbortedError ? `athena_${error.reason}` : error instanceof AthenaKernelError ? error.code : "unknown";
      await input.emitSpan("model", "error", Date.now() - modelStart, { errorCode });

      // Our own provider-timeout marker is already correctly typed - let it
      // propagate as-is. Anything else (including a provider-thrown
      // cancellation error) that surfaces while the kernel-owned signal is
      // already aborted did not "fail" on its own terms; it observed a
      // cancellation this kernel already decided on (client disconnect,
      // request deadline, shutdown). Remap it back to that real reason
      // instead of letting it fall through to a generic failed result -
      // otherwise a non-cooperative or slow-to-notice provider can turn a
      // clean cancellation into a misleading "failed" outcome.
      if (error instanceof AthenaAbortedError) {
        throw error;
      }
      if (input.signal.aborted) {
        throw new AthenaAbortedError(input.getCancellationReason() ?? "shutdown");
      }
      throw error;
    } finally {
      clearTimeout(providerTimeoutTimer);
    }
  }
}
