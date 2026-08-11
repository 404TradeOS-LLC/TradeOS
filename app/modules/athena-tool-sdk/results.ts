import { redactSecrets } from "../athena-security/secretProtection";
import type { AthenaEventReference, AthenaFollowUp, AthenaTelemetryReference, AthenaToolError, AthenaToolResult, AthenaWarning } from "./types";

// Success/failure result builders (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md "Public API surface"). Both produce the
// exact existing AthenaToolResult<TData> (C003, docs/athena/contracts/
// README.md) - the same shape app/modules/athena-tool-registry/
// resultEnvelope.ts's assertValidAthenaToolResult already validates at the
// real dispatch boundary, and the same shape these helpers are proven
// against in app/tests/athena-tool-sdk.results.test.ts. Neither helper
// invents a field, and neither can produce an undocumented top-level key -
// there is nowhere in either object literal below to add one without
// editing this file.
//
// `telemetry` is a required input on both, not synthesized here. A tool's
// own telemetry.traceId/executionId is never trusted for request
// correlation anyway - app/modules/athena-tool-registry/dispatcher.ts and
// app/modules/athena-action-engine/engine.ts both unconditionally overwrite
// it with the active dispatch context before a caller ever sees the result -
// so a helper-fabricated value would be silently discarded, and generating
// one here would misleadingly suggest it matters. Callers pass
// `execution.traceId`/`execution.executionId` straight from their own
// AthenaToolExecutionContext.

export interface AthenaSuccessResultInput<TData> {
  summary: string;
  // TData | null, not TData: a successful result legitimately has nothing to
  // return (e.g. "no matching record" is not itself a failure) - matching
  // AthenaToolResult<TData>.data's own `TData | null` shape exactly rather
  // than forcing every such tool to fabricate a placeholder value or cast.
  data: TData | null;
  telemetry: AthenaTelemetryReference;
  events?: AthenaEventReference[];
  warnings?: AthenaWarning[];
  followUps?: AthenaFollowUp[];
}

export function successResult<TData = unknown>(input: AthenaSuccessResultInput<TData>): AthenaToolResult<TData> {
  return {
    success: true,
    summary: input.summary,
    // A11 hardening (docs/athena/09-security/README.md "Secrets, PII, And
    // Data Minimization"): a tool's returned `data` reaches telemetry,
    // memory-extraction candidates, and the LLM's own next-turn context, so
    // it is redacted through the same centralized detector every other
    // persistence surface uses (athena-security/secretProtection.ts) before
    // ever leaving this constructor - unlike A8 events (publisher.ts),
    // where a secret-shaped *business* payload is rejected outright, `data`
    // here is a tool author's own free-form return value, not a
    // schema-typed business record other services deserialize by field
    // name, so redact-in-place (keep the result, replace only the
    // offending value) is the safer default than failing the whole tool
    // call.
    data: redactSecrets(input.data).data,
    events: input.events ?? [],
    warnings: input.warnings ?? [],
    followUps: input.followUps ?? [],
    telemetry: input.telemetry,
  };
}

export interface AthenaFailureResultInput {
  summary: string;
  telemetry: AthenaTelemetryReference;
  // The existing AthenaToolError shape (C003) verbatim - not a flattened set
  // of fields reassembled into a second error type. This also makes an
  // already-thrown service error directly reusable without translation: any
  // module in this codebase that follows the `catch (error) { if (error
  // instanceof SomeDomainError) ... }` posture (athena-memory/errors.ts's
  // AthenaMemoryError, athena-tool-registry/errors.ts's
  // AthenaToolDispatchError, athena-action-engine/errors.ts's
  // AthenaActionDispatchError) already exposes a `publicError: AthenaToolError`
  // that can be passed straight through as `error` here - see
  // fixtures/recallPreferenceTool.ts.
  error: AthenaToolError;
  warnings?: AthenaWarning[];
  followUps?: AthenaFollowUp[];
}

// Builds an *expected* tool-result failure only - see this module's and
// defineTool.ts's guidance: an unexpected/programming error must be thrown
// or rethrown by the tool, never funneled through this helper into a
// falsely-successful-looking envelope. A6/A2 remain responsible for
// normalizing an uncaught exception into athena_tool_unexpected_error.
export function failureResult<TData = unknown>(input: AthenaFailureResultInput): AthenaToolResult<TData> {
  return {
    success: false,
    summary: input.summary,
    data: null,
    events: [],
    warnings: input.warnings ?? [],
    followUps: input.followUps ?? [],
    telemetry: input.telemetry,
    error: input.error,
  };
}
