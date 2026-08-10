import type { AthenaWarning } from "../athena-kernel/types";

// Structured provider-failure taxonomy. Reuses AthenaWarning's shape (a
// type-only import from athena-kernel/types.ts) for the public-facing side
// of a provider failure, since the context engine's output is a per-section
// status/warning on the assembled context - not a success/error envelope
// like a tool result - so there is no AthenaToolError-shaped object
// returned to a caller here. The internal control-flow error below exists
// only to unify timeout/cancellation/thrown-error handling inside the
// assembler, mirroring athena-tool-registry/dispatcher.ts's
// AthenaToolAbortedError pattern.
export type AthenaContextProviderFailureReason = "timeout" | "cancelled" | "denied" | "unexpected_error" | "invalid_result";

export class AthenaContextProviderFetchError extends Error {
  constructor(
    public readonly reason: AthenaContextProviderFailureReason,
    message: string
  ) {
    super(message);
  }
}

function warning(code: string, message: string): AthenaWarning {
  return { code, message };
}

export function athenaContextProviderTimeoutWarning(providerId: string): AthenaWarning {
  return warning("athena_context_provider_timeout", `Athena context provider "${providerId}" did not respond in time.`);
}

export function athenaContextProviderCancelledWarning(providerId: string): AthenaWarning {
  return warning("athena_context_provider_cancelled", `Athena context provider "${providerId}" was cancelled.`);
}

export function athenaContextProviderDeniedWarning(section: string): AthenaWarning {
  return warning("athena_context_provider_denied", `Athena does not have permission to load "${section}" context.`);
}

export function athenaContextProviderUnexpectedErrorWarning(providerId: string): AthenaWarning {
  return warning("athena_context_provider_unexpected_error", `Athena context provider "${providerId}" failed unexpectedly.`);
}

export function athenaContextProviderInvalidResultWarning(providerId: string): AthenaWarning {
  return warning("athena_context_provider_invalid_result", `Athena context provider "${providerId}" returned an invalid result and was omitted.`);
}

export function athenaContextCriticalProviderFailureWarning(providerId: string): AthenaWarning {
  return warning("athena_context_critical_provider_failed", `A critical Athena context provider "${providerId}" failed; dependent planning was stopped.`);
}
