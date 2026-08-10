import type { CanonicalRole } from "../../domain";
import type { AthenaAIContext, AthenaToolError } from "../athena-kernel/types";
import type { AthenaPermissionDecision } from "../athena-permissions/types";
import type { AthenaToolCompensationPolicy, AthenaToolResult } from "../athena-tool-registry/types";

// A6 Action Engine contracts (docs/athena/roadmap/A6-action-engine-implementation-plan.md,
// C005 in docs/athena/contracts/README.md). AthenaAction below is the exact
// C005 shape, not a parallel invention - the task brief for A6 explicitly
// requires reusing an existing numbered contract over inventing a competing
// one. C005 itself carries no planId/stepId/executionId/traceId/requestId -
// those are runtime correlation fields, not part of the durable action
// record, so they live on AthenaActionExecutionRequest instead (the same
// split athena-tool-registry/dispatcher.ts already draws between its
// AthenaToolDispatchRequest wrapper and the C003 AthenaToolResult it
// produces).

// C005 AthenaAction.status v1.0.0, verbatim from docs/athena/contracts/README.md.
// This is a *different* state universe than AthenaKernelState
// (athena-kernel/types.ts) - an action's lifecycle is self-contained and
// does not extend or alias the kernel's own 15-state machine. See
// lifecycle.ts's module comment for why athena-kernel/lifecycle.ts is never
// modified by A6.
export const athenaActionStates = ["created", "pending", "running", "awaiting_approval", "partially_succeeded", "succeeded", "failed", "denied", "expired", "cancelled"] as const;
export type AthenaActionState = (typeof athenaActionStates)[number];

// C005 Action v1.0.0, verbatim shape from docs/athena/contracts/README.md.
export interface AthenaAction {
  id: string;
  version: "1.0.0";
  orgId: string;
  actorUserId: string;
  toolId: string;
  toolVersion: string;
  input: unknown;
  risk: "low" | "medium" | "high";
  approvalId?: string;
  idempotencyKey: string;
  status: AthenaActionState;
  attempt: number;
  checkpoint?: Record<string, unknown>;
  compensationPolicy: AthenaToolCompensationPolicy;
  lastError?: AthenaToolError;
}

// A6-internal request wrapper (not a numbered C0xx contract, mirroring
// athena-tool-registry/dispatcher.ts's AthenaToolDispatchRequest). Carries
// every correlation ID the kernel already has plus the one thing A6 must
// never compute itself: `permissionDecision`, the already-evaluated A4
// AthenaPermissionDecision for this exact step. A6 consumes that decision;
// it never re-derives permissions, resource scope, or risk on its own (see
// engine.ts's module comment).
export interface AthenaActionExecutionRequest<TInput = unknown> {
  planId?: string;
  stepId?: string;
  requestId: string;
  traceId: string;
  executionId: string;
  orgId: string;
  actor: { type: "user" | "system"; id: string };
  role: CanonicalRole;
  toolId: string;
  toolVersion: string;
  input: TInput;
  aiContext: AthenaAIContext;
  // The registered tool's own declared risk (C002/A2), threaded through by
  // the caller rather than re-derived here - the same value the caller
  // already passed into evaluateAthenaPermission()'s AthenaToolCapabilityRequest.
  // C005 requires AthenaAction.risk; AthenaPermissionDecision (C007) itself
  // carries no risk field, so this is the only place A6 can get it from
  // without re-resolving the tool before permission enforcement runs.
  risk: "low" | "medium" | "high";
  // The A4 decision this exact step already received from
  // evaluateAthenaPermission() (athena-permissions/policy.ts). A6 enforces
  // it; it does not recompute it.
  permissionDecision: AthenaPermissionDecision;
  // Caller-supplied approval reference for an approval_required decision.
  // Verified through the injected AthenaApprovalVerifier - never trusted
  // merely because it is present (see approval.ts).
  approvalId?: string;
  // Caller-supplied idempotency key. Required for idempotency: "required"
  // tools (enforced by engine.ts before any input validation or execution),
  // optional for "optional" tools, ignored for "not_supported" tools.
  idempotencyKey?: string;
  featureFlags: string[];
  // External cancellation source (e.g. the kernel's own request-deadline
  // AbortController), separate from the engine-owned tool-timeout deadline -
  // mirrors athena-tool-registry/dispatcher.ts's clientSignal pattern.
  clientSignal?: AbortSignal;
}

// A6 Action Result envelope - never the raw AthenaToolResult a handler
// returned. Distinguishes the action-level outcome (state) from the C003
// tool-level outcome (toolResult), so a caller can tell "the permission
// layer denied this before any tool ran" apart from "the tool itself
// reported a business failure" without inspecting error codes.
export interface AthenaActionResult<TData = unknown> {
  version: "1.0.0";
  actionId: string;
  planId?: string;
  stepId?: string;
  state: AthenaActionState;
  toolId: string;
  toolVersion: string;
  idempotencyKey: string;
  compensationPolicy: AthenaToolCompensationPolicy;
  toolResult: AthenaToolResult<TData>;
}

// Internal-only audit taxonomy (never returned to a caller directly),
// mirroring athena-tool-registry/types.ts's AthenaToolDispatchAudit /
// AthenaToolDispatchReasonCode. The kernel folds this into its own telemetry
// span metadata (spanType "action", already reserved in
// athena-kernel/types.ts's AthenaTelemetrySpanType union) rather than A6
// writing telemetry itself - A6 has no telemetry/db import, same posture as
// athena-tool-registry/dispatcher.ts.
export type AthenaActionReasonCode =
  | "executed"
  | "permission_denied"
  | "approval_missing"
  | "approval_invalid"
  | "approval_granted"
  | "tool_not_found"
  | "tool_version_not_found"
  | "tool_removed"
  | "invalid_input"
  | "idempotency_key_required"
  | "idempotent_duplicate_suppressed"
  | "timeout"
  | "cancelled"
  | "invalid_result_envelope"
  | "tool_failed"
  | "unexpected_error";

export interface AthenaActionAudit {
  reasonCode: AthenaActionReasonCode;
  actionId: string;
  toolId: string;
  toolVersion: string;
  idempotencyKey: string;
  compensationPolicy: AthenaToolCompensationPolicy;
  attempt: number;
}

export interface AthenaActionOutcome<TData = unknown> {
  // The durable C005 action record itself, materialized on every call (not
  // only in tests) - engine.ts is the one place that actually builds this
  // shape, so a future persistence layer (see idempotency.ts's/approval.ts's
  // deferred-persistence module comments) has a ready-made value to store
  // rather than needing to reconstruct it from `result`/`audit`.
  action: AthenaAction;
  result: AthenaActionResult<TData>;
  audit: AthenaActionAudit;
}
