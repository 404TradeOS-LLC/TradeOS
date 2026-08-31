import test from "node:test";
import assert from "node:assert/strict";
import { ApiClientError, parseStaffApiResponse } from "./staff-api-response.ts";

test("preserves structured staff API errors", async () => {
  const details = { field: "projectId" };
  const response = new Response(JSON.stringify({ error: "Forbidden", details }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(parseStaffApiResponse(response), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.message, "Forbidden");
    assert.equal(error.status, 403);
    assert.deepEqual(error.details, details);
    return true;
  });
});

test("normalizes non-json staff API failures instead of leaking SyntaxError", async () => {
  const response = new Response("<html>Bad gateway</html>", {
    status: 502,
    headers: { "Content-Type": "text/html" },
  });

  await assert.rejects(parseStaffApiResponse(response), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.message, "Request failed");
    assert.equal(error.status, 502);
    assert.ok(!(error instanceof SyntaxError));
    return true;
  });
});

test("rejects malformed successful staff API responses with the API error contract", async () => {
  const response = new Response("not-json", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });

  await assert.rejects(parseStaffApiResponse(response), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.message, "Invalid JSON response");
    assert.equal(error.status, 200);
    return true;
  });
});
