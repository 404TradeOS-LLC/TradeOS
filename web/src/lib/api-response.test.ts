import test from "node:test";
import assert from "node:assert/strict";
import { getApiErrorPayload, readApiResponseBody } from "./api-response.ts";

test("preserves structured API error payloads", async () => {
  const response = new Response(JSON.stringify({ error: "Forbidden", details: { reason: "role" } }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  const parsed = await readApiResponseBody(response);
  assert.equal(parsed.malformed, false);
  assert.deepEqual(getApiErrorPayload(parsed.body), {
    message: "Forbidden",
    details: { reason: "role" },
  });
});

test("marks non-json upstream failures as malformed without leaking SyntaxError", async () => {
  const response = new Response("<html>Bad gateway</html>", {
    status: 502,
    headers: { "Content-Type": "text/html" },
  });

  const parsed = await readApiResponseBody(response);
  assert.equal(parsed.malformed, true);
  assert.equal(parsed.body, undefined);
});

test("marks malformed successful API responses as malformed", async () => {
  const response = new Response("not-json", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });

  const parsed = await readApiResponseBody(response);
  assert.equal(parsed.malformed, true);
  assert.equal(parsed.body, undefined);
});

test("accepts empty successful API responses without inventing a payload", async () => {
  const response = new Response(null, { status: 204 });

  const parsed = await readApiResponseBody(response);
  assert.deepEqual(parsed, { body: undefined, malformed: false });
});
