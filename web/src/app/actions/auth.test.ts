import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No jest/vitest/RTL/mock harness exists for `web/`'s Server Actions (see
// settingsAssetUpload.test.ts for the established precedent), so these pin
// the *shape* of actions/auth.ts's source rather than executing it. Each one
// failing means a future edit silently reintroduced the production incident
// this file exists to prevent: an authenticated-but-unprovisioned identity
// (no application membership, no organization_name in Supabase metadata)
// being redirected straight to /dashboard, where every data call 403s and
// the page crashes into the generic production error boundary.

function readAuthActionsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "auth.ts"), "utf8");
}

function readFinishSetupPageSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "..", "finish-setup", "page.tsx"), "utf8");
}

function readFinishSetupFormSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "..", "finish-setup", "finish-setup-form.tsx"), "utf8");
}

test("loginAction redirects to /finish-setup specifically when bootstrap reports organization_name_required", () => {
  const source = readAuthActionsSource();

  const loginFnIndex = source.indexOf("export async function loginAction");
  const finishSetupFnIndex = source.indexOf("export async function finishSetupAction");
  assert.notEqual(loginFnIndex, -1);
  assert.notEqual(finishSetupFnIndex, -1);

  const loginFnSource = source.slice(loginFnIndex, finishSetupFnIndex);
  assert.match(loginFnSource, /isOrganizationNameRequiredError\(err\)/);
  assert.match(loginFnSource, /redirect\(["']\/finish-setup["']\)/);
});

test("isOrganizationNameRequiredError matches on the backend's stable details.code, not on message text", () => {
  const source = readAuthActionsSource();
  const helperIndex = source.indexOf("function isOrganizationNameRequiredError");
  assert.notEqual(helperIndex, -1);

  const helperSource = source.slice(helperIndex, helperIndex + 500);
  assert.match(helperSource, /err\.status !== 400/);
  assert.match(helperSource, /["']organization_name_required["']/);
});

test("loginAction does not blindly redirect to /dashboard when bootstrap fails for a reason other than organization_name_required", () => {
  const source = readAuthActionsSource();

  const loginFnIndex = source.indexOf("export async function loginAction");
  const finishSetupFnIndex = source.indexOf("export async function finishSetupAction");
  const loginFnSource = source.slice(loginFnIndex, finishSetupFnIndex);

  // The catch block around bootstrapOrganization must return an { error }
  // AuthActionState (staying on /login) rather than falling through to an
  // unconditional redirect("/dashboard") after a failed bootstrap call —
  // that fallthrough is exactly what produced the incident.
  const catchIndex = loginFnSource.indexOf("} catch (err) {");
  assert.notEqual(catchIndex, -1, "expected a catch block around the bootstrapOrganization call");
  const catchSource = loginFnSource.slice(catchIndex);
  const catchBlockEnd = catchSource.indexOf("\n  }\n");
  const catchBody = catchSource.slice(0, catchBlockEnd === -1 ? undefined : catchBlockEnd);

  assert.doesNotMatch(catchBody, /redirect\(["']\/dashboard["']\)/);
  assert.match(catchBody, /return\s*\{\s*\n?\s*error:/);
});

test("loginAction still reads organization_name/full_name from Supabase user metadata before calling bootstrap (post-#87 signup path)", () => {
  const source = readAuthActionsSource();
  assert.match(source, /metadata\?\.organization_name/);
  assert.match(source, /metadata\?\.full_name/);
});

test("finishSetupAction requires an active Supabase session and redirects unauthenticated callers to /login before provisioning anything", () => {
  const source = readAuthActionsSource();
  const fnIndex = source.indexOf("export async function finishSetupAction");
  assert.notEqual(fnIndex, -1);

  const nextFnIndex = source.indexOf("export async function logoutAction");
  const fnSource = source.slice(fnIndex, nextFnIndex === -1 ? undefined : nextFnIndex);

  const sessionCheckIndex = fnSource.indexOf("session?.access_token");
  const bootstrapCallIndex = fnSource.indexOf("bootstrapOrganization(session.access_token");
  assert.notEqual(sessionCheckIndex, -1, "expected finishSetupAction to check session?.access_token");
  assert.notEqual(bootstrapCallIndex, -1, "expected finishSetupAction to call bootstrapOrganization with session.access_token");
  assert.ok(sessionCheckIndex < bootstrapCallIndex, "the session check must happen before the bootstrap call, not after");
  assert.match(fnSource, /redirect\(["']\/login["']\)/);
});

test("finishSetupAction never reads role, userId, organizationId, or authSubject from client-supplied formData", () => {
  const source = readAuthActionsSource();
  const fnIndex = source.indexOf("export async function finishSetupAction");
  const nextFnIndex = source.indexOf("export async function logoutAction");
  const fnSource = source.slice(fnIndex, nextFnIndex === -1 ? undefined : nextFnIndex);

  for (const forbiddenField of ["role", "userId", "organizationId", "authSubject"]) {
    assert.doesNotMatch(
      fnSource,
      new RegExp(`formData\\.get\\(\\s*["']${forbiddenField}["']\\s*\\)`),
      `finishSetupAction must not read "${forbiddenField}" from formData`
    );
  }
  // organizationName is the one legitimate onboarding field the browser supplies.
  assert.match(fnSource, /formData\.get\(\s*["']organizationName["']\s*\)/);
});

test("finish-setup page requires an authenticated session and redirects to /login otherwise", () => {
  const source = readFinishSetupPageSource();
  assert.match(source, /const session = await getSession\(\)/);
  assert.match(source, /if \(!session\) redirect\(["']\/login["']\)/);
});

test("finish-setup page renders only the setup form, not the full authenticated app nav", () => {
  const source = readFinishSetupPageSource();
  assert.doesNotMatch(source, /AppNav/);
});

test("the finish-setup form only submits organizationName, no identity or role fields", () => {
  const source = readFinishSetupFormSource();
  assert.match(source, /name="organizationName"/);
  for (const forbiddenField of ["role", "userId", "organizationId", "authSubject"]) {
    assert.doesNotMatch(source, new RegExp(`name="${forbiddenField}"`));
  }
});

test("signupAction, loginAction, and finishSetupAction all call the same idempotent bootstrapOrganization helper (no duplicate-org path)", () => {
  const source = readAuthActionsSource();
  const occurrences = source.match(/await bootstrapOrganization\(/g) ?? [];
  assert.equal(occurrences.length, 3, "expected exactly three call sites: signupAction, loginAction, and finishSetupAction");
});
