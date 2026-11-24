import test from "node:test";
import assert from "node:assert/strict";
import { ClientApiError } from "./clientApi.ts";
import {
  sendInviteRoles,
  submitSendInvite,
  validateSendInviteInput,
  type SendInviteInput,
} from "./send-invite.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

const validInput: SendInviteInput = {
  email: "Tech@Example.com",
  role: "technician",
};

const inviteResponse = {
  inviteId: "inv-1",
  email: "tech@example.com",
  role: "technician",
  expiresAt: "2026-11-30T22:30:00.000Z",
};

function mockFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return calls;
}

test("validation rejects a malformed email without calling the API", () => {
  const calls = mockFetch(201, inviteResponse);
  assert.throws(
    () => validateSendInviteInput({ ...validInput, email: "not-an-email" }),
    /valid work email/
  );
  assert.equal(calls.length, 0);
});

test("validation rejects an unknown role without calling the API", () => {
  const calls = mockFetch(201, inviteResponse);
  assert.throws(
    () => validateSendInviteInput({ ...validInput, role: "owner" as SendInviteInput["role"] }),
    /technician or dispatcher/
  );
  assert.equal(calls.length, 0);
});

test("validation normalizes the email", () => {
  const payload = validateSendInviteInput({ ...validInput, email: "  TECH@Example.com " });
  assert.equal(payload.email, "tech@example.com");
  assert.equal(payload.role, "technician");
});

test("only technician and dispatcher are offered", () => {
  assert.deepEqual([...sendInviteRoles], ["technician", "dispatcher"]);
});

test("submit posts the invite payload through the authenticated proxy", async () => {
  const calls = mockFetch(201, inviteResponse);
  const invite = await submitSendInvite(validInput);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/proxy/account/invites");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    email: "tech@example.com",
    role: "technician",
  });
  assert.deepEqual(invite, {
    inviteId: "inv-1",
    email: "tech@example.com",
    role: "technician",
    expiresAt: "2026-11-30T22:30:00.000Z",
  });
});

test("submit returns only the invite id, email, role, and expiry — never server extras", async () => {
  mockFetch(201, {
    ...inviteResponse,
    inviteToken: "raw-token-that-must-never-reach-the-ui",
    someFutureField: "ignored",
  });
  const invite = await submitSendInvite(validInput);
  assert.deepEqual(Object.keys(invite).sort(), ["email", "expiresAt", "inviteId", "role"]);
  assert.equal("inviteToken" in invite, false);
});

test("submit surfaces the server 403 message instead of swallowing it", async () => {
  mockFetch(403, { error: "You do not have permission to perform this action" });
  await assert.rejects(submitSendInvite(validInput), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 403);
    assert.equal(error.message, "You do not have permission to perform this action");
    return true;
  });
});

test("submit surfaces the server 400 validation message", async () => {
  mockFetch(400, { error: "Invites are limited to Dispatcher and Technician roles in this sprint" });
  await assert.rejects(submitSendInvite(validInput), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 400);
    assert.equal(error.message, "Invites are limited to Dispatcher and Technician roles in this sprint");
    return true;
  });
});

test("submit surfaces the server 401 message", async () => {
  mockFetch(401, { error: "Not authenticated" });
  await assert.rejects(submitSendInvite(validInput), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 401);
    assert.equal(error.message, "Not authenticated");
    return true;
  });
});
