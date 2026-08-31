import test from "node:test";
import assert from "node:assert/strict";
import { parseCustomerPortalResponse } from "./customer-portal-session.ts";

test("preserves structured customer portal errors", async () => {
  const response = new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(parseCustomerPortalResponse(response), /Forbidden/);
});

test("normalizes non-json customer portal failures instead of leaking SyntaxError", async () => {
  const response = new Response("<html>Bad gateway</html>", {
    status: 502,
    headers: { "Content-Type": "text/html" },
  });

  await assert.rejects(parseCustomerPortalResponse(response), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "Error");
    assert.equal(error.message, "Customer portal request failed");
    assert.ok(!(error instanceof SyntaxError));
    return true;
  });
});

test("rejects malformed successful customer portal responses", async () => {
  const response = new Response("not-json", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });

  await assert.rejects(parseCustomerPortalResponse(response), /Invalid JSON response/);
});
