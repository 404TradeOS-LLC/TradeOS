import type { AthenaErrorCategory, AthenaToolError } from "../athena-kernel/types";

// A7 memory error taxonomy, mirroring athena-action-engine/errors.ts's
// AthenaActionDispatchError posture: every thrown error carries a
// caller-safe `publicError` (the only thing that can ever reach a caller)
// plus an internal-only `reasonCode` for audit/telemetry. No raw exception
// message, stack trace, or storage-internal detail is ever assigned to
// `publicError.safeSummary`.
export type AthenaMemoryReasonCode =
  | "invalid_input"
  | "authorization_denied"
  | "not_found"
  | "storage_unavailable"
  | "conflict";

export class AthenaMemoryError extends Error {
  constructor(
    public readonly reasonCode: AthenaMemoryReasonCode,
    public readonly publicError: AthenaToolError
  ) {
    super(publicError.safeSummary);
  }
}

function buildError(code: string, category: AthenaErrorCategory, retryable: boolean, safeSummary: string, correlationId: string): AthenaToolError {
  return { code, category, retryable, safeSummary, correlationId };
}

export function athenaMemoryInvalidInputError(correlationId: string, safeSummary = "Athena could not validate this memory request."): AthenaMemoryError {
  return new AthenaMemoryError("invalid_input", buildError("athena_memory_invalid_input", "validation", false, safeSummary, correlationId));
}

// Used for both "this memory does not exist" and "this memory belongs to a
// different org/actor" - the same registry-enumeration-style defense in
// depth athena-tool-registry/errors.ts and athena-action-engine/errors.ts
// already apply to not-found-vs-denied. A caller who cannot see which case
// occurred learns nothing about another tenant's/user's memory from the
// error shape alone.
export function athenaMemoryAuthorizationDeniedError(correlationId: string): AthenaMemoryError {
  return new AthenaMemoryError("authorization_denied", buildError("athena_memory_access_denied", "authorization", false, "Athena can't access that memory.", correlationId));
}

export function athenaMemoryNotFoundError(correlationId: string): AthenaMemoryError {
  return new AthenaMemoryError("not_found", buildError("athena_memory_access_denied", "authorization", false, "Athena can't access that memory.", correlationId));
}

export function athenaMemoryStorageUnavailableError(correlationId: string): AthenaMemoryError {
  return new AthenaMemoryError("storage_unavailable", buildError("athena_memory_storage_unavailable", "service", true, "Athena could not save or load memory right now.", correlationId));
}
