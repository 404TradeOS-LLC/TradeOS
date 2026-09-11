import { randomUUID } from "node:crypto";
import { normalizeRole } from "../../domain";
import type { DomainPermission } from "../../domain";
import type { AthenaAuditStore } from "../athena-audit/types";
import { buildAthenaSecurityAuditEvent } from "../athena-audit/securityEvents";
import type { AthenaAuditEventType, AthenaSecurityAuditEventType, AthenaSecurityAuditOutcome } from "../athena-audit/types";
import { assembleAthenaContext } from "../athena-context-engine/assembler";
import type { AthenaContextRegistry } from "../athena-context-engine/registry";
import type { AthenaApprovalVerifier } from "../athena-action-engine/approval";
import { executeAthenaAction } from "../athena-action-engine/engine";
import type { AthenaIdempotencyStore } from "../athena-action-engine/idempotency";
import type { AthenaMemoryService } from "../athena-memory/service";
import type { AthenaMemoryCandidateExtractor } from "../athena-memory/types";
import { evaluateAthenaChannelToolPolicy } from "../athena-mobile/policy";
import { buildAthenaPlan } from "../athena-planner/planner";
import type { AthenaPlanCandidateTool } from "../athena-planner/types";
import { evaluateAthenaPermission } from "../athena-permissions/policy";
import { routeAthenaRequest, toAthenaRouterResult } from "../athena-router/router";
import { buildAthenaSecurityAuditMetadata } from "../athena-security/audit";
import { evaluateAthenaSecurityRisk } from "../athena-security/riskEngine";
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
import { AthenaActorContext, AthenaAIContext, AthenaCancellationReason, AthenaKernelRequest, AthenaKernelResult, AthenaKernelState, AthenaTelemetryCost, AthenaToolError, AthenaVoiceConfirmationChallenge } from "./types";

export const ATHENA_MAX_MESSAGE_LENGTH = 4_000;
const DEFAULT_REQUEST_DEADLINE_MS = 15_000;
const DEFAULT_PROVIDER_DEADLINE_MS = 8_000;

interface ZodLikeToolInputSchema {
  safeParse(input: unknown): { success: true; data: unknown } | { success: false };
}

function parseToolInput(schema: unknown, value: unknown): { success: true; data: unknown } | { success: false } {
  if (!schema || typeof (schema as { safeParse?: unknown }).safeParse !== "function") return { success: false };
  return (schema as ZodLikeToolInputSchema).safeParse(value);
}

function safeInteraction(request: AthenaKernelRequest): AthenaAIContext["request"]["interaction"] {
  const interaction = request.interaction;
  if (!interaction) return undefined;
  return {
    channel: interaction.channel,
    platform: interaction.platform,
    viewportClass: interaction.viewportClass,
    connectivity: interaction.connectivity,
  };
}

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function persistGenerationWithinDeadline(
  persist: () => Promise<void>,
  deadline: Date,
  signal: AbortSignal,
  abort: (reason: AthenaCancellationReason) => void,
  getCancellationReason: () => AthenaCancellationReason | undefined
): Promise<void> {
  if (signal.aborted) throw new AthenaAbortedError(getCancellationReason() ?? "shutdown");

  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectCancellation: ((reason?: unknown) => void) | undefined;
  const onAbort = () => rejectCancellation?.(new AthenaAbortedError(getCancellationReason() ?? "shutdown"));
  const cancellationPromise = new Promise<never>((_, reject) => { rejectCancellation = reject; });
  signal.addEventListener("abort", onAbort, { once: true });
  const deadlinePromise = new Promise<never>((_, reject) => {
    const remainingMs = Math.max(0, deadline.getTime() - Date.now());
    timeoutTimer = setTimeout(() => {
      abort("deadline_exceeded");
      reject(new AthenaAbortedError("deadline_exceeded"));
    }, remainingMs);
  });

  try {
    await Promise.race([persist(), cancellationPromise, deadlinePromise]);
  } finally {
    clearTimeout(timeoutTimer);
    signal.removeEventListener("abort", onAbort);
  }
}

class AthenaAbortedError extends Error {
  constructor(public readonly reason: AthenaCancellationReason) {
    super(`Athena kernel execution aborted: ${reason}`);
  }
}

function buildApprovalActionId(toolId: string, toolVersion: string, planId: string | undefined, stepId: string | undefined, idempotencyKey: string | undefined): string {
  return [toolId, toolVersion, planId ?? "unknown-plan", stepId ?? "unknown-step", idempotencyKey ?? "missing-key"].join(":");
}

export interface AthenaKernelHandleInput {
  request: AthenaKernelRequest;
  actor: AthenaActorContext;
  requestId: string;
  clientSignal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  provider?: AthenaProviderAdapter;
  contextRegistry?: AthenaContextRegistry;
  toolRegistry?: Pick<AthenaToolRegistry, "discover" | "resolve">;
  candidateTools?: AthenaPlanCandidateTool[];
  approvalId?: string;
  idempotencyKey?: string;
  approvalVerifier?: AthenaApprovalVerifier;
  idempotencyStore?: AthenaIdempotencyStore;
  auditStore?: AthenaAuditStore;
  memoryService?: Pick<AthenaMemoryService, "remember">;
  memoryCandidateExtractor?: AthenaMemoryCandidateExtractor;
}

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

    const controller = new AbortController();
    let cancellationReason: AthenaCancellationReason | undefined;
    const abort = (reason: AthenaCancellationReason) => {
      cancellationReason = cancellationReason ?? reason;
      controller.abort();
    };
    const deadlineTimer = setTimeout(() => abort("deadline_exceeded"), requestDeadlineMs);
    const onClientAbort = () => abort("client_closed");
    input.clientSignal?.addEventListener("abort", onClientAbort);
    if (input.clientSignal?.aborted) abort("client_closed");

    let state: AthenaKernelState = "created";
    let roundTrips = 0;
    const recordAudit = async (
      eventType: AthenaAuditEventType,
      metadata: Record<string, unknown>,
      extras: { actionId?: string; approvalId?: string } = {}
    ) => {
      if (!input.auditStore) return;
      try {
        await input.auditStore.record({
          id: randomUUID(),
          timestamp: new Date(),
          actor: { userId: actor.userId, role: actor.role },
          organization: actor.orgId,
          eventType,
          metadata,
          requestId: input.requestId,
          traceId,
          executionId,
          actionId: extras.actionId,
          approvalId: extras.approvalId,
        });
      } catch {}
    };

    const recordSecurityAudit = async (
      eventType: AthenaSecurityAuditEventType,
      outcome: AthenaSecurityAuditOutcome,
      metadata: Record<string, unknown> = {},
      extras: { actionId?: string; approvalId?: string } = {}
    ) => {
      if (!input.auditStore) return;
      try {
        await input.auditStore.record(
          buildAthenaSecurityAuditEvent({
            eventType,
            organization: actor.orgId,
            actor: { userId: actor.userId, role: actor.role },
            outcome,
            metadata,
            requestId: input.requestId,
            traceId,
            executionId,
            actionId: extras.actionId,
            approvalId: extras.approvalId,
          })
        );
      } catch {}
    };

    const applyTransition = async (to: AthenaKernelState, reasonCode: string, metadata?: Record<string, unknown>) => {
      assertTransition(state, to);
      await executionStore.recordTransition({ executionId, orgId: actor.orgId, fromState: state, toState: to, reasonCode, metadata, roundTrips });
      state = to;
    };

    const enterRoundTripState = async (to: "needs_clarification" | "degraded", reasonCode: string) => {
      roundTrips = nextRoundTripCount(roundTrips, getMaxRoundTrips(env));
      await applyTransition(to, reasonCode);
    };

    const throwIfAborted = () => {
      if (controller.signal.aborted) throw new AthenaAbortedError(cancellationReason ?? "shutdown");
    };

    const emitSpan = async (spanType: "kernel" | "context" | "model" | "approval" | "action" | "memory", status: "ok" | "error" | "denied" | "degraded", durationMs: number, metadata: Record<string, unknown>, cost?: AthenaTelemetryCost) => {
      try {
        await recordAthenaTelemetry(buildTelemetryRecord({ orgId: actor.orgId, requestId: input.requestId, traceId, executionId, spanType, status, durationMs, metadata, cost }), env);
      } catch {}
    };

    try {
      await executionStore.createExecutionRecord({ executionId, orgId: actor.orgId, requestId: input.requestId, traceId, actorUserId: actor.userId, canonicalRole, requestSource: input.request.requestSource });
      await recordAudit("request_received", { requestSource: input.request.requestSource, selectedScope: input.request.selectedScope ?? null });

      const message = input.request.message.trim();
      if (message.length === 0) throw athenaValidationError("A message is required.");
      if (message.length > ATHENA_MAX_MESSAGE_LENGTH) throw athenaValidationError(`Messages must be ${ATHENA_MAX_MESSAGE_LENGTH} characters or fewer.`);

      throwIfAborted();
      await applyTransition("context_building", "context_assembly_started");
      const contextStart = Date.now();
      let context = buildMinimalAthenaContext({ requestId: input.requestId, traceId, executionId, actor, request: input.request });
      await emitSpan("context", "ok", Date.now() - contextStart, {
        sectionsIncluded: ["request", "organization", "user", "permissions", "selectedScope", "telemetry", ...(context.conversation ? ["conversation"] : [])],
        sectionsOmitted: ["weather", "calendar", "dispatch", "customers", "costbook", "knowledgeEngine", "inventory", "notifications", "mobile"],
        maxBytes: context.budget.maxBytes,
      });
      await recordAudit("context_gathered", { sectionsIncluded: ["request", "organization", "user", "permissions", "selectedScope", "telemetry", ...(context.conversation ? ["conversation"] : [])] });

      throwIfAborted();
      await applyTransition("routing", "context_ready");

      if (message.length < 3) {
        await enterRoundTripState("needs_clarification", "message_too_short");
        const clarification = this.buildClarificationResult(executionId, traceId);
        await executionStore.finalizeExecutionRecord({ executionId, safeSummary: clarification.summary });
        return clarification;
      }

      if (!flags.routerPlannerEnabled) {
        const capability = classifyAthenaCapability(message);
        throwIfAborted();
        await applyTransition("planning", "capability_classified", { capability });
        throwIfAborted();
        await applyTransition("policy_check", "plan_ready");
        const policyStart = Date.now();
        const decision = evaluateAthenaPolicy({ rawRole: input.actor.role, orgId: actor.orgId, userId: actor.userId, capability });
        await emitSpan("approval", decision.decision === "allow" ? "ok" : "denied", Date.now() - policyStart, {
          capability: decision.capability, reasonCode: decision.reasonCode, decision: decision.decision, deniedFields: decision.deniedFields,
        });
        if (decision.decision !== "allow") {
          await recordSecurityAudit("privilege_denied", "denied", { capability, decision: decision.decision, reasonCode: decision.reasonCode });
          await applyTransition("denied", decision.reasonCode);
          const denied = this.buildDeniedResult(executionId, traceId, decision.reasonCode);
          await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
          return denied;
        }
      } else {
        const routing = routeAthenaRequest(message);
        const routerDecision = routing.decision;
        const routerResult = toAthenaRouterResult(routerDecision);

        // A14: assemble all requested context before planning/execution so the
        // exact same authorized snapshot reaches tools and model generation.
        // Mobile is explicit-only and is requested only for mobile/voice
        // channels, so normal text dispatch requests do not pay for it.
        const mobileInteraction = input.request.interaction?.channel === "mobile" || input.request.interaction?.channel === "voice";
        if (routerResult.requestedContextIntents.length > 0 || mobileInteraction) {
          throwIfAborted();
          const liveContextStart = Date.now();
          const contextRegistry = input.contextRegistry ?? createLiveAthenaContextRegistry();
          const assemblyResult = await assembleAthenaContext(contextRegistry, {
            orgId: actor.orgId,
            actor: { userId: actor.userId, role: actor.role },
            permissions: [...actor.permissions],
            selectedScope: context.selectedScope,
            interaction: safeInteraction(input.request),
            featureFlags: [],
            requestedIntents: routerResult.requestedContextIntents,
            explicitSections: mobileInteraction ? ["mobile"] : [],
            clientSignal: controller.signal,
          });
          context = { ...context, ...assemblyResult.sections };
          await emitSpan("context", assemblyResult.stoppedByCriticalFailure ? "degraded" : "ok", Date.now() - liveContextStart, {
            sectionsIncluded: Object.keys(assemblyResult.sections),
            requestedIntents: routerResult.requestedContextIntents,
            explicitSections: mobileInteraction ? ["mobile"] : [],
            routingStrategy: routerDecision.strategyId,
            fallbackApplied: routerDecision.fallbackApplied,
          });
        }

        throwIfAborted();
        await applyTransition("planning", "intent_classified", { intent: routerResult.intent, routingStrategy: routerDecision.strategyId, fallbackApplied: routerDecision.fallbackApplied });

        const toolRegistry = input.toolRegistry ?? createAthenaToolRegistry();
        const candidateTools: AthenaPlanCandidateTool[] = input.candidateTools ?? toolRegistry.discover({ role: actor.role, featureFlags: [] }).map((tool) => ({ toolId: tool.id, toolVersion: tool.version, summary: tool.description, input: {} }));
        const plan = buildAthenaPlan({ routerResult, candidateTools, toolRegistry });
        await recordAudit("tools_considered", { intent: routerResult.intent, toolIds: candidateTools.map((tool) => tool.toolId), planId: plan.planId, stepCount: plan.steps.length });

        throwIfAborted();
        await applyTransition("policy_check", "plan_ready", { planId: plan.planId, planStatus: plan.status });
        const policyStart = Date.now();
        let lastSuccessfulToolResult: AthenaKernelResult | null = null;

        if (plan.status === "needs_clarification") {
          const decision = evaluateAthenaPolicy({ rawRole: input.actor.role, orgId: actor.orgId, userId: actor.userId, capability: "mutate_business_record" });
          await emitSpan("approval", "denied", Date.now() - policyStart, { capability: decision.capability, reasonCode: decision.reasonCode, decision: decision.decision, deniedFields: decision.deniedFields, planId: plan.planId });
          await recordSecurityAudit("privilege_denied", "denied", { capability: decision.capability, decision: decision.decision, reasonCode: decision.reasonCode, planId: plan.planId });
          await applyTransition("denied", decision.reasonCode);
          const denied = this.buildDeniedResult(executionId, traceId, decision.reasonCode);
          await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
          return denied;
        }

        for (const step of plan.steps) {
          if (step.kind !== "tool_call") continue;

          const resolution = toolRegistry.resolve(step.toolId, step.toolVersion);
          if (resolution.outcome !== "found") {
            const reasonCode = "athena_tool_call_step_unresolvable";
            await recordSecurityAudit("privilege_denied", "denied", { reasonCode, planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion });
            await emitSpan("approval", "denied", Date.now() - policyStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, reasonCode });
            await applyTransition("denied", reasonCode);
            const denied = this.buildDeniedResult(executionId, traceId, reasonCode);
            await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
            return denied;
          }

          const tool = resolution.definition;
          const resourceEntityId = tool.resourceScope?.getEntityId(step.input);
          const resourceRequest = tool.resourceScope && resourceEntityId ? { entityType: tool.resourceScope.entityType, entityId: resourceEntityId } : undefined;
          const stepDecision = await evaluateAthenaPermission({
            rawRole: input.actor.role,
            orgId: actor.orgId,
            userId: actor.userId,
            grantedPermissions: actor.permissions as DomainPermission[],
            request: { kind: "tool", id: step.toolId, requiredPermissions: tool.permissions as DomainPermission[], risk: tool.risk, ...(resourceRequest ? { resourceRequest } : {}) },
          });

          if (stepDecision.decision === "deny") {
            await recordSecurityAudit("privilege_denied", "denied", { decision: stepDecision.decision, reasonCode: stepDecision.reasonCode, planId: plan.planId, stepId: step.stepId, toolId: step.toolId });
            await emitSpan("approval", "denied", Date.now() - policyStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, decision: stepDecision.decision, reasonCode: stepDecision.reasonCode });
            await applyTransition("denied", stepDecision.reasonCode);
            const denied = this.buildDeniedResult(executionId, traceId, stepDecision.reasonCode);
            await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
            return denied;
          }

          if (!flags.actionEngineEnabled) {
            if (stepDecision.decision === "approval_required") {
              const reasonCode = "athena_approval_required_no_action_engine";
              await recordAudit("approval_requested", { toolId: step.toolId, planId: plan.planId, stepId: step.stepId, reasonCode }, { actionId: buildApprovalActionId(step.toolId, step.toolVersion, plan.planId, step.stepId, input.idempotencyKey), approvalId: input.approvalId });
              await emitSpan("approval", "degraded", Date.now() - policyStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, decision: stepDecision.decision, reasonCode });
              await recordSecurityAudit("sensitive_action_attempted", "denied", { decision: stepDecision.decision, reasonCode, planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, riskLevel: tool.risk }, { approvalId: input.approvalId });
              await applyTransition("denied", reasonCode);
              const denied = this.buildDeniedResult(executionId, traceId, reasonCode);
              await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
              return denied;
            }
            await emitSpan("approval", "ok", Date.now() - policyStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, decision: stepDecision.decision, reasonCode: stepDecision.reasonCode });
            continue;
          }

          await emitSpan("approval", stepDecision.decision === "allow" ? "ok" : "degraded", Date.now() - policyStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, decision: stepDecision.decision, reasonCode: stepDecision.reasonCode });

          const securityStart = Date.now();
          const securityDecision = evaluateAthenaSecurityRisk({
            orgId: actor.orgId,
            tool: { id: tool.id, owner: tool.owner, risk: tool.risk, deprecated: tool.deprecated },
            toolInput: step.input,
            permissionDecision: { decision: stepDecision.decision, reasonCode: stepDecision.reasonCode },
          });
          await emitSpan("approval", securityDecision.decision === "allow" ? "ok" : "denied", Date.now() - securityStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, layer: "athena_security_risk_engine", ...buildAthenaSecurityAuditMetadata(securityDecision) });
          await recordSecurityAudit("security_decision", securityDecision.decision === "allow" ? "allowed" : "denied", {
            decision: securityDecision.decision, layer: "athena_security_risk_engine", planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, riskLevel: securityDecision.riskLevel, securityDecision: securityDecision.decision, securityReasons: securityDecision.reasons, securityRequiredControls: securityDecision.requiredControls,
          });

          if (securityDecision.decision === "deny") {
            const reasonCode = securityDecision.reasons[0];
            const securityEventType = reasonCode === "athena_security_denied_cross_tenant_reference" ? "tenant_access_denied" : "sensitive_action_attempted";
            await recordSecurityAudit(securityEventType, "denied", { reasonCode, planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, riskLevel: securityDecision.riskLevel });
            await recordAudit("failure", { toolId: step.toolId, planId: plan.planId, stepId: step.stepId, reasonCode, security: buildAthenaSecurityAuditMetadata(securityDecision) });
            await applyTransition("denied", reasonCode);
            const denied = this.buildDeniedResult(executionId, traceId, reasonCode);
            await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
            return denied;
          }

          // A14 voice confirmation is a kernel round-trip, not a successful
          // action. Resolve it after A4/A11 but before A6 so no idempotency
          // reservation or action-success audit can be created for a no-op.
          if (input.request.interaction?.channel === "voice") {
            const parsed = parseToolInput(tool.inputSchema, step.input);
            if (parsed.success) {
              const channelDecision = evaluateAthenaChannelToolPolicy({ interaction: input.request.interaction, tool, validatedInput: parsed.data, env });
              if (channelDecision.decision === "deny") {
                await recordSecurityAudit("security_decision", "denied", { layer: "athena_channel_policy", reasonCode: channelDecision.reasonCode, toolId: tool.id, toolVersion: tool.version, planId: plan.planId, stepId: step.stepId });
                await applyTransition("denied", channelDecision.reasonCode);
                const denied = this.buildDeniedResult(executionId, traceId, channelDecision.reasonCode);
                await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
                return denied;
              }
              if (channelDecision.decision === "confirm") {
                await emitSpan("approval", "degraded", Date.now() - policyStart, { layer: "athena_channel_policy", reasonCode: channelDecision.reasonCode, toolId: tool.id, toolVersion: tool.version, planId: plan.planId, stepId: step.stepId });
                await enterRoundTripState("needs_clarification", channelDecision.reasonCode);
                const confirmation = this.buildVoiceConfirmationResult(executionId, traceId, channelDecision.challenge);
                await executionStore.finalizeExecutionRecord({ executionId, safeSummary: confirmation.summary });
                return confirmation;
              }
            }
          }

          throwIfAborted();
          const actionAuditId = buildApprovalActionId(step.toolId, step.toolVersion, plan.planId, step.stepId, input.idempotencyKey);
          await recordAudit("action_attempted", {
            toolId: step.toolId, planId: plan.planId, stepId: step.stepId, permissionDecision: stepDecision.decision, permissionReasonCode: stepDecision.reasonCode, permissionContext: stepDecision.permissionContext,
          }, { actionId: actionAuditId, approvalId: input.approvalId });
          await recordSecurityAudit("sensitive_action_attempted", "attempted", { decision: stepDecision.decision, reasonCode: stepDecision.reasonCode, planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, riskLevel: tool.risk }, { actionId: actionAuditId, approvalId: input.approvalId });

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
          await emitSpan("action", actionStatus, Date.now() - actionStart, { planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolName: actionOutcome.result.name, toolVersion: step.toolVersion, actionId: actionOutcome.result.actionId, state: actionState, reasonCode: actionOutcome.audit.reasonCode });

          if (actionState !== "succeeded") {
            const toolError = actionOutcome.result.toolResult.error ?? normalizeAthenaError(new Error("athena_action_failed"), traceId);
            await recordSecurityAudit("sensitive_action_completed", actionState === "denied" || actionState === "awaiting_approval" ? "denied" : "failed", {
              decision: stepDecision.decision, reasonCode: toolError.code, planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, riskLevel: tool.risk,
            }, { actionId: actionAuditId, approvalId: input.approvalId });
            if (actionState === "denied" || actionState === "awaiting_approval") {
              if (actionState === "awaiting_approval") {
                await recordAudit("approval_requested", { toolId: step.toolId, planId: plan.planId, stepId: step.stepId, reasonCode: toolError.code }, { actionId: actionAuditId, approvalId: input.approvalId });
              } else {
                await recordAudit("failure", { toolId: step.toolId, planId: plan.planId, stepId: step.stepId, reasonCode: toolError.code }, { actionId: actionAuditId, approvalId: input.approvalId });
              }
              await applyTransition("denied", toolError.code);
              const denied = this.buildDeniedResult(executionId, traceId, toolError.code);
              await executionStore.finalizeExecutionRecord({ executionId, safeSummary: denied.summary, safeErrorCode: denied.error?.code });
              return denied;
            }
            const finalState: AthenaKernelState = actionState === "expired" ? "expired" : actionState === "cancelled" ? "cancelled" : "failed";
            await recordAudit("failure", { toolId: step.toolId, planId: plan.planId, stepId: step.stepId, reasonCode: toolError.code, finalState }, { actionId: actionAuditId, approvalId: input.approvalId });
            await applyTransition(finalState, toolError.code);
            const failure = this.buildErrorResult(executionId, traceId, finalState, toolError);
            await executionStore.finalizeExecutionRecord({ executionId, safeSummary: failure.summary, safeErrorCode: failure.error?.code });
            return failure;
          }

          lastSuccessfulToolResult = {
            success: true,
            executionId,
            traceId,
            state: "succeeded",
            summary: actionOutcome.result.toolResult.summary,
            message: actionOutcome.result.toolResult.summary,
            warnings: actionOutcome.result.toolResult.warnings,
            followUps: actionOutcome.result.toolResult.followUps,
            telemetry: { traceId, executionId },
          };
          await recordAudit("execution_completed", { toolId: step.toolId, planId: plan.planId, stepId: step.stepId, summary: actionOutcome.result.toolResult.summary });
          await recordSecurityAudit("sensitive_action_completed", "succeeded", { decision: stepDecision.decision, planId: plan.planId, stepId: step.stepId, toolId: step.toolId, toolVersion: step.toolVersion, riskLevel: tool.risk }, { actionId: actionAuditId, approvalId: input.approvalId });

          if (input.memoryCandidateExtractor && input.memoryService) {
            const memoryStart = Date.now();
            try {
              const candidates = await input.memoryCandidateExtractor({
                orgId: actor.orgId,
                actor: { orgId: actor.orgId, userId: actor.userId, role: actor.role },
                action: { actionId: actionOutcome.result.actionId, toolId: step.toolId, toolVersion: step.toolVersion, state: actionState, data: actionOutcome.result.toolResult.data },
              });
              for (const candidate of candidates) await input.memoryService.remember(candidate);
              await emitSpan("memory", "ok", Date.now() - memoryStart, { planId: plan.planId, stepId: step.stepId, candidateCount: candidates.length });
            } catch {
              await emitSpan("memory", "degraded", Date.now() - memoryStart, { planId: plan.planId, stepId: step.stepId });
            }
          }
        }

        await emitSpan("approval", "ok", Date.now() - policyStart, { planId: plan.planId, planStatus: plan.status, intent: plan.intent });

        if (lastSuccessfulToolResult) {
          await applyTransition("succeeded", "tool_action_completed");
          await executionStore.finalizeExecutionRecord({ executionId, safeSummary: lastSuccessfulToolResult.summary });
          return lastSuccessfulToolResult;
        }
      }

      if (Date.now() > deadline.getTime() || controller.signal.aborted) throw new AthenaAbortedError(cancellationReason ?? "deadline_exceeded");

      const draftResult = await this.produceDraftResponse({
        message,
        context,
        flags,
        provider: input.provider ?? resolveAthenaProvider(env),
        signal: controller.signal,
        deadline,
        providerDeadlineMs,
        generationRetentionDays: parsePositiveIntEnv(env.ATHENA_GENERATION_RETENTION_DAYS, 90),
        abort,
        getCancellationReason: () => cancellationReason,
        emitSpan,
        persistGeneration: async (generation) => executionStore.persistGenerationRecord({ ...generation, orgId: actor.orgId, actorUserId: actor.userId, executionId, requestId: input.requestId, traceId }),
      });

      await applyTransition("succeeded", "draft_response_completed");
      await executionStore.finalizeExecutionRecord({ executionId, safeSummary: draftResult.summary });
      return { success: true, executionId, traceId, state: "succeeded", summary: draftResult.summary, message: draftResult.message, warnings: draftResult.warnings, followUps: [], telemetry: { traceId, executionId } };
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
      await emitSpan("kernel", kernelStatus, Date.now() - kernelStart, { finalState, requestSource: input.request.requestSource, canonicalRole });
    }
  }

  private async safeApplyTerminal(applyTransition: (to: AthenaKernelState, reasonCode: string) => Promise<void>, to: AthenaKernelState, reasonCode: string): Promise<void> {
    try { await applyTransition(to, reasonCode); } catch {}
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

  private buildVoiceConfirmationResult(executionId: string, traceId: string, challenge: AthenaVoiceConfirmationChallenge): AthenaKernelResult {
    return {
      success: true,
      executionId,
      traceId,
      state: "needs_clarification",
      summary: challenge.prompt,
      message: null,
      warnings: [{ code: "athena_voice_confirmation_required", message: "No business change was made. Explicit voice confirmation is required." }],
      followUps: [{ kind: "action", label: `Confirm ${challenge.toolId}@${challenge.toolVersion}` }],
      telemetry: { traceId, executionId },
      voiceConfirmation: challenge,
    };
  }

  private buildDeniedResult(executionId: string, traceId: string, reasonCode: string): AthenaKernelResult {
    const error: AthenaToolError = { code: reasonCode, category: "authorization", retryable: false, safeSummary: "Athena can't perform that action yet.", correlationId: traceId };
    return { success: false, executionId, traceId, state: "denied", summary: error.safeSummary, message: null, warnings: [], followUps: [{ kind: "question", label: "Ask Athena a question instead of requesting a change." }], telemetry: { traceId, executionId }, error };
  }

  private buildErrorResult(executionId: string, traceId: string, state: AthenaKernelState, error: AthenaToolError): AthenaKernelResult {
    return { success: false, executionId, traceId, state, summary: error.safeSummary, message: null, warnings: [], followUps: [], telemetry: { traceId, executionId }, error };
  }

  private async produceDraftResponse(input: {
    message: string;
    context: AthenaAIContext;
    flags: ReturnType<typeof getAthenaFlags>;
    provider: AthenaProviderAdapter;
    signal: AbortSignal;
    deadline: Date;
    providerDeadlineMs: number;
    generationRetentionDays: number;
    abort: (reason: AthenaCancellationReason) => void;
    getCancellationReason: () => AthenaCancellationReason | undefined;
    emitSpan: (spanType: "model", status: "ok" | "error", durationMs: number, metadata: Record<string, unknown>, cost?: AthenaTelemetryCost) => Promise<void>;
    persistGeneration: (generation: {
      provider: string;
      model: string;
      providerVersion?: string;
      status: "succeeded";
      inputTokens?: number;
      outputTokens?: number;
      estimatedUsd?: number;
      latencyMs: number;
      provenance?: Record<string, unknown>;
      retentionExpiresAt: Date;
      completedAt: Date;
    }) => Promise<void>;
  }): Promise<{ summary: string; message: string | null; warnings: { code: string; message: string }[] }> {
    if (!input.flags.draftResponsesEnabled) {
      return { summary: "Athena acknowledged your request. Draft responses are disabled in this environment.", message: null, warnings: [{ code: "athena_draft_responses_disabled", message: "Draft responses are disabled in this environment." }] };
    }

    const providerDeadline = new Date(Math.min(input.deadline.getTime(), Date.now() + input.providerDeadlineMs));
    const modelStart = Date.now();
    let providerTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const providerTimeoutPromise = new Promise<never>((_, reject) => {
      const remainingMs = Math.max(0, providerDeadline.getTime() - Date.now());
      providerTimeoutTimer = setTimeout(() => {
        input.abort("provider_timeout");
        reject(new AthenaAbortedError("provider_timeout"));
      }, remainingMs);
    });

    try {
      const result = await Promise.race([input.provider.generateDraft({ message: input.message, context: input.context, signal: input.signal, deadline: providerDeadline }), providerTimeoutPromise]);
      clearTimeout(providerTimeoutTimer);
      providerTimeoutTimer = undefined;
      const cost: AthenaTelemetryCost | undefined = input.flags.costTrackingEnabled
        ? { provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedUsd: result.estimatedUsd }
        : undefined;
      await input.emitSpan("model", "ok", Date.now() - modelStart, { provider: result.provider, model: result.model }, cost);
      await persistGenerationWithinDeadline(
        () => input.persistGeneration({
          provider: result.provider,
          model: result.model,
          providerVersion: result.providerVersion,
          status: "succeeded",
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedUsd: result.estimatedUsd,
          latencyMs: Date.now() - modelStart,
          provenance: { source: "athena_kernel", executionState: "succeeded" },
          retentionExpiresAt: new Date(Date.now() + input.generationRetentionDays * 24 * 60 * 60 * 1000),
          completedAt: new Date(),
        }),
        input.deadline,
        input.signal,
        input.abort,
        input.getCancellationReason
      );
      if (input.signal.aborted) throw new AthenaAbortedError(input.getCancellationReason() ?? "shutdown");
      return { summary: "Athena prepared a draft response.", message: result.text, warnings: [] };
    } catch (error) {
      const errorCode = error instanceof AthenaAbortedError ? `athena_${error.reason}` : error instanceof AthenaKernelError ? error.code : "unknown";
      await input.emitSpan("model", "error", Date.now() - modelStart, { errorCode });
      if (error instanceof AthenaAbortedError) throw error;
      if (input.signal.aborted) throw new AthenaAbortedError(input.getCancellationReason() ?? "shutdown");
      throw error;
    } finally {
      clearTimeout(providerTimeoutTimer);
    }
  }
}
