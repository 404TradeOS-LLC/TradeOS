import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const workflow = read(".github/workflows/rc-smoke.yml");
const routeSmoke = read("app/scripts/authenticated-route-smoke.mjs");
const authSmoke = read("app/scripts/authenticated-auth-smoke.mjs");
const fieldSession = read("app/scripts/authenticated-field-session.mjs");
const golden = read("app/scripts/estimate-deliverability-golden.mjs");
const business = read("app/scripts/rc-business-flow-smoke.mjs");

test("RC workflow uses real routes and runs every authenticated smoke surface", () => {
  assert.match(workflow, /default: \/dashboard,\/customers,\/projects,\/dispatch,\/field,\/costbook/);
  assert.match(workflow, /node scripts\/authenticated-auth-smoke\.mjs/);
  assert.match(workflow, /node scripts\/authenticated-field-session\.mjs/);
  assert.match(workflow, /node scripts\/authenticated-route-smoke\.mjs/);
  assert.match(workflow, /node scripts\/estimate-deliverability-golden\.mjs/);
  assert.match(workflow, /node scripts\/rc-business-flow-smoke\.mjs/);
  assert.match(workflow, /RC_E2E_LIFECYCLE_AUTH_EMAIL/);
  assert.match(workflow, /RC_E2E_LIFECYCLE_AUTH_PASSWORD/);
  assert.match(workflow, /RC_E2E_LIFECYCLE_AUTH_REJECTED_PASSWORD/);
  assert.match(workflow, /RC_FIELD_AUTH_EMAIL: rc-field-tech@tradeos\.invalid/);
  assert.match(workflow, /RC_FIELD_USER_ID: 08d28981-52e8-4459-bcbb-1ef996baea92/);
  assert.doesNotMatch(workflow, /RC_E2E_FIELD_STORAGE_STATE_B64/);
  assert.match(workflow, /url\.protocol === "https:"/);
  assert.match(workflow, /tradeos-costbook-web-\[a-z0-9\]/);
  assert.doesNotMatch(workflow, /options:\n(?:.|\n)*- production/);
});

test("route smoke fails closed before capturing production or unsanitized screenshots", () => {
  assert.match(routeSmoke, /RC_TARGET_ENVIRONMENT is required/);
  assert.match(routeSmoke, /captureScreenshots && targetEnvironment === "production"/);
  assert.match(routeSmoke, /captureScreenshots && !sanitizedTenant/);
  assert.match(routeSmoke, /screenshot = null/);
  assert.match(routeSmoke, /RC_ROUTES must contain same-origin absolute paths/);
  assert.match(routeSmoke, /\/dispatch,\/field/);
  assert.match(routeSmoke, /approvedHost/);
  assert.match(routeSmoke, /stayedOnApprovedOrigin/);
});

test("auth smoke covers rejection, login, refresh, logout, and protected-route denial", () => {
  for (const marker of [
    "rejected credentials stay on login with an error",
    "successful login reaches the authenticated workspace",
    "authenticated session survives a page refresh",
    "logout clears the authenticated session",
    "expired or logged-out session redirects from a protected route",
  ]) assert.match(authSmoke, new RegExp(marker));
  assert.match(authSmoke, /RC_AUTH_REJECTED_PASSWORD/);
  assert.match(authSmoke, /openLoginPage/);
  assert.match(authSmoke, /finalUrl\.origin !== parsedBaseUrl\.origin/);
  assert.doesNotMatch(authSmoke, /console\.log\([^)]*password/i);
});

test("field session is regenerated from a dedicated technician identity", () => {
  assert.match(fieldSession, /RC_FIELD_AUTH_EMAIL is required/);
  assert.match(fieldSession, /RC_AUTH_PASSWORD is required for the field technician fixture/);
  assert.match(fieldSession, /RC_FIELD_STORAGE_STATE_PATH is required/);
  assert.match(fieldSession, /approved tradeos-costbook-web Vercel Preview host/);
  assert.match(fieldSession, /page\.getByRole\("button", \{ name: "Sign in" \}\)/);
  assert.match(fieldSession, /finalUrl\.pathname === "\/field"/);
  assert.match(fieldSession, /bodyText\.includes\("Field day"\)/);
  assert.match(fieldSession, /context\.storageState\(\{ path: storageStatePath \}\)/);
  assert.match(fieldSession, /fs\.chmod\(storageStatePath, 0o600\)/);
  assert.doesNotMatch(fieldSession, /console\.log\([^)]*password/i);
});

test("golden workflow is explicitly limited to a dedicated non-production tenant", () => {
  assert.match(golden, /RC_ALLOW_MUTATIONS=true is required/);
  assert.match(golden, /RC_SMOKE_TENANT_LABEL is required/);
  assert.match(golden, /\["preview", "staging"\]/);
  assert.match(golden, /protocol !== "https:"/);
  assert.match(golden, /approved tradeos-costbook-web Vercel Preview host/);
  for (const marker of ["Send to customer", "Mark accepted", "Create contract", "Create invoice"]) {
    assert.match(golden, new RegExp(marker));
  }
  assert.match(golden, /contractId/);
  assert.match(golden, /invoiceId/);
});

test("business-flow smoke executes payment through field completion", () => {
  for (const route of [
    "`/projects/${run.projectId}/contracts/${run.contractId}`",
    "`/projects/${run.projectId}/invoices/${run.invoiceId}`",
    "`/portal/projects/${run.projectId}`",
    "`/portal/proposals/${run.proposalId}`",
    "`/portal/contracts/${run.contractId}`",
    "`/portal/invoices/${run.invoiceId}`",
    '"/dispatch"',
  ]) assert.ok(business.includes(route), `missing business route ${route}`);

  assert.match(business, /RC_FIELD_AUTH_EMAIL is required for the dedicated field technician login/);
  assert.match(business, /RC_FIELD_USER_ID is required for technician assignment evidence/);
  assert.doesNotMatch(business, /tradeos-rc-owner-a90d5dad@mailinator\.com/);
  assert.doesNotMatch(business, /0858f7e5-4df3-46ec-9023-f7961d791c6b/);
  assert.match(business, /Send invoice/);
  assert.match(business, /Record payment/);
  assert.match(business, /Create job and open Dispatch/);
  assert.match(business, /assignmentRole: "technician"/);
  assert.match(business, /`\/jobs\/\$\{job\.id\}\/schedule`/);
  assert.match(business, /method: "PUT"/);
  assert.match(business, /`\/jobs\/\$\{job\.id\}\/dispatch`/);
  assert.match(business, /Start travel/);
  assert.match(business, /Arrived on site/);
  assert.match(business, /Complete job/);
  assert.match(business, /expectedStatus.*completed/);
  assert.match(business, /finalOwnerJob\?\.status === "completed"/);
  assert.match(business, /finalInvoice\?\.status === "paid"/);
  assert.match(business, /balanceDue/);
  assert.match(business, /waitForResource/);
  assert.match(business, /finalOrigin\.origin === parsedBaseUrl\.origin/);
  assert.match(business, /golden workflow report is missing/);
  assert.doesNotMatch(business, /console\.log\([^)]*fieldPassword/i);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /artifacts\/estimate-deliverability/);
});
