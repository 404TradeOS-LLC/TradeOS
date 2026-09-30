import test from "node:test";
import assert from "node:assert/strict";
import { ClientApiError, clientFetch } from "./clientApi.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("normalizes canonical API paths before calling the browser proxy", async () => {
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await clientFetch("/api/v1/jobs/dispatch-summary");
  assert.equal(requestedUrl, "/api/proxy/jobs/dispatch-summary");
});

test("preserves structured proxy errors", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(clientFetch("/api/v1/projects"), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 403);
    assert.equal(error.message, "Forbidden");
    return true;
  });
});

test("normalizes non-json proxy failures instead of leaking SyntaxError", async () => {
  globalThis.fetch = async () =>
    new Response("<html>Bad gateway</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });

  await assert.rejects(clientFetch("/api/v1/projects"), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 502);
    assert.equal(error.message, "Request failed");
    return true;
  });
});

test("classifies malformed successful responses as API contract failures", async () => {
  globalThis.fetch = async () =>
    new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });

  await assert.rejects(clientFetch("/api/v1/projects"), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 200);
    assert.equal(error.message, "Invalid JSON response");
    return true;
  });
});
