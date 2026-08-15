import type { AthenaErrorCategory, AthenaToolError } from "../athena-kernel/types";
import type { AthenaActionReasonCode } from "./types";

// A6 action-dispatch error taxonomy, mirroring athena-tool-registry/errors.ts's
// AthenaToolDispatchError posture: every thrown error here carries a
// caller-safe `publicError` (the only thing that can ever reach a result
// envelope or a user-visible summary) plus an internal-only `reasonCode`
// used solely for audit/telemetry. No raw exception message, stack trace,
// or tool-internal detail is ever assigned to `publicError.safeSummary`.
export class AthenaActionDispatchError extends Error {
  constructor(
    public readonly reasonCode: AthenaActionReasonCode,
    public readonly publicError: AthenaToolError
  ) {
    super(publicError.safeSummary);
  }
}

function buildError(code: string, category: AthenaErrorCategory, retryable: boolean, safeSummary: string, correlationId: string): AthenaToolError {
  return { code, category, retryable, safeSummary, correlationId };
}

export function athenaActionPermissionDeniedError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("permission_denied", buildError("athena_action_permission_denied", "authorization", false, "Athena can't perform that action.", correlationId));
}

export function athenaActionPermissionDecisionMismatchError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("permission_decision_mismatch", buildError("athena_action_permission_denied", "authorization", false, "Athena can't perform that action.", correlationId));
}

export function athenaActionApprovalRequiredError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("approval_missing", buildError("athena_action_approval_required", "authorization", false, "This action requires approval before Athena can run it.", correlationId));
}

export function athenaActionToolNotFoundError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("tool_not_found", buildError("athena_action_tool_not_found", "service", false, "Athena could not complete this action.", correlationId));
}

export function athenaActionToolVersionNotFoundError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("tool_version_not_found", buildError("athena_action_tool_version_not_found", "service", false, "Athena could not complete this action.", correlationId));
}

export function athenaActionToolRemovedError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("tool_removed", buildError("athena_action_tool_removed", "conflict", false, "This Athena action's tool has been removed.", correlationId));
}

export function athenaActionInvalidInputError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("invalid_input", buildError("athena_action_invalid_input", "validation", false, "Athena could not validate the input for this action.", correlationId));
}

export function athenaActionIdempotencyKeyRequiredError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("idempotency_key_required", buildError("athena_action_idempotency_key_required", "validation", false, "This action requires an idempotency key.", correlationId));
}

export function athenaActionIdempotencyConflictError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("idempotency_conflict", buildError("athena_action_idempotency_conflict", "conflict", true, "This action conflicts with an existing idempotency key.", correlationId));
}

export function athenaActionTimeoutError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("timeout", buildError("athena_action_timeout", "timeout", true, "Athena did not get a response from this action in time.", correlationId));
}

export function athenaActionCancelledError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("cancelled", buildError("athena_action_cancelled", "timeout", false, "This action was cancelled.", correlationId));
}

export function athenaActionInvalidResultError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("invalid_result_envelope", buildError("athena_action_invalid_result", "service", false, "Athena could not complete this action.", correlationId));
}

export function athenaActionUnexpectedError(correlationId: string): AthenaActionDispatchError {
  return new AthenaActionDispatchError("unexpected_error", buildError("athena_action_unknown_error", "unknown", false, "Athena could not complete this action.", correlationId));
}
