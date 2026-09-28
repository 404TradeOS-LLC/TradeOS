import assert from "node:assert/strict";
import test from "node:test";
import { ClientApiError } from "./clientApi";
import { sendAthenaMessage, type AthenaKernelResult } from "./athena-client";

const deniedResult: AthenaKernelResult = {
  success: false,
  executionId: "exec-123",
  traceId: "trace-123",
  state: "denied",
  summary: "This action is not permitted for your current access.",
  message: "Athena did not apply the requested change.",
  warnings: [{ code: "permission_denied", message: "Your role does not allow this action." }],
  followUps: [{ kind: "question", label: "Show me what I can do instead" }],
  telemetry: {
    traceId: "trace-123",
    executionId: "exec-123",
  },
  error: {
    code: "permission_denied",
    category: "authorization",
    retryable: false,
    safeSummary: "This action is not permitted for your current access.",
    correlationId: "corr-123",
  },
};

test("sendAthenaMessage preserves a typed non-2xx kernel result", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedBody = "";

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = typeof init?.body === "string" ? init.body : "";
    return new Response(JSON.stringify(deniedResult), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await sendAthenaMessage({
      message: "Schedule the job tomorrow",
      selectedScope: { jobId: "550e8400-e29b-41d4-a716-446655440000" },
      idempotencyKey: "request-key-123",
    });

    assert.equal(requestedUrl, "/api/proxy/athena/chat");
    assert.equal(result.state, "denied");
    assert.equal(result.summary, deniedResult.summary);
    assert.equal(result.traceId, "trace-123");
    assert.equal(result.warnings[0]?.code, "permission_denied");
    assert.match(requestedBody, /"idempotencyKey":"request-key-123"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendAthenaMessage still throws for a non-kernel proxy error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      () => sendAthenaMessage({ message: "What needs attention?" }),
      (error: unknown) =>
        error instanceof ClientApiError &&
        error.status === 401 &&
        error.message === "Not authenticated"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
