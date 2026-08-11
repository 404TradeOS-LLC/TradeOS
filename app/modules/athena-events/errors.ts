import type { AthenaErrorCategory, AthenaToolError } from "../athena-kernel/types";

// A8 event error taxonomy, mirroring athena-memory/errors.ts's
// AthenaMemoryError posture exactly: every thrown error carries a
// caller-safe `publicError` (the only thing that can ever reach a caller)
// plus an internal-only `reasonCode` for audit/telemetry. No raw exception
// message, stack trace, or storage-internal detail is ever assigned to
// `publicError.safeSummary`.
export type AthenaEventReasonCode =
  | "invalid_input"
  | "authorization_denied"
  | "not_found"
  | "storage_unavailable"
  | "conflict"
  | "unregistered_event_type"
  | "secret_shaped_payload";

export class AthenaEventError extends Error {
  constructor(
    public readonly reasonCode: AthenaEventReasonCode,
    public readonly publicError: AthenaToolError
  ) {
    super(publicError.safeSummary);
  }
}

function buildError(code: string, category: AthenaErrorCategory, retryable: boolean, safeSummary: string, correlationId: string): AthenaToolError {
  return { code, category, retryable, safeSummary, correlationId };
}

export function athenaEventInvalidInputError(correlationId: string, safeSummary = "Athena could not validate this event."): AthenaEventError {
  return new AthenaEventError("invalid_input", buildError("athena_event_invalid_input", "validation", false, safeSummary, correlationId));
}

// Closed-registry rejection (A8 roadmap: "publishing an unregistered
// type/version pair fails validation rather than being silently accepted").
// Deliberately its own reasonCode (distinct from generic invalid_input) so
// callers/telemetry can tell "shape was wrong" apart from "shape was fine
// but this type/version isn't a canonical event this org can publish" -
// while still surfacing a "validation" category/generic summary publicly,
// since neither case should leak registry contents to a caller.
export function athenaEventUnregisteredEventTypeError(correlationId: string): AthenaEventError {
  return new AthenaEventError(
    "unregistered_event_type",
    buildError("athena_event_unregistered_type", "validation", false, "Athena does not recognize this event type or version.", correlationId)
  );
}

// Used for both "this event/dead letter does not exist" and "it exists but
// belongs to a different org" - the same registry-enumeration-style defense
// in depth athena-memory/errors.ts and athena-action-engine/errors.ts already
// apply to not-found-vs-denied. A caller who cannot see which case occurred
// learns nothing about another tenant's events from the error shape alone.
export function athenaEventAuthorizationDeniedError(correlationId: string): AthenaEventError {
  return new AthenaEventError("authorization_denied", buildError("athena_event_access_denied", "authorization", false, "Athena can't access that event.", correlationId));
}

export function athenaEventNotFoundError(correlationId: string): AthenaEventError {
  return new AthenaEventError("not_found", buildError("athena_event_access_denied", "authorization", false, "Athena can't access that event.", correlationId));
}

export function athenaEventStorageUnavailableError(correlationId: string): AthenaEventError {
  return new AthenaEventError("storage_unavailable", buildError("athena_event_storage_unavailable", "service", true, "Athena could not save or load this event right now.", correlationId));
}

export function athenaEventConflictError(correlationId: string, safeSummary = "Athena could not complete this event operation."): AthenaEventError {
  return new AthenaEventError("conflict", buildError("athena_event_conflict", "conflict", false, safeSummary, correlationId));
}

// A11 hardening (docs/athena/09-security/README.md "Secrets, PII, And Data
// Minimization"). Mirrors athena-memory/writePolicy.ts's own posture for
// prohibited content exactly: a secret-shaped payload is *rejected*, never
// silently redacted-and-persisted - an event payload is structured business
// data other services deserialize by field name, so silently mutating a
// field's value in place would corrupt correctness in a way a caller could
// not detect, whereas a loud rejection surfaces the bug at the call site
// that produced it.
export function athenaEventSecretShapedPayloadError(correlationId: string): AthenaEventError {
  return new AthenaEventError("secret_shaped_payload", buildError("athena_event_secret_shaped_payload", "validation", false, "Athena rejected this event: its payload appears to carry credential-shaped data.", correlationId));
}
