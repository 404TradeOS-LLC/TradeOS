import type { AthenaErrorCategory, AthenaToolError } from "../athena-kernel/types";
import type { AthenaToolDispatchReasonCode } from "./types";

// A2 tool-dispatch error taxonomy. Reuses AthenaToolError's shape from
// athena-kernel/types.ts (a type-only import) instead of inventing a
// parallel one (docs/athena/roadmap/A2-tool-registry-implementation-plan.md
// "Required Backend Seams"). AthenaToolDispatchError carries a caller-visible
// `publicError` plus an internal-only `reasonCode` so authorization denials
// can be indistinguishable from unknown-tool responses to a caller while
// telemetry/audit retains the true reason (see "Permission And
// Risk-Classification Enforcement Outside The LLM").
export class AthenaToolDispatchError extends Error {
  constructor(
    public readonly reasonCode: AthenaToolDispatchReasonCode,
    public readonly publicError: AthenaToolError,
    // Internal-only, never part of `publicError` - carries the A11
    // buildAthenaSecurityAuditMetadata() shape when this error was thrown
    // for a security-gate denial, so the dispatcher's catch block can attach
    // it to AthenaToolDispatchAudit.securityMetadata instead of a security
    // denial being indistinguishable from a permission denial in the audit
    // record (see athenaToolNotFoundError's own comment on why the two
    // remain the same *public* not-found shape).
    public readonly metadata?: Record<string, unknown>
  ) {
    super(publicError.safeSummary);
  }
}

function buildError(code: string, category: AthenaErrorCategory, retryable: boolean, safeSummary: string, correlationId: string): AthenaToolError {
  return { code, category, retryable, safeSummary, correlationId };
}

const NOT_FOUND_SAFE_SUMMARY = "That Athena tool is not available.";

// Authorization (and feature-flag) denials deliberately call this same
// factory with reasonCode "authorization_denied" so their public shape is
// byte-for-byte identical to an unknown tool ID - only the internal
// reasonCode differs, and only the audit record ever sees it. This prevents
// a registry-existence oracle (docs/athena/roadmap/
// A2-tool-registry-implementation-plan.md "Registry-enumeration risk").
// A4 adds "approval_required" to this same not-found-shaped factory for the
// identical reason: a caller who is permission-granted but risk-blocked
// must not learn that fact through a distinguishable error shape, only the
// audit record should differ.
export function athenaToolNotFoundError(correlationId: string, reasonCode: "tool_not_found" | "authorization_denied" | "approval_required" = "tool_not_found", metadata?: Record<string, unknown>): AthenaToolDispatchError {
  return new AthenaToolDispatchError(reasonCode, buildError("athena_tool_not_found", "validation", false, NOT_FOUND_SAFE_SUMMARY, correlationId), metadata);
}

export function athenaToolVersionNotFoundError(correlationId: string): AthenaToolDispatchError {
  return new AthenaToolDispatchError("tool_version_not_found", buildError("athena_tool_version_not_found", "validation", false, "That version of this Athena tool is not available.", correlationId));
}

export function athenaToolRemovedError(correlationId: string): AthenaToolDispatchError {
  return new AthenaToolDispatchError("tool_removed", buildError("athena_tool_removed", "conflict", false, "This Athena tool has been removed.", correlationId));
}

export function athenaToolInvalidInputError(correlationId: string): AthenaToolDispatchError {
  return new AthenaToolDispatchError("invalid_input", buildError("athena_tool_invalid_input", "validation", false, "Athena could not validate the input for this tool.", correlationId));
}

export function athenaToolTimeoutError(correlationId: string): AthenaToolDispatchError {
  return new AthenaToolDispatchError("timeout", buildError("athena_tool_timeout", "timeout", true, "Athena did not get a response from this tool in time.", correlationId));
}

export function athenaToolCancelledError(correlationId: string): AthenaToolDispatchError {
  return new AthenaToolDispatchError("cancelled", buildError("athena_tool_cancelled", "timeout", false, "This tool call was cancelled.", correlationId));
}

export function athenaToolInvalidResultError(correlationId: string): AthenaToolDispatchError {
  return new AthenaToolDispatchError("invalid_result_envelope", buildError("athena_tool_invalid_result", "service", false, "Athena could not complete this tool call.", correlationId));
}

export function athenaToolUnexpectedError(correlationId: string): AthenaToolDispatchError {
  return new AthenaToolDispatchError("unexpected_error", buildError("athena_tool_unknown_error", "unknown", false, "Athena could not complete this tool call.", correlationId));
}
