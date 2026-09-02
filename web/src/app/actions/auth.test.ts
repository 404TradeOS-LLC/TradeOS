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


function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "..", relativePath), "utf8");
}

test("transactional auth routes and actions exist for the delivered email links", () => {
  const source = readAuthActionsSource();
  assert.match(source, /requestPasswordResetAction/);
  assert.match(source, /resetPasswordAction/);
  assert.match(source, /acceptInviteAction/);

  const resetPage = readSource("reset-password/page.tsx");
  const invitePage = readSource("invite/accept/page.tsx");
  assert.match(resetPage, /ResetPasswordForm/);
  assert.match(invitePage, /InviteAcceptForm/);
});

test("invite acceptance establishes the backend local session before entering the app", () => {
  const source = readAuthActionsSource();
  const inviteStart = source.indexOf("export async function acceptInviteAction");
  const loginStart = source.indexOf("export async function loginAction");
  const inviteSource = source.slice(inviteStart, loginStart);
  assert.match(inviteSource, /setLocalSession\(session\.token, session\.refreshToken\)/);
  assert.match(inviteSource, /redirect\(["']\/dashboard["']\)/);
});


function readRecoveryRouteSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "..", "auth", "confirm", "route.ts"), "utf8");
}

test("web password recovery uses Supabase Auth and exchanges recovery links before updating the password", () => {
  const authSource = readAuthActionsSource();
  const routeSource = readRecoveryRouteSource();

  assert.match(authSource, /resetPasswordForEmail/);
  assert.match(authSource, /updateUser\(\{ password \}\)/);
  assert.match(routeSource, /exchangeCodeForSession/);
  assert.match(routeSource, /verifyOtp/);
  assert.match(routeSource, /tradeos-recovery/);
  assert.match(routeSource, /reset-password/);
});

function readResetPasswordPageSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "..", "reset-password", "page.tsx"), "utf8");
}

function readResetPasswordFormSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "..", "reset-password", "reset-password-form.tsx"), "utf8");
}

test("/auth/confirm exchanges a PKCE code for a session before marking the recovery cookie", () => {
  const routeSource = readRecoveryRouteSource();
  const codeBranchIndex = routeSource.indexOf("if (code) {");
  assert.notEqual(codeBranchIndex, -1);

  const cookieSetIndex = routeSource.indexOf('response.cookies.set("tradeos-recovery"');
  assert.notEqual(cookieSetIndex, -1);
  assert.ok(codeBranchIndex < cookieSetIndex, "the PKCE code exchange must run before the recovery cookie is set");
  assert.match(routeSource, /supabase\.auth\.exchangeCodeForSession\(code\)/);
});

test("/auth/confirm verifies a recovery token_hash via verifyOtp before marking the recovery cookie", () => {
  const routeSource = readRecoveryRouteSource();
  const tokenHashBranchIndex = routeSource.indexOf('tokenHash && type === "recovery"');
  assert.notEqual(tokenHashBranchIndex, -1);

  const cookieSetIndex = routeSource.indexOf('response.cookies.set("tradeos-recovery"');
  assert.ok(tokenHashBranchIndex < cookieSetIndex, "token_hash verification must run before the recovery cookie is set");
  assert.match(routeSource, /supabase\.auth\.verifyOtp\(\{ token_hash: tokenHash, type \}\)/);
});

test("/auth/confirm redirects to a generic invalid-link error, with server-side diagnostics, when neither code nor a recovery token_hash is present", () => {
  const routeSource = readRecoveryRouteSource();
  const elseBranchIndex = routeSource.indexOf("} else {");
  const nextIfIndex = routeSource.indexOf("if (error) {");
  assert.notEqual(elseBranchIndex, -1);
  const elseBranch = routeSource.slice(elseBranchIndex, nextIfIndex);

  assert.match(elseBranch, /console\.error\(/);
  assert.match(elseBranch, /resetRedirect\(request, "invalid-link"\)/);
});

test("/auth/confirm logs the Supabase error server-side but redirects with a generic invalid-link error (expired or reused links included)", () => {
  const routeSource = readRecoveryRouteSource();
  const errorBranchIndex = routeSource.indexOf("if (error) {\n    // Server-side diagnostic");
  assert.notEqual(errorBranchIndex, -1, "expected the post-exchange error branch with its diagnostic comment");

  const errorBranch = routeSource.slice(errorBranchIndex, errorBranchIndex + 400);
  assert.match(errorBranch, /console\.error\("Password recovery exchange failed:", error\.message\)/);
  assert.match(errorBranch, /resetRedirect\(request, "invalid-link"\)/);
  assert.doesNotMatch(errorBranch, /searchParams\.set\(["']error["'],\s*error\.message\)/);
});

test("/auth/confirm restricts the redirect target to the /reset-password allowlist regardless of the requested next param", () => {
  const routeSource = readRecoveryRouteSource();
  assert.match(routeSource, /ALLOWED_NEXT_PATHS = new Set\(\["\/reset-password"\]\)/);
  assert.match(routeSource, /ALLOWED_NEXT_PATHS\.has\(requestedNext\)/);
});

test("reset-password page never renders the password form for a missing recovery session (no token, no cookie, no error param)", () => {
  const pageSource = readResetPasswordPageSource();
  assert.match(pageSource, /cookies\(\)/);
  assert.match(pageSource, /tradeos-recovery/);
  assert.match(pageSource, /hasRecoverySession/);

  const resolveFnIndex = pageSource.indexOf("async function resolveContent");
  assert.notEqual(resolveFnIndex, -1);
  const resolveFnSource = pageSource.slice(resolveFnIndex);
  assert.match(resolveFnSource, /if \(!hasRecoverySession\) \{\s*\n\s*return <RecoveryErrorCard/);
});

test("reset-password page shows a clear recovery error with a link back to /forgot-password for an expired, reused, or scanner-consumed link", () => {
  const pageSource = readResetPasswordPageSource();
  assert.match(pageSource, /function RecoveryErrorCard/);
  assert.match(pageSource, /href="\/forgot-password"/);

  // The /auth/confirm redirect's ?error=invalid-link must short-circuit to
  // the error card before ever considering the recovery cookie or rendering
  // the form — this is what makes a consumed/expired/reused link fail
  // closed immediately instead of surfacing only after form submission.
  const resolveFnIndex = pageSource.indexOf("async function resolveContent");
  const resolveFnSource = pageSource.slice(resolveFnIndex);
  const tokenCheckIndex = resolveFnSource.indexOf("if (token)");
  const errorCheckIndex = resolveFnSource.indexOf("if (error) return <RecoveryErrorCard");
  const cookieCheckIndex = resolveFnSource.indexOf("hasRecoverySession");
  assert.notEqual(tokenCheckIndex, -1);
  assert.notEqual(errorCheckIndex, -1);
  assert.notEqual(cookieCheckIndex, -1);
  assert.ok(tokenCheckIndex < errorCheckIndex && errorCheckIndex < cookieCheckIndex);
});

test("resetPasswordAction fails closed with a recovery error when the tradeos-recovery cookie is absent, without calling Supabase", () => {
  const authSource = readAuthActionsSource();
  const fnIndex = authSource.indexOf("export async function resetPasswordAction");
  const nextFnIndex = authSource.indexOf("export async function acceptInviteAction");
  const fnSource = authSource.slice(fnIndex, nextFnIndex);

  const cookieCheckIndex = fnSource.indexOf('cookieStore.get("tradeos-recovery")?.value !== "1"');
  const updateUserIndex = fnSource.indexOf("supabase.auth.updateUser({ password })");
  assert.notEqual(cookieCheckIndex, -1);
  assert.notEqual(updateUserIndex, -1);
  assert.ok(cookieCheckIndex < updateUserIndex, "the recovery cookie must be checked before calling updateUser");

  const cookieBranch = fnSource.slice(cookieCheckIndex, updateUserIndex);
  assert.match(cookieBranch, /recoveryError: true/);
});

test("resetPasswordAction logs the Supabase updateUser failure server-side but keeps the client error generic", () => {
  const authSource = readAuthActionsSource();
  const fnIndex = authSource.indexOf("export async function resetPasswordAction");
  const nextFnIndex = authSource.indexOf("export async function acceptInviteAction");
  const fnSource = authSource.slice(fnIndex, nextFnIndex);

  const updateUserIndex = fnSource.indexOf("supabase.auth.updateUser({ password })");
  const afterUpdate = fnSource.slice(updateUserIndex, updateUserIndex + 700);
  assert.match(afterUpdate, /console\.error\("Supabase updateUser failed during password reset:", error\.message\)/);
  assert.match(afterUpdate, /error: "Unable to update your password\.[\s\S]*?Request a new link and try again\."/);
  assert.match(afterUpdate, /recoveryError: true/);
  assert.doesNotMatch(afterUpdate, /error:\s*error\.message/);
});

test("resetPasswordAction clears the recovery cookie only after a successful updateUser call, so a reused link can't be replayed", () => {
  const authSource = readAuthActionsSource();
  const fnIndex = authSource.indexOf("export async function resetPasswordAction");
  const nextFnIndex = authSource.indexOf("export async function acceptInviteAction");
  const fnSource = authSource.slice(fnIndex, nextFnIndex);

  const updateUserIndex = fnSource.indexOf("supabase.auth.updateUser({ password })");
  const deleteCookieIndex = fnSource.indexOf('cookieStore.delete("tradeos-recovery")');
  assert.notEqual(deleteCookieIndex, -1);
  assert.ok(updateUserIndex < deleteCookieIndex);
});

test("requestPasswordResetAction logs the Supabase error server-side but returns a safe generic message to the client", () => {
  const authSource = readAuthActionsSource();
  const fnIndex = authSource.indexOf("export async function requestPasswordResetAction");
  const nextFnIndex = authSource.indexOf("export async function resetPasswordAction");
  const fnSource = authSource.slice(fnIndex, nextFnIndex);

  assert.match(fnSource, /console\.error\("resetPasswordForEmail failed:", error\.message\)/);
  assert.match(fnSource, /error: "We couldn't process that request\. Please try again\."/);
  assert.doesNotMatch(fnSource, /error:\s*error\.message/);
});

test("reset-password form surfaces a 'Request a new link' path back to /forgot-password whenever the action reports a recovery error", () => {
  const formSource = readResetPasswordFormSource();
  assert.match(formSource, /state\.recoveryError/);
  assert.match(formSource, /href="\/forgot-password"/);
});

test("loginAction rejects a wrong password by surfacing Supabase's error rather than falling through to a session", () => {
  const authSource = readAuthActionsSource();
  const fnIndex = authSource.indexOf("export async function loginAction");
  const nextFnIndex = authSource.indexOf("export async function finishSetupAction");
  const fnSource = authSource.slice(fnIndex, nextFnIndex);

  const signInIndex = fnSource.indexOf("supabase.auth.signInWithPassword({ email, password })");
  assert.notEqual(signInIndex, -1);
  const afterSignIn = fnSource.slice(signInIndex);
  const errorCheckIndex = afterSignIn.indexOf("if (error) {");
  assert.notEqual(errorCheckIndex, -1);

  // On a Supabase error this must fall back to the backend's own login
  // check (for local/invited accounts), not silently proceed with no
  // session — either path still returns { error } rather than redirecting
  // to /dashboard when both fail.
  const errorBlock = afterSignIn.slice(errorCheckIndex);
  const catchIndex = errorBlock.indexOf("} catch {");
  assert.notEqual(catchIndex, -1);
  const catchBlock = errorBlock.slice(catchIndex, catchIndex + 100);
  assert.match(catchBlock, /return\s*\{\s*error:\s*error\.message\s*\}/);
});
