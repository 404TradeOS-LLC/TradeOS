import { AthenaContextProviderFetchResult } from "./types";

// Runtime validator for AthenaContextProviderFetchResult - the actual
// untrusted boundary in this module (a provider's fetch() implementation is
// arbitrary code, unlike the assembler-constructed AthenaProviderSection
// wrapper around it, which TypeScript already keeps honest at compile
// time). Mirrors athena-tool-registry/resultEnvelope.ts's
// assertValidAthenaToolResult posture, applied to C010's fetch-result shape
// instead of C003 (docs/athena/roadmap/A3-context-engine-implementation-plan.md
// "Test Requirements": "C001 provider-section shape validation and C010
// provider-definition shape validation").
export function assertValidContextProviderFetchResult(value: unknown): asserts value is AthenaContextProviderFetchResult<unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaContextProviderFetchResult must be an object");
  }
  const candidate = value as Record<string, unknown>;

  if (!("data" in candidate)) {
    throw new Error("AthenaContextProviderFetchResult is missing required key: data");
  }
  if (typeof candidate.itemCount !== "number" || candidate.itemCount < 0 || !Number.isFinite(candidate.itemCount)) {
    throw new Error("AthenaContextProviderFetchResult.itemCount must be a non-negative number");
  }
  if (!Array.isArray(candidate.omittedFields) || candidate.omittedFields.some((field) => typeof field !== "string")) {
    throw new Error("AthenaContextProviderFetchResult.omittedFields must be an array of strings");
  }
  if (candidate.sourceVersion !== undefined && typeof candidate.sourceVersion !== "string") {
    throw new Error("AthenaContextProviderFetchResult.sourceVersion must be a string when present");
  }
  if (candidate.sourceHash !== undefined && typeof candidate.sourceHash !== "string") {
    throw new Error("AthenaContextProviderFetchResult.sourceHash must be a string when present");
  }
}
