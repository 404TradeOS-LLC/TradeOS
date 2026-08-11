import { eventRef } from "../modules/athena-tool-sdk/events";
import { followUp } from "../modules/athena-tool-sdk/followUps";
import { failureResult, successResult } from "../modules/athena-tool-sdk/results";
import { warning } from "../modules/athena-tool-sdk/warnings";
import { assertValidAthenaToolResult } from "../modules/athena-tool-registry/resultEnvelope";

const TELEMETRY = { traceId: "trace-1", executionId: "exec-1" };

describe("athena-tool-sdk successResult()", () => {
  it("produces a valid AthenaToolResult envelope", () => {
    const result = successResult({ summary: "ok", data: { a: 1 }, telemetry: TELEMETRY });
    expect(() => assertValidAthenaToolResult(result)).not.toThrow();
    expect(result).toEqual({
      success: true,
      summary: "ok",
      data: { a: 1 },
      events: [],
      warnings: [],
      followUps: [],
      telemetry: TELEMETRY,
    });
  });

  it("defaults events/warnings/followUps to empty arrays when omitted", () => {
    const result = successResult({ summary: "ok", data: null, telemetry: TELEMETRY });
    expect(result.events).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.followUps).toEqual([]);
  });

  it("preserves caller-supplied events/warnings/followUps", () => {
    const result = successResult({
      summary: "ok",
      data: null,
      telemetry: TELEMETRY,
      events: [eventRef("JobScheduled", "evt_1")],
      warnings: [warning({ code: "missing_dimension", message: "Ceiling height is unknown." })],
      followUps: [followUp({ kind: "question", label: "Ask for ceiling height" })],
    });
    expect(result.events).toEqual([{ type: "JobScheduled", id: "evt_1" }]);
    expect(result.warnings).toEqual([{ code: "missing_dimension", message: "Ceiling height is unknown." }]);
    expect(result.followUps).toEqual([{ kind: "question", label: "Ask for ceiling height" }]);
  });

  it("allows data: null on a successful result", () => {
    const result = successResult<{ id: string }>({ summary: "no match", data: null, telemetry: TELEMETRY });
    expect(() => assertValidAthenaToolResult(result)).not.toThrow();
    expect(result.data).toBeNull();
  });

  it("passes telemetry through unchanged, never fabricating a new trace/execution id", () => {
    const result = successResult({ summary: "ok", data: null, telemetry: { traceId: "custom-trace", executionId: "custom-exec" } });
    expect(result.telemetry).toEqual({ traceId: "custom-trace", executionId: "custom-exec" });
  });

  it("never carries an undocumented top-level field, and the runtime boundary still rejects one if added", () => {
    const result = successResult({ summary: "ok", data: null, telemetry: TELEMETRY });
    expect(Object.keys(result).sort()).toEqual(["data", "events", "followUps", "summary", "telemetry", "warnings", "success"].sort());
    const withExtra = { ...result, extra: "not allowed" };
    expect(() => assertValidAthenaToolResult(withExtra)).toThrow(/undocumented/);
  });
});

describe("athena-tool-sdk failureResult()", () => {
  const error = { code: "athena_tool_invalid_input", category: "validation" as const, retryable: false, safeSummary: "Bad input.", correlationId: "trace-1" };

  it("produces a valid AthenaToolResult failure envelope", () => {
    const result = failureResult({ summary: "Bad input.", telemetry: TELEMETRY, error });
    expect(() => assertValidAthenaToolResult(result)).not.toThrow();
    expect(result).toEqual({
      success: false,
      summary: "Bad input.",
      data: null,
      events: [],
      warnings: [],
      followUps: [],
      telemetry: TELEMETRY,
      error,
    });
  });

  it("always sets data: null, never events, on a failure", () => {
    const result = failureResult({ summary: "Bad input.", telemetry: TELEMETRY, error });
    expect(result.data).toBeNull();
    expect(result.events).toEqual([]);
  });

  it("preserves the exact error object passed in - the existing AthenaToolError shape, not a translated one", () => {
    const result = failureResult({ summary: "Bad input.", telemetry: TELEMETRY, error });
    expect(result.error).toBe(error);
  });

  it("still preserves caller-supplied warnings/followUps on a failure", () => {
    const result = failureResult({
      summary: "Bad input.",
      telemetry: TELEMETRY,
      error,
      warnings: [warning({ code: "partial_data", message: "Only some fields were validated." })],
      followUps: [followUp({ kind: "action", label: "Try again with a complete payload." })],
    });
    expect(result.warnings).toEqual([{ code: "partial_data", message: "Only some fields were validated." }]);
    expect(result.followUps).toEqual([{ kind: "action", label: "Try again with a complete payload." }]);
  });
});

describe("athena-tool-sdk warning()", () => {
  it("produces the exact existing AthenaWarning shape", () => {
    expect(warning({ code: "missing_dimension", message: "Ceiling height is unknown." })).toEqual({
      code: "missing_dimension",
      message: "Ceiling height is unknown.",
    });
  });
});

describe("athena-tool-sdk followUp()", () => {
  it("produces the exact existing AthenaFollowUp shape for a question", () => {
    expect(followUp({ kind: "question", label: "Ask for ceiling height" })).toEqual({ kind: "question", label: "Ask for ceiling height" });
  });

  it("produces the exact existing AthenaFollowUp shape for an action", () => {
    expect(followUp({ kind: "action", label: "Send the proposal" })).toEqual({ kind: "action", label: "Send the proposal" });
  });
});

describe("athena-tool-sdk eventRef()", () => {
  it("produces the exact existing AthenaEventReference shape and nothing else", () => {
    const ref = eventRef("JobScheduled", "evt_123");
    expect(ref).toEqual({ type: "JobScheduled", id: "evt_123" });
    expect(Object.keys(ref).sort()).toEqual(["id", "type"]);
  });

  it("has no publish side effect - it is a pure constructor", () => {
    // There is no event bus/module state anywhere in athena-tool-sdk for
    // this call to reach; calling it twice with the same arguments produces
    // two structurally-identical, independent objects.
    const a = eventRef("JobScheduled", "evt_123");
    const b = eventRef("JobScheduled", "evt_123");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
