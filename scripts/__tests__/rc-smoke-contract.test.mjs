import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const workflow = read(".github/workflows/rc-smoke.yml");
const routeSmoke = read("app/scripts/authenticated-route-smoke.mjs");
const authSmoke = read("app/scripts/authenticated-auth-smoke.mjs");
const golden = read("app/scripts/estimate-deliverability-golden.mjs");
const business = read("app/scripts/rc-business-flow-smoke.mjs");

test("RC workflow uses real routes and runs every S047 smoke surface", () => {
  assert.match(workflow, /default: \/dashboard,\/customers,\/projects,\/dispatch,\/field,\/costbook/);
  assert.match(workflow, /node scripts\/authenticated-auth-smoke\.mjs/);
  assert.match(workflow, /node scripts\/authenticated-route-smoke\.mjs/);
  assert.match(workflow, /node scripts\/estimate-deliverability-golden\.mjs/);
  assert.match(workflow, /node scripts\/rc-business-flow-smoke\.mjs/);
  assert.match(workflow, /RC_E2E_AUTH_EMAIL/);
  assert.match(workflow, /RC_E2E_AUTH_PASSWORD/);
  assert.match(workflow, /RC_E2E_AUTH_REJECTED_PASSWORD/);
  assert.doesNotMatch(workflow, /options:\n(?:.|\n)*- production/);
});

test("route smoke fails closed before capturing production or unsanitized screenshots", () => {
  assert.match(routeSmoke, /RC_TARGET_ENVIRONMENT is required/);
  assert.match(routeSmoke, /captureScreenshots && targetEnvironment === "production"/);
  assert.match(routeSmoke, /captureScreenshots && !sanitizedTenant/);
  assert.match(routeSmoke, /screenshot = null/);
  assert.match(routeSmoke, /RC_ROUTES must contain same-origin absolute paths/);
  assert.match(routeSmoke, /\/dispatch,\/field/);
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
  assert.doesNotMatch(authSmoke, /console\.log\([^)]*password/i);
});

test("golden workflow is explicitly limited to a dedicated non-production tenant", () => {
  assert.match(golden, /RC_ALLOW_MUTATIONS=true is required/);
  assert.match(golden, /RC_SMOKE_TENANT_LABEL is required/);
  assert.match(golden, /\["preview", "staging"\]/);
  for (const marker of ["Send to customer", "Mark accepted", "Create contract", "Create invoice"]) {
    assert.match(golden, new RegExp(marker));
  }
  assert.match(golden, /contractId/);
  assert.match(golden, /invoiceId/);
});

test("business-flow smoke follows resource-backed project, portal, and job routes", () => {
  for (const route of [
    "`/projects/${run.projectId}/contracts/${run.contractId}`",
    "`/projects/${run.projectId}/invoices/${run.invoiceId}`",
    "`/portal/projects/${run.projectId}`",
    "`/portal/proposals/${run.proposalId}`",
    "`/portal/contracts/${run.contractId}`",
    "`/portal/invoices/${run.invoiceId}`",
    '"/dispatch"',
    '"/field"',
  ]) assert.ok(business.includes(route), `missing business route ${route}`);
  assert.match(business, /golden workflow report is missing/);
});
