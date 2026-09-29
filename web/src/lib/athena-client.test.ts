import assert from "node:assert/strict";
import test from "node:test";
import { ClientApiError } from "./clientApi";
import {
  isAthenaRetryableClientError,
  sendAthenaMessage,
  type AthenaKernelResult,
} from "./athena-client";

const originalFetch = globalThis.fetch;

function kernelResult(overrides: Partial<AthenaKernelResult> = {}): AthenaKernelResult {
  return {
    success: true,
    executionId: "execution-1",
    traceId: "trace-1",
    state: "succeeded",
    summary: "Done",
    message: null,
    warnings: [],
    followUps: [],
    telemetry: { traceId: "trace-1", executionId: "execution-1" },
    ...overrides,
  };
}

function stubFetch(response: Response, inspect?: (input: RequestInfo | URL, init?: RequestInit) => void) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    inspect?.(input, init);
    return response;
  }) as typeof fetch;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("sendAthenaMessage returns a valid 200 kernel envelope and sends the public request contract", async () => {
  const result = kernelResult();
  let postedBody: Record<string, unknown> | null = null;

  stubFetch(
    new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    (input, init) => {
      assert.equal(String(input), "/api/proxy/athena/chat");
      assert.equal(init?.method, "POST");
      postedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    }
  );

  const returned = await sendAthenaMessage({
    message: "price this deck",
    selectedScope: { projectId: "11111111-1111-4111-8111-111111111111" },
    idempotencyKey: "request-key",
  });

  assert.deepEqual(returned, result);
  assert.equal(postedBody?.message, "price this deck");
  assert.equal(postedBody?.idempotencyKey, "request-key");
  assert.deepEqual(postedBody?.selectedScope, { projectId: "11111111-1111-4111-8111-111111111111" });
});

test("sendAthenaMessage preserves a valid retryable 5xx kernel envelope", async () => {
  const result = kernelResult({
    success: false,
    state: "failed",
    summary: "Provider temporarily unavailable",
    error: {
      code: "provider_unavailable",
      category: "provider",
      retryable: true,
      safeSummary: "Try again safely.",
      correlationId: "corr-1",
    },
  });

  stubFetch(
    new Response(JSON.stringify(result), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    })
  );

  assert.deepEqual(await sendAthenaMessage({ message: "try this" }), result);
});

test("sendAthenaMessage throws the proxy error for a 401 error payload", async () => {
  stubFetch(
    new Response(JSON.stringify({ error: "Session expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  );

  await assert.rejects(
    () => sendAthenaMessage({ message: "hello" }),
    (error: unknown) =>
      error instanceof ClientApiError &&
      error.status === 401 &&
      error.message === "Session expired"
  );
});

test("sendAthenaMessage rejects malformed non-JSON bodies without leaking parser errors", async () => {
  stubFetch(new Response("<html>bad gateway</html>", { status: 502 }));

  await assert.rejects(
    () => sendAthenaMessage({ message: "hello" }),
    (error: unknown) =>
      error instanceof ClientApiError &&
      error.status === 502 &&
      error.message === "Request failed"
  );
});

test("retry classification only retries ambiguous transport and retryable HTTP outcomes", () => {
  assert.equal(isAthenaRetryableClientError(new Error("network disconnected")), true);
  assert.equal(isAthenaRetryableClientError(new ClientApiError("timeout", 408)), true);
  assert.equal(isAthenaRetryableClientError(new ClientApiError("rate limited", 429)), true);
  assert.equal(isAthenaRetryableClientError(new ClientApiError("server error", 500)), true);
  assert.equal(isAthenaRetryableClientError(new ClientApiError("validation", 400)), false);
  assert.equal(isAthenaRetryableClientError(new ClientApiError("disabled", 404)), false);
});
