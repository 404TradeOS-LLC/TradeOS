import { AthenaErrorCategory, AthenaToolError } from "./types";

// Normalizes every failure path (validation, authz/policy denial, timeout,
// cancellation, provider, service, unknown) into the safe user-facing
// AthenaToolError envelope from docs/athena/contracts/README.md. Callers
// must never forward raw error messages/stacks - only AthenaKernelError's
// own safeSummary, or a generic fallback, reaches the caller.
export class AthenaKernelError extends Error {
  public readonly code: string;
  public readonly category: AthenaErrorCategory;
  public readonly retryable: boolean;
  public readonly safeSummary: string;

  constructor(input: { code: string; category: AthenaErrorCategory; retryable: boolean; safeSummary: string; message?: string }) {
    super(input.message ?? input.safeSummary);
    this.code = input.code;
    this.category = input.category;
    this.retryable = input.retryable;
    this.safeSummary = input.safeSummary;
  }
}

export function athenaValidationError(safeSummary: string, code = "athena_validation_failed"): AthenaKernelError {
  return new AthenaKernelError({ code, category: "validation", retryable: false, safeSummary });
}

export function athenaAuthorizationError(safeSummary: string, code = "athena_capability_not_available"): AthenaKernelError {
  return new AthenaKernelError({ code, category: "authorization", retryable: false, safeSummary });
}

export function athenaTimeoutError(safeSummary: string, code = "athena_deadline_exceeded"): AthenaKernelError {
  return new AthenaKernelError({ code, category: "timeout", retryable: true, safeSummary });
}

export function athenaCancellationError(safeSummary: string, code = "athena_cancelled"): AthenaKernelError {
  return new AthenaKernelError({ code, category: "timeout", retryable: false, safeSummary });
}

export function athenaProviderError(safeSummary: string, code = "athena_provider_unavailable"): AthenaKernelError {
  return new AthenaKernelError({ code, category: "provider", retryable: true, safeSummary });
}

export function athenaServiceError(safeSummary: string, code = "athena_service_error"): AthenaKernelError {
  return new AthenaKernelError({ code, category: "service", retryable: false, safeSummary });
}

const GENERIC_SAFE_SUMMARY = "Athena could not complete this request.";

// Every kernel/telemetry span and the outer controller route errors through
// here before they can reach an HTTP response or a persisted execution
// record - it is the one place raw error messages/stacks are dropped.
export function normalizeAthenaError(error: unknown, correlationId: string): AthenaToolError {
  if (error instanceof AthenaKernelError) {
    return {
      code: error.code,
      category: error.category,
      retryable: error.retryable,
      safeSummary: error.safeSummary,
      correlationId,
    };
  }

  return {
    code: "athena_unknown_error",
    category: "unknown",
    retryable: false,
    safeSummary: GENERIC_SAFE_SUMMARY,
    correlationId,
  };
}
