import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonResponse } from "./json-response.ts";

const fallbackError = "Customer portal request failed";

test("preserves structured customer portal errors", async () => {
  const response = new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(parseJsonResponse(response, fallbackError), /Forbidden/);
});

test("normalizes non-json customer portal failures instead of leaking SyntaxError", async () => {
  const response = new Response("<html>Bad gateway</html>", {
    status: 502,
    headers: { "Content-Type": "text/html" },
  });

  await assert.rejects(parseJsonResponse(response, fallbackError), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "Error");
    assert.equal(error.message, fallbackError);
    assert.ok(!(error instanceof SyntaxError));
    return true;
  });
});

test("rejects malformed successful customer portal responses", async () => {
  const response = new Response("not-json", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });

  await assert.rejects(parseJsonResponse(response, fallbackError), /Invalid JSON response/);
});
