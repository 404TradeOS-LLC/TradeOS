import { AthenaToolResult } from "./types";

const REQUIRED_KEYS = ["success", "summary", "data", "events", "warnings", "followUps", "telemetry"] as const;
const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, "error"]);
const REQUIRED_ERROR_FIELDS = ["code", "category", "retryable", "safeSummary", "correlationId"] as const;

// Runtime validator for the standard AthenaToolResult envelope (C003,
// docs/athena/contracts/README.md), exported for reuse by both the
// dispatcher and athena:contracts so both exercise the same function
// (docs/athena/roadmap/A2-tool-registry-implementation-plan.md "Standard
// Tool Result Envelope Enforcement") - mirrors the posture
// athena-kernel/telemetry.ts already established for C011 with
// assertValidTelemetryRecord.
export function assertValidAthenaToolResult(value: unknown): asserts value is AthenaToolResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaToolResult must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`AthenaToolResult has an undocumented top-level key: ${key}`);
    }
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaToolResult is missing required key: ${key}`);
    }
  }
  if (typeof candidate.success !== "boolean") {
    throw new Error("AthenaToolResult.success must be a boolean");
  }
  if (typeof candidate.summary !== "string" || candidate.summary.length === 0) {
    throw new Error("AthenaToolResult.summary must be a non-empty string");
  }
  if (!Array.isArray(candidate.events)) {
    throw new Error("AthenaToolResult.events must be an array");
  }
  if (!Array.isArray(candidate.warnings)) {
    throw new Error("AthenaToolResult.warnings must be an array");
  }
  if (!Array.isArray(candidate.followUps)) {
    throw new Error("AthenaToolResult.followUps must be an array");
  }
  if (typeof candidate.telemetry !== "object" || candidate.telemetry === null) {
    throw new Error("AthenaToolResult.telemetry must be an object");
  }

  if (candidate.success === false) {
    if (typeof candidate.error !== "object" || candidate.error === null) {
      throw new Error("AthenaToolResult.error is required when success is false");
    }
    const error = candidate.error as Record<string, unknown>;
    for (const field of REQUIRED_ERROR_FIELDS) {
      if (!(field in error)) {
        throw new Error(`AthenaToolResult.error is missing required field: ${field}`);
      }
    }
    if (typeof error.retryable !== "boolean") {
      throw new Error("AthenaToolResult.error.retryable must be a boolean");
    }
    // A2 fixtures never declare a documented safe partial shape (docs/athena/
    // contracts/README.md's "unless the tool's contract explicitly documents
    // a safe partial shape"), so A2 keeps this strict rather than guessing at
    // per-tool exceptions that don't exist yet.
    if (candidate.data !== null) {
      throw new Error("AthenaToolResult.data must be null when success is false (no documented partial shape in A2)");
    }
  } else if (candidate.error !== undefined) {
    throw new Error("AthenaToolResult.error must be absent when success is true");
  }
}
