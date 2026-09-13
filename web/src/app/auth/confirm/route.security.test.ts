import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readRecoveryRouteSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "route.ts"), "utf8");
}

test("recovery callback binds the marker cookie to the verified Supabase user", () => {
  const source = readRecoveryRouteSource();
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

test("recovery callback fails closed when Supabase cannot resolve the recovered user", () => {
  const source = readRecoveryRouteSource();
  const getUserIndex = source.indexOf("supabase.auth.getUser()");
  const failureIndex = source.indexOf("if (userError || !user)");
  const cookieIndex = source.indexOf('response.cookies.set("tradeos-recovery", user.id');

  assert.notEqual(getUserIndex, -1);
  assert.notEqual(failureIndex, -1);
  assert.notEqual(cookieIndex, -1);
  assert.ok(getUserIndex < failureIndex && failureIndex < cookieIndex);

  const failureBranch = source.slice(failureIndex, cookieIndex);
  assert.match(failureBranch, /resetRedirect\(request, ["']invalid-link["']\)/);
});
