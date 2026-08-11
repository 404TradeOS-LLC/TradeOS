import { successResult } from "../modules/athena-tool-sdk/results";

const TELEMETRY = { traceId: "trace-1", executionId: "exec-1" };

// A11 hardening (docs/athena/09-security/README.md; athena-tool-sdk/results.ts).
describe("athena-tool-sdk successResult() A11 secret redaction", () => {
  it("redacts a secret-shaped field in the returned data, keeping the rest of the result intact", () => {
    const result = successResult({ summary: "ok", data: { customerName: "Acme Roofing", apiKey: "sk_live_abcdefghijklmnop" }, telemetry: TELEMETRY });
    expect(result.data).toEqual({ customerName: "Acme Roofing", apiKey: "[redacted]" });
    expect(result.success).toBe(true);
    expect(result.summary).toBe("ok");
  });

  it("redacts a bare secret-shaped string value", () => {
    const result = successResult<string>({ summary: "ok", data: "Bearer abc123.def456-ghi", telemetry: TELEMETRY });
    expect(result.data).toBe("[redacted]");
  });

  it("leaves ordinary tool result data completely unchanged", () => {
    const data = { jobId: "job-1", status: "scheduled" };
    const result = successResult({ summary: "ok", data, telemetry: TELEMETRY });
    expect(result.data).toEqual(data);
  });

  it("leaves data: null unchanged", () => {
    const result = successResult({ summary: "no match", data: null, telemetry: TELEMETRY });
    expect(result.data).toBeNull();
  });
});
