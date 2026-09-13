import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { handleRecoveryRequest } from "./route.ts";

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

async function executeRecovery(url: string, options: { userId?: string; calls: string[] }) {
  return handleRecoveryRequest(new NextRequest(url), () => createRecoveryClient(options));
}

test("PKCE recovery binds the marker cookie to the verified user after exchange", async () => {
  const calls: string[] = [];
  const response = await executeRecovery("https://app.404tradeos.com/auth/confirm?code=pkce-code", {
    userId: "11111111-1111-4111-8111-111111111111",
    calls,
  });

  assert.deepEqual(calls, ["exchange:pkce-code", "getUser"]);
  assert.equal(response.cookies.get("tradeos-recovery")?.value, "11111111-1111-4111-8111-111111111111");
  assert.equal(response.headers.get("location"), "https://app.404tradeos.com/reset-password");
});

test("token-hash recovery binds the marker cookie to the verified user after OTP verification", async () => {
  const calls: string[] = [];
  const response = await executeRecovery(
    "https://app.404tradeos.com/auth/confirm?token_hash=recovery-hash&type=recovery",
    {
      userId: "22222222-2222-4222-8222-222222222222",
      calls,
    }
  );

  assert.deepEqual(calls, ["verify:recovery-hash:recovery", "getUser"]);
  assert.equal(response.cookies.get("tradeos-recovery")?.value, "22222222-2222-4222-8222-222222222222");
  assert.equal(response.headers.get("location"), "https://app.404tradeos.com/reset-password");
});

test("recovery callback fails closed when the exchanged session has no verified user", async () => {
  const calls: string[] = [];
  const response = await executeRecovery("https://app.404tradeos.com/auth/confirm?code=pkce-code", { calls });

  assert.deepEqual(calls, ["exchange:pkce-code", "getUser"]);
  assert.equal(response.cookies.get("tradeos-recovery"), undefined);
  assert.equal(response.headers.get("location"), "https://app.404tradeos.com/reset-password?error=invalid-link");
});

test("recovery route keeps the verified-user ordering contract in source", async () => {
  const source = await readRecoveryRouteSource();
  const exchangeIndex = source.indexOf("exchangeCodeForSession(code)");
  const getUserIndex = source.indexOf("supabase.auth.getUser()");
  const cookieIndex = source.indexOf('response.cookies.set("tradeos-recovery", user.id');

  assert.notEqual(exchangeIndex, -1, "expected PKCE recovery exchange");
  assert.notEqual(getUserIndex, -1, "expected server-side identity verification");
  assert.notEqual(cookieIndex, -1, "expected recovery marker to contain the verified user id");
  assert.ok(exchangeIndex < getUserIndex, "identity must be read only after the recovery exchange succeeds");
  assert.ok(getUserIndex < cookieIndex, "the marker must be written only after identity verification");
  assert.doesNotMatch(source, /cookies\.set\(\s*["']tradeos-recovery["']\s*,\s*["']1["']/);
});
