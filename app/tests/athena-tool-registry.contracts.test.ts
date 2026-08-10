import { assertValidAthenaToolResult } from "../modules/athena-tool-registry/resultEnvelope";
import type { AthenaToolResult } from "../modules/athena-tool-registry/types";

// Backs the `athena:contracts` gate alongside athena-kernel.contracts.test.ts
// (docs/athena/roadmap/A2-tool-registry-implementation-plan.md "CI
// Validation Gates": "one athena:contracts gate covering both the kernel and
// the registry"). Exercises the exact assertValidAthenaToolResult function
// production dispatch uses, not a test-only duplicate.
function validSuccess(): AthenaToolResult {
  return {
    success: true,
    summary: "Echoed the provided message.",
    data: { echoed: "hi" },
    events: [],
    warnings: [],
    followUps: [],
    telemetry: { traceId: "trace-1", executionId: "exec-1" },
  };
}

function validFailure(): AthenaToolResult {
  return {
    success: false,
    summary: "That Athena tool is not available.",
    data: null,
    events: [],
    warnings: [],
    followUps: [],
    telemetry: { traceId: "trace-1", executionId: "exec-1" },
    error: {
      code: "athena_tool_not_found",
      category: "validation",
      retryable: false,
      safeSummary: "That Athena tool is not available.",
      correlationId: "trace-1",
    },
  };
}

describe("athena:contracts - tool result envelope (C003)", () => {
  it("accepts a conforming success envelope", () => {
    expect(() => assertValidAthenaToolResult(validSuccess())).not.toThrow();
  });

  it("accepts a conforming failure envelope", () => {
    expect(() => assertValidAthenaToolResult(validFailure())).not.toThrow();
  });

  it("rejects a result missing a required key", () => {
    const { telemetry: _telemetry, ...rest } = validSuccess();
    expect(() => assertValidAthenaToolResult(rest)).toThrow(/telemetry/);
  });

  it("rejects a result carrying an undocumented top-level key", () => {
    const withExtra = { ...validSuccess(), extra: "not allowed" };
    expect(() => assertValidAthenaToolResult(withExtra)).toThrow(/undocumented/);
  });

  it("rejects a non-boolean success field", () => {
    const invalid = { ...validSuccess(), success: "yes" as unknown as boolean };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/success/);
  });

  it("rejects an empty summary", () => {
    const invalid = { ...validSuccess(), summary: "" };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/summary/);
  });

  it("rejects a failure result missing its error object", () => {
    const { error: _error, ...rest } = validFailure();
    expect(() => assertValidAthenaToolResult(rest)).toThrow(/error/);
  });

  it("rejects a failure result whose error is missing a required field", () => {
    const broken = validFailure();
    delete (broken.error as unknown as Record<string, unknown>).correlationId;
    expect(() => assertValidAthenaToolResult(broken)).toThrow(/correlationId/);
  });

  it("rejects a success result that also carries an error object", () => {
    const invalid = { ...validSuccess(), error: validFailure().error };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/success is true/);
  });

  it("rejects a failure result with non-null data when no partial shape is documented", () => {
    const invalid = { ...validFailure(), data: { partial: true } };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/data must be null/);
  });

  it("rejects an empty telemetry object", () => {
    const invalid = { ...validSuccess(), telemetry: {} };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/telemetry\.traceId/);
  });

  it("rejects telemetry missing executionId", () => {
    const invalid = { ...validSuccess(), telemetry: { traceId: "trace-1" } };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/telemetry\.executionId/);
  });

  it("rejects telemetry with a non-string traceId", () => {
    const invalid = { ...validSuccess(), telemetry: { traceId: 123, executionId: "exec-1" } };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/telemetry\.traceId/);
  });

  it("rejects telemetry with an empty-string executionId", () => {
    const invalid = { ...validSuccess(), telemetry: { traceId: "trace-1", executionId: "" } };
    expect(() => assertValidAthenaToolResult(invalid)).toThrow(/telemetry\.executionId/);
  });
});
