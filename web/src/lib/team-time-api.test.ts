import test from "node:test";
import assert from "node:assert/strict";
import { teamTimeRequest } from "./team-time-api.ts";

test("Team & Time uses the same-origin session route and preserves the action payload", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const result = await teamTimeRequest<{ orgId: string }>("bootstrap", { orgId: "org-1" }, async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return Response.json({ orgId: "org-1" });
  });

  assert.equal(capturedUrl, "/api/team-time");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.credentials, "same-origin");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), { action: "bootstrap", orgId: "org-1" });
  assert.equal(new Headers(capturedInit?.headers).has("authorization"), false);
  assert.deepEqual(result, { orgId: "org-1" });
});

test("Team & Time returns the server's safe action error", async () => {
  await assert.rejects(
    teamTimeRequest("clock_in", {}, async () => Response.json({ error: "This job is not assigned to your account." }, { status: 403 })),
    /This job is not assigned to your account\./
  );
});
