import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidCustomerPortalAccessToken } from "./customer-portal-access.ts";

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("customer portal pending-token validation matches the backend redemption contract", () => {
  assert.equal(isValidCustomerPortalAccessToken(undefined), false);
  assert.equal(isValidCustomerPortalAccessToken("x".repeat(39)), false);
  assert.equal(isValidCustomerPortalAccessToken("x".repeat(40)), true);
  assert.equal(isValidCustomerPortalAccessToken("x".repeat(128)), true);
  assert.equal(isValidCustomerPortalAccessToken("x".repeat(129)), false);
});

test("email-link GET stores a short-lived pending token without redeeming it", () => {
  const source = readSource("app/customer-portal/access/route.ts");
  assert.match(source, /CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE/);
  assert.match(source, /CUSTOMER_PORTAL_PENDING_ACCESS_MAX_AGE_SECONDS/);
  assert.match(source, /customer-portal\/access\/confirm/);
  assert.doesNotMatch(source, /customer-portal\/redeem|\bfetch\s*\(/);
});

test("redemption requires an explicit exact-origin POST and clears the pending token", () => {
  const source = readSource("app/customer-portal/access/redeem/route.ts");
  const originCheck = source.indexOf("shouldRejectProxyMutation");
  const cookieRead = source.indexOf("request.cookies.get");
  const redemption = source.indexOf("/api/v1/customer-portal/redeem");
  assert.ok(originCheck >= 0 && originCheck < cookieRead && cookieRead < redemption);
  assert.match(source, /export async function POST/);
  assert.match(source, /CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE, ""/);
  assert.match(source, /maxAge: 0/);

  const confirmPage = readSource("app/customer-portal/access/confirm/page.tsx");
  assert.match(confirmPage, /action="\/customer-portal\/access\/redeem" method="post"/);
  assert.doesNotMatch(confirmPage, /name="token"|value=\{pendingToken\}/);
});

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(srcRoot, relativePath), "utf8");
}
