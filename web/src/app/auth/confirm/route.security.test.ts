import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyRecoveryIdentity } from "./recovery-core.ts";

const routeUrl = new URL("./route.ts", import.meta.url);

async function readRecoveryRouteSource(): Promise<string> {
  return readFile(routeUrl, "utf8");
}

function createRecoveryClient(options: { userId?: string; calls: string[] }) {
  return {
    auth: {
      async exchangeCodeForSession(code: string) {
        options.calls.push(`exchange:${code}`);
        return { error: null };
      },
      async verifyOtp(input: { token_hash: string; type: "recovery" }) {
        options.calls.push(`verify:${input.token_hash}:${input.type}`);
        return { error: null };
      },
      async getUser() {
        options.calls.push("getUser");
        return {
          data: { user: options.userId ? { id: options.userId } : null },
          error: null,
        };
      },
    },
  };
}

test("PKCE recovery verifies the session before returning the recovered user id", async () => {
  const calls: string[] = [];
  const result = await verifyRecoveryIdentity(
    createRecoveryClient({ userId: "11111111-1111-4111-8111-111111111111", calls }),
    { code: "pkce-code", tokenHash: null, type: null },
  );

  assert.deepEqual(calls, ["exchange:pkce-code", "getUser"]);
  assert.deepEqual(result, { ok: true, userId: "11111111-1111-4111-8111-111111111111" });
});

test("token-hash recovery verifies the OTP before returning the recovered user id", async () => {
  const calls: string[] = [];
  const result = await verifyRecoveryIdentity(
    createRecoveryClient({ userId: "22222222-2222-4222-8222-222222222222", calls }),
    { code: null, tokenHash: "recovery-hash", type: "recovery" },
  );

  assert.deepEqual(calls, ["verify:recovery-hash:recovery", "getUser"]);
  assert.deepEqual(result, { ok: true, userId: "22222222-2222-4222-8222-222222222222" });
});

test("recovery verification fails closed when the exchanged session has no verified user", async () => {
  const calls: string[] = [];
  const result = await verifyRecoveryIdentity(createRecoveryClient({ calls }), {
    code: "pkce-code",
    tokenHash: null,
    type: null,
  });

  assert.deepEqual(calls, ["exchange:pkce-code", "getUser"]);
  assert.deepEqual(result, { ok: false, stage: "identity", message: undefined });
});

test("recovery route writes only the verified identity into the HttpOnly marker", async () => {
  const source = await readRecoveryRouteSource();

  assert.match(source, /verifyRecoveryIdentity\(supabase, \{ code, tokenHash, type \}\)/);
  assert.match(source, /response\.cookies\.set\("tradeos-recovery", verification\.userId,/);
  assert.match(source, /httpOnly:\s*true/);
  assert.doesNotMatch(source, /cookies\.set\(\s*["']tradeos-recovery["']\s*,\s*["']1["']/);
  assert.match(source, /request\.cookies\.set\(name, value\)/);
  assert.match(source, /response\.cookies\.set\(name, value, options\)/);
});
