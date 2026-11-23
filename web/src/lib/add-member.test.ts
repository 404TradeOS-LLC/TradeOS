import test from "node:test";
import assert from "node:assert/strict";
import { ClientApiError } from "./clientApi.ts";
import {
  addMemberRoleOptions,
  isAuthSubject,
  submitAddMember,
  validateAddMemberInput,
  type AddMemberInput,
} from "./add-member.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

const validInput: AddMemberInput = {
  email: "Tech@Example.com",
  fullName: "Staging Technician",
  authSubject: "6daf2a3b-d4be-4479-8540-dd64356dbdb5",
  role: "technician",
};

const memberResponse = {
  membershipId: "mem-1",
  userId: "user-1",
  authSubject: "6daf2a3b-d4be-4479-8540-dd64356dbdb5",
  email: "tech@example.com",
  fullName: "Staging Technician",
  role: "technician",
  status: "active",
  createdAt: "2026-11-23T12:00:00.000Z",
  updatedAt: "2026-11-23T12:00:00.000Z",
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
  const calls = mockFetch(201, memberResponse);
  assert.throws(
    () => validateAddMemberInput({ ...validInput, email: "not-an-email" }),
    /valid work email/
  );
  assert.equal(calls.length, 0);
});

test("validation rejects a non-UUID auth subject without calling the API", () => {
  const calls = mockFetch(201, memberResponse);
  assert.throws(
    () => validateAddMemberInput({ ...validInput, authSubject: "not-a-uuid" }),
    /TradeOS sign-in ID/
  );
  assert.equal(calls.length, 0);
});

test("validation accepts a local-auth subject (local:<uuid>)", () => {
  const payload = validateAddMemberInput({
    ...validInput,
    authSubject: "local:6daf2a3b-d4be-4479-8540-dd64356dbdb5",
  });
  assert.equal(payload.authSubject, "local:6daf2a3b-d4be-4479-8540-dd64356dbdb5");
});

test("isAuthSubject accepts Supabase and local subjects and rejects anything else", () => {
  assert.equal(isAuthSubject("6daf2a3b-d4be-4479-8540-dd64356dbdb5"), true);
  assert.equal(isAuthSubject("local:6daf2a3b-d4be-4479-8540-dd64356dbdb5"), true);
  assert.equal(isAuthSubject("not-a-uuid"), false);
  assert.equal(isAuthSubject("local:not-a-uuid"), false);
  assert.equal(isAuthSubject(""), false);
});

test("validation rejects an unknown role without calling the API", () => {
  const calls = mockFetch(201, memberResponse);
  assert.throws(
    () => validateAddMemberInput({ ...validInput, role: "superuser" as AddMemberInput["role"] }),
    /Choose a role/
  );
  assert.equal(calls.length, 0);
});

test("validation normalizes the email and drops a blank full name", () => {
  const payload = validateAddMemberInput({ ...validInput, email: "  TECH@Example.com ", fullName: "   " });
  assert.equal(payload.email, "tech@example.com");
  assert.equal(payload.fullName, undefined);
  assert.equal(payload.authSubject, "6daf2a3b-d4be-4479-8540-dd64356dbdb5");
  assert.equal(payload.role, "technician");
});

test("owners may grant every role; non-owners are never offered owner", () => {
  assert.deepEqual(addMemberRoleOptions("owner"), ["owner", "admin", "dispatcher", "technician"]);
  assert.deepEqual(addMemberRoleOptions("admin"), ["admin", "dispatcher", "technician"]);
  assert.deepEqual(addMemberRoleOptions("technician"), ["admin", "dispatcher", "technician"]);
});

test("submit posts the upsert payload through the authenticated proxy and maps the member", async () => {
  const calls = mockFetch(201, memberResponse);
  const member = await submitAddMember("d86d0874-6ba3-4b06-94b6-bd0ae99fe532", validInput);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/proxy/admin/organizations/d86d0874-6ba3-4b06-94b6-bd0ae99fe532/members");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    email: "tech@example.com",
    fullName: "Staging Technician",
    authSubject: "6daf2a3b-d4be-4479-8540-dd64356dbdb5",
    role: "technician",
  });
  assert.deepEqual(member, {
    membershipId: "mem-1",
    userId: "user-1",
    fullName: "Staging Technician",
    email: "tech@example.com",
    role: "technician",
    status: "active",
    createdAt: "2026-11-23T12:00:00.000Z",
    updatedAt: "2026-11-23T12:00:00.000Z",
  });
});

test("submit surfaces the server 403 message instead of swallowing it", async () => {
  mockFetch(403, { error: "Active organization administrator membership required" });
  await assert.rejects(submitAddMember("org-1", validInput), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 403);
    assert.equal(error.message, "Active organization administrator membership required");
    return true;
  });
});

test("submit surfaces the server 400 validation message", async () => {
  mockFetch(400, { error: "Expected a valid email address" });
  await assert.rejects(submitAddMember("org-1", validInput), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 400);
    assert.equal(error.message, "Expected a valid email address");
    return true;
  });
});

test("submit surfaces the server 401 message", async () => {
  mockFetch(401, { error: "Not authenticated" });
  await assert.rejects(submitAddMember("org-1", validInput), (error: unknown) => {
    assert.ok(error instanceof ClientApiError);
    assert.equal(error.status, 401);
    assert.equal(error.message, "Not authenticated");
    return true;
  });
});
