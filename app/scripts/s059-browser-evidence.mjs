import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { VIEWPORTS, readPngDimensions } from "./beta-evidence/lib/evidence-artifacts.mjs";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";
import {
  EXPIRED_BROWSER_BLOCKED,
  STAGING_PROJECT_REF,
  assertAccessErrorPage,
  assertAccessRequiredPage,
  assertPdfResponse,
  assertPortalPage,
  createReportSkeleton,
  expectedStatusForCase,
  isValidPortalTokenShape,
  redactBearerMaterial,
  sha256Hex,
} from "./s059-evidence-contract.mjs";

// S059 authenticated customer-portal browser evidence.
//
// Journey (see docs/architecture/S059_CERTIFICATION_EVIDENCE.md):
//   Phase A — staff issuance (UI preferred, API fallback) for customers A
//     and B, plus one token revoked before redemption.
//   Phase B — customer redemption + portal reads at 1440/1024/768/390.
//   Phase C — contract signing (synthetic signer name).
//   Phase D — negative security evidence (replay, revoked, malformed,
//     cross-customer, cross-tenant, unauthenticated, wrong-role, draft
//     exclusion, cross-origin, GAP-1 session-revocation proof).
//   Phase E — cleanup: revoke every token this run created; delete nothing.
//
// Bearer-material discipline (hard requirements, not guidance):
// - Tokens exist only in process memory. They are never written to disk,
//   logs, or report.json, and no console output ever contains one.
// - Error text is redacted before it is logged or recorded: Playwright
//   navigation errors embed the full request URL, so a failed goto of a
//   magic-link URL would otherwise leak the raw token into the workflow log
//   and the retained artifact (see redactBearerMaterial).
// - Staff and customer browser contexts never share storage state. Portal
//   contexts are created with no storage state, and storageState() is never
//   called on one.
// - Trace, video, and HAR are OFF for every context (Playwright defaults).
// - Screenshots start only after the clean /customer-portal/access/confirm
//   URL loads. The staff link-display view is never screenshotted while the
//   link is visible.
// - The session cookie's flags are checked from the redeem response's
//   set-cookie header when available, else from context.cookies() IN MEMORY
//   ONLY (values never stored or logged).
// - One portal context per customer; the viewport is resized between
//   captures instead of re-redeeming per viewport. This keeps the session
//   cookie inside a single cookie jar (never copied between contexts) and
//   keeps the run inside the backend's 20-requests-per-15-minutes
//   redeem/issue/revoke rate limit (planned total: 16).
//
// Fixtures are created at run time in the TEST Org (sanitized tenant)
// through the shipped staff API via the authenticated browser context's
// /api/proxy/* surface — the same surface the product's client components
// use. Proposal acceptance via the staff accept endpoint is fixture setup
// only (it creates the pending contract the signing step needs); it is not
// S019 proposal-acceptance certification. Expired-token/session browser
// cases (B6/E4) are NOT attempted: see EXPIRED_BROWSER_BLOCKED.
//
// Env: S059_BASE_URL, S059_EXPECTED_SHA, S059_SANITIZED_TENANT,
// S059_ALLOW_MUTATIONS, S059_STORAGE_STATE_PATH, S059_EVIDENCE_DIR,
// BETA_RC_SUPABASE_PROJECT_REF, BETA_SMOKE_ORG_ID, S059_USE_TEST_ORG
// (default "true"), S059_REQUIRE_SHA_CORRELATION (default "true"),
// BETA_FOREIGN_CUSTOMER_ID, BETA_FOREIGN_PROJECT_ID,
// BETA_S052_ADMIN_EMAIL, BETA_S052_ADMIN_PASSWORD (both optional, only for
// the wrong-role A4 probe).

const baseUrl = assertApprovedRcUrl(process.env.S059_BASE_URL).origin;
const expectedSupabaseRef = assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);
assert.equal(process.env.S059_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
assert.equal(process.env.S059_ALLOW_MUTATIONS, "true", "Smoke fixture mutation consent required");
const storageState = process.env.S059_STORAGE_STATE_PATH;
assert.ok(storageState, "S059_STORAGE_STATE_PATH is required");
const useTestOrg = (process.env.S059_USE_TEST_ORG ?? "true") !== "false";
if (useTestOrg) {
  assert.equal(
    expectedSupabaseRef,
    STAGING_PROJECT_REF,
    "The TEST Org fixture exists only in TradeOS Staging; use_test_org requires the staging data plane",
  );
}
const requireCorrelation = (process.env.S059_REQUIRE_SHA_CORRELATION ?? "true") !== "false";
const outDir = process.env.S059_EVIDENCE_DIR || "../artifacts/s059-browser-evidence";
const identity = JSON.parse(await fs.readFile(path.join(outDir, "deployment-identity.json"), "utf8"));
assert.equal(identity.supabaseProjectRef, expectedSupabaseRef, "Mutating evidence requires deployment-attested RC Supabase identity");
if (requireCorrelation) {
  assert.equal(identity.shaCorrelated, true, "SHA correlation is required for this run");
  assert.equal(identity.commitSha, process.env.S059_EXPECTED_SHA, "Deployment identity SHA does not match the expected SHA");
}
const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
const report = createReportSkeleton({
  baseUrl,
  runId,
  workflowSha: process.env.GITHUB_SHA ?? null,
  deployedSha: identity.commitSha,
  supabaseProjectRef: expectedSupabaseRef,
  tenantLabel: process.env.S059_SMOKE_TENANT_LABEL ?? null,
  orgId: process.env.BETA_SMOKE_ORG_ID ?? null,
});
await fs.mkdir(outDir, { recursive: true });

// Rate-limited calls (backend customerPortalRateLimit: 20 per 15 min per IP
// across redeem + issue + revoke). Counted, never retried; a 429 fails the
// run closed with the exact step named.
let rateLimitedCalls = 0;
function countRateLimitedCall(label) {
  rateLimitedCalls += 1;
  assert.ok(rateLimitedCalls <= 20, `Rate-limit budget exhausted at ${label} (${rateLimitedCalls}/20)`);
}

function recordCase(caseId, outcome, detail) {
  const entry = { caseId, status: outcome, ...(detail ? { detail } : {}) };
  report.cases.push(entry);
  return entry;
}

function passCase(caseId, detail) {
  console.log(`PASS ${caseId}${detail ? ` ${detail}` : ""}`);
  return recordCase(caseId, "PASS", detail);
}

function failCase(caseId, error) {
  const detail = redactBearerMaterial(error.message);
  console.error(`FAIL ${caseId}: ${detail}`);
  return recordCase(caseId, "FAIL", detail);
}

async function writeReport() {
  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
}

async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.addStyleTag({
    content: 'nav[aria-label="404TradeOS Control Dock"] { display: none !important; }',
  });
  const file = `${name}.png`;
  const buffer = await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  assert.equal(readPngDimensions(buffer)?.width, page.viewportSize().width, "Screenshot width must match viewport");
  return file;
}

async function metrics(page) {
  return page.evaluate(() => ({
    pathname: location.pathname,
    bodyText: document.body.innerText,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

async function waitForLoginReady(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".entry-content");
      if (!el || el.hasAttribute("inert")) return false;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      return window.__tradeosLoginFilmFinished === true;
    },
    undefined,
    { timeout: 30_000 },
  ).catch(async () => {
    // Reduced-motion sessions and deployments without the intro film have no
    // film transition to wait for; the form itself is the readiness signal.
    await page.locator('[name="email"]').waitFor({ state: "visible", timeout: 10_000 });
  });
}

const browser = await chromium.launch({ headless: true });
const issuedTokens = [];
const revokedTokenIds = [];
// Assigned inside the try, right after the staff page exists, to the
// exactly-once token cleanup (Phase E). The catch path calls it too, so a
// fatal failure mid-journey still revokes what was issued instead of
// leaving live tokens behind for their 7-day TTL. It stays a no-op when
// the staff page was never created.
let runCleanup = async () => {};

try {
  // ---- Staff context: fixture creation through the shipped staff API. ----
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState });
  const staffPage = await staffContext.newPage();
  staffPage.setDefaultTimeout(30_000);

  // Token cleanup, defined here so the catch path can run it after a fatal
  // failure. It uses only module-scope state (issuedTokens /
  // revokedTokenIds) and the hoisted revokeToken helper — never try-scoped
  // bindings such as tokenA — so it is safe to call from the catch even
  // when the failure happened before those bindings existed. tokenA needs
  // no special case here: the API path registers it in issuedTokens via
  // issueViaApi, and the UI path has no id to revoke.
  let cleanupDone = false;
  runCleanup = async () => {
    if (cleanupDone) return;
    cleanupDone = true;
    const cleanupIds = [...new Set(issuedTokens.map((issued) => issued.id).filter(Boolean))];
    for (const tokenId of cleanupIds) {
      if (revokedTokenIds.includes(tokenId)) continue; // Already revoked (E3 / B7); revoking again would only spend rate-limit budget.
      try {
        await revokeToken(tokenId, "cleanup");
      } catch (error) {
        const detail = redactBearerMaterial(error.message);
        console.error(`Cleanup revoke failed for a token id: ${detail}`);
        report.cleanupFailures = [...(report.cleanupFailures ?? []), detail];
      }
    }
  };

  async function staffProxy(method, suffix, body, expectedStatus) {
    const response = await staffPage.request.fetch(new URL(`/api/proxy/${suffix}`, baseUrl).toString(), {
      method,
      ...(body === undefined ? {} : { data: body }),
    });
    assert.equal(response.status(), expectedStatus, `${method} /api/proxy/${suffix} returned ${response.status()} (expected ${expectedStatus})`);
    if (response.status() === 204) return null;
    return response.json();
  }

  const suffix = `s059-${runId}`;
  const customerA = await staffProxy("POST", "customers", { name: `S059 Customer A ${suffix}`, email: `s059-a-${suffix}@example.test` }, 201);
  const customerB = await staffProxy("POST", "customers", { name: `S059 Customer B ${suffix}`, email: `s059-b-${suffix}@example.test` }, 201);
  const customerNoEmail = await staffProxy("POST", "customers", { name: `S059 Customer No Email ${suffix}` }, 201);
  const projectA = await staffProxy("POST", "projects", { customerId: customerA.id, name: `S059 Project A ${suffix}` }, 201);
  const projectB = await staffProxy("POST", "projects", { customerId: customerB.id, name: `S059 Project B ${suffix}` }, 201);
  assert.equal(customerA.email, `s059-a-${suffix}@example.test`, "Fixture customer A must carry an email address");

  async function createProposal(projectId, finalPrice) {
    const proposal = await staffProxy("POST", "proposals", { projectId, finalPrice, scopeOfWork: "S059 synthetic scope" }, 201);
    assert.equal(proposal.status, "draft", "A new proposal must start as a draft");
    return proposal;
  }
  async function sendProposal(proposal) {
    const sent = await staffProxy("POST", `proposals/${proposal.id}/send`, {}, 200);
    assert.equal(sent.status, "sent", "A sent proposal must report status sent");
    return sent;
  }
  async function createInvoice(projectId, linePrice) {
    const invoice = await staffProxy(
      "POST",
      "invoices",
      { projectId, lineItems: [{ description: "S059 synthetic line", quantity: 1, unitOfMeasure: "ea", unitPrice: linePrice }] },
      201,
    );
    assert.equal(invoice.status, "draft", "A new invoice must start as a draft");
    return invoice;
  }
  async function sendInvoice(invoice) {
    const sent = await staffProxy("POST", `invoices/${invoice.id}/send`, {}, 200);
    assert.equal(sent.status, "sent", "A sent invoice must report status sent");
    return sent;
  }

  // Non-draft proposal A -> accepted (fixture setup only, see header) ->
  // pending contract A, the signing target.
  const proposalA = await sendProposal(await createProposal(projectA.id, 1500));
  const acceptedA = await staffProxy("POST", `proposals/${proposalA.id}/accept`, {}, 200);
  assert.equal(acceptedA.status, "accepted", "Fixture proposal A must be accepted before a contract can be created");
  const contractA = await staffProxy("POST", "contracts", { proposalId: proposalA.id }, 201);
  assert.equal(contractA.status, "pending_signature", "Fixture contract A must be pending signature");
  // Non-draft proposal/invoice B (cross-customer denial target).
  const proposalB = await sendProposal(await createProposal(projectB.id, 1200));
  const invoiceB = await sendInvoice(await createInvoice(projectB.id, 1200));
  // Non-draft invoice A.
  const invoiceA = await sendInvoice(await createInvoice(projectA.id, 1500));
  // Draft fixtures (draft-exclusion target).
  const draftProposal = await createProposal(projectA.id, 900);
  const draftInvoice = await createInvoice(projectA.id, 900);

  report.fixtures = {
    customerA: customerA.id,
    customerB: customerB.id,
    customerNoEmail: customerNoEmail.id,
    projectA: projectA.id,
    projectB: projectB.id,
    proposalA: proposalA.id,
    proposalB: proposalB.id,
    draftProposal: draftProposal.id,
    invoiceA: invoiceA.id,
    invoiceB: invoiceB.id,
    draftInvoice: draftInvoice.id,
    contractA: contractA.id,
  };
  console.log("Fixtures created in the sanitized tenant (ids recorded in report.json)");

  // ---- Phase A: staff issuance. UI preferred for A; API for the rest. ----
  async function issueViaApi(customerId) {
    countRateLimitedCall("issue");
    const issued = await staffProxy("POST", "customer-portal/access-tokens", { customerId }, 201);
    assert.ok(isValidPortalTokenShape(issued.token), "Issued token has an invalid shape");
    const expiresAt = new Date(issued.expiresAt).getTime();
    assert.ok(
      Math.abs(expiresAt - (Date.now() + 7 * 24 * 60 * 60 * 1000)) < 10 * 60 * 1000,
      "Issued token must expire about 7 days after issuance",
    );
    issuedTokens.push({ id: issued.id, customerId, token: issued.token });
    return issued;
  }

  let tokenA;
  try {
    // Screenshot the issuance form BEFORE the link exists; the link-display
    // view is never screenshotted while the link is visible.
    await staffPage.goto(new URL(`/customers/${customerA.id}`, baseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
    await screenshot(staffPage, "staff-issue-form");
    await staffPage.getByRole("button", { name: "Create portal link", exact: true }).click();
    const linkInput = staffPage.locator("#customer-portal-link");
    await linkInput.waitFor({ state: "visible", timeout: 30_000 });
    const link = await linkInput.inputValue();
    const parsed = new URL(link, baseUrl);
    const rawToken = parsed.searchParams.get("token");
    assert.ok(isValidPortalTokenShape(rawToken), "UI-issued token has an invalid shape");
    // The staff UI returns the link and expiry only — not the token id — so
    // this UI-issued token cannot later be revoked by id. It is spent by the
    // Phase B redemption (a redeemed token can never redeem again), and its
    // session cookie lives only in the portal context closed at the end of
    // the run. An API twin issued below is revoked by id in cleanup; the
    // residual is recorded in report.cleanupNotes.
    tokenA = { token: rawToken, path: "ui", id: null };
    report.issuancePath.customerA = "ui";
    console.log("PASS A1 customer A link issued through the staff UI");
    // Issue an API twin for A so cleanup can revoke by id. This is a second
    // link for the same customer (revocation is per-token by design); the
    // twin is revoked unredeemed in cleanup (issueViaApi registers it in
    // issuedTokens).
    await issueViaApi(customerA.id);
    report.issuancePath.customerATwin = "api";
  } catch (error) {
    console.error(`UI issuance unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    const issued = await issueViaApi(customerA.id);
    tokenA = { token: issued.token, path: "api", id: issued.id };
    report.issuancePath.customerA = "api";
  }
  const issuedB = await issueViaApi(customerB.id);
  report.issuancePath.customerB = "api";
  const tokenB = { token: issuedB.token, path: "api", id: issuedB.id };
  const issuedRevoke = await issueViaApi(customerA.id);
  report.issuancePath.revokeBeforeRedemption = "api";
  const tokenRevoke = { token: issuedRevoke.token, path: "api", id: issuedRevoke.id };

  async function revokeToken(tokenId, label) {
    countRateLimitedCall(`revoke:${label}`);
    await staffProxy("POST", `customer-portal/access-tokens/${tokenId}/revoke`, {}, 204);
    revokedTokenIds.push(tokenId);
  }

  // ---- Phase B: redemption + portal reads (one portal context, resized). ----
  const portalContextA = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
  const portalPageA = await portalContextA.newPage();
  portalPageA.setDefaultTimeout(30_000);

  // The access GET must not consume the token: the same token redeems
  // successfully immediately afterwards, which is the proof (B1).
  const accessUrlA = new URL(`/customer-portal/access?token=${tokenA.token}`, baseUrl).toString();
  const accessResponseA = await portalPageA.goto(accessUrlA, { waitUntil: "networkidle", timeout: 60_000 });
  await portalPageA.waitForURL("**/customer-portal/access/confirm", { timeout: 30_000 });
  await screenshot(portalPageA, "portal-confirm-1440");
  {
    const state = await metrics(portalPageA);
    assertPortalPage({ ...state, expectedPath: "/customer-portal/access/confirm", status: accessResponseA?.status() ?? 0, markers: ["Open your project documents"] });
  }
  countRateLimitedCall("redeem:A");
  const redeemPending = portalPageA.waitForResponse(
    (response) => new URL(response.url()).pathname === "/customer-portal/access/redeem",
  );
  await portalPageA.getByRole("button", { name: "Continue to customer portal", exact: true }).click();
  const redeemResponse = await redeemPending;
  assert.equal(redeemResponse.status(), 303, "Redemption must redirect (303)");
  await portalPageA.waitForURL("**/customer-portal", { timeout: 30_000 });
  // Session-cookie flags, in memory only. Prefer the redeem response's
  // set-cookie header; fall back to the cookie jar (values never stored).
  let cookieFlags = null;
  const setCookie = redeemResponse.headers()["set-cookie"] ?? "";
  const sessionCookieHeader = setCookie.split(/,(?=[^;]+=[^;]+;)/).find((part) => part.includes("tradeos_customer_portal_session="));
  if (sessionCookieHeader) {
    cookieFlags = {
      httpOnly: /httponly/i.test(sessionCookieHeader),
      sameSiteLax: /samesite=lax/i.test(sessionCookieHeader),
      pathRoot: /path=\//i.test(sessionCookieHeader),
      maxAge: Number(/max-age=(\d+)/i.exec(sessionCookieHeader)?.[1] ?? 0),
      method: "redeem-response-header",
    };
  } else {
    const cookies = await portalContextA.cookies();
    const session = cookies.find((cookie) => cookie.name === "tradeos_customer_portal_session");
    assert.ok(session, "Portal session cookie must be set after redemption");
    cookieFlags = {
      httpOnly: session.httpOnly === true,
      sameSiteLax: session.sameSite === "Lax",
      pathRoot: session.path === "/",
      maxAge: session.expires > 0 ? Math.round(session.expires - Date.now() / 1000) : 0,
      method: "cookie-jar-in-memory",
    };
    const pending = cookies.find((cookie) => cookie.name === "tradeos_customer_portal_pending_access");
    assert.equal(pending, undefined, "Pending-access cookie must be cleared after redemption");
  }
  assert.ok(cookieFlags.httpOnly, "Portal session cookie must be HttpOnly");
  assert.ok(cookieFlags.sameSiteLax, "Portal session cookie must be SameSite=Lax");
  assert.ok(cookieFlags.pathRoot, "Portal session cookie must be scoped to path /");
  assert.ok(cookieFlags.maxAge > 0, "Portal session cookie must carry a positive max-age");
  report.sessionCookieFlags = { ...cookieFlags, method: cookieFlags.method };
  console.log(`PASS B4 redemption (session cookie flags via ${cookieFlags.method})`);

  const portalPages = [
    { slug: "portal-home", path: "/customer-portal", markers: ["Your projects", projectA.name] },
    { slug: "portal-project", path: `/customer-portal/projects/${projectA.id}`, markers: [projectA.name] },
    { slug: "portal-proposal", path: `/customer-portal/proposals/${proposalA.id}`, markers: ["Proposal review"] },
    { slug: "portal-invoice", path: `/customer-portal/invoices/${invoiceA.id}`, markers: ["Invoice #"] },
    { slug: "portal-contract", path: `/customer-portal/contracts/${contractA.id}`, markers: ["Contract review"] },
  ];
  for (const viewport of VIEWPORTS) {
    const viewportEntry = { viewport: viewport.name, pages: [], passed: false };
    report.viewports.push(viewportEntry);
    await portalPageA.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const portalPageSpec of portalPages) {
      const entry = { slug: portalPageSpec.slug, path: portalPageSpec.path, viewport: viewport.name, passed: false };
      viewportEntry.pages.push(entry);
      try {
        const response = await portalPageA.goto(new URL(portalPageSpec.path, baseUrl).toString(), {
          waitUntil: "networkidle",
          timeout: 60_000,
        });
        const state = await metrics(portalPageA);
        assertPortalPage({ ...state, expectedPath: portalPageSpec.path, status: response?.status() ?? 0, markers: portalPageSpec.markers });
        entry.dimensions = { scrollWidth: state.scrollWidth, clientWidth: state.clientWidth };
        entry.screenshot = await screenshot(portalPageA, `${portalPageSpec.slug}-${viewport.name}`);
        entry.passed = true;
      } catch (error) {
        entry.error = error.message;
        report.failures = [...(report.failures ?? []), { slug: portalPageSpec.slug, viewport: viewport.name, error: error.message }];
        console.error(`FAIL ${portalPageSpec.slug} ${viewport.name}px: ${error.message}`);
      } finally {
        await writeReport();
      }
    }
    viewportEntry.passed = viewportEntry.pages.every((pageEntry) => pageEntry.passed);
    // Session introspection (C1), project list (C2), and one PDF (hash only)
    // are checked once, at the desktop width.
    if (viewport.name === "1440") {
      try {
        const sessionResponse = await portalContextA.request.get("/api/customer-portal/session");
        assert.equal(sessionResponse.status(), 200, "GET /session must return 200");
        const sessionBody = await sessionResponse.json();
        assert.equal(sessionBody.customerId, customerA.id, "Session must belong to customer A");
        assert.equal(sessionBody.orgId, report.orgId, "Session must belong to the smoke org");
        assert.ok(typeof sessionBody.sessionId === "string" && sessionBody.sessionId.length > 0, "Session must carry an id");
        passCase("C1", "session introspection belongs to customer A");
      } catch (error) {
        failCase("C1", error);
      }
      try {
        const listResponse = await portalContextA.request.get("/api/customer-portal/projects");
        assert.equal(listResponse.status(), 200, "GET /projects must return 200");
        const projects = await listResponse.json();
        assert.ok(Array.isArray(projects), "Project list must be an array");
        assert.ok(projects.some((project) => project.id === projectA.id), "Project list must include customer A's project");
        assert.ok(projects.every((project) => project.id === projectA.id), "Project list must not include another customer's project");
        passCase("C2", "project list is scoped to customer A");
      } catch (error) {
        failCase("C2", error);
      }
      try {
        const pdfResponse = await portalContextA.request.get(`/api/customer-portal/proposals/${proposalA.id}/pdf`);
        assertPdfResponse({ status: pdfResponse.status(), contentType: pdfResponse.headers()["content-type"] });
        const pdfBuffer = await pdfResponse.body();
        report.pdf = {
          proposalId: proposalA.id,
          status: pdfResponse.status(),
          contentType: pdfResponse.headers()["content-type"],
          bytes: pdfBuffer.length,
          sha256: sha256Hex(pdfBuffer),
        };
        assert.ok(pdfBuffer.length > 0, "Proposal PDF must not be empty");
        passCase("C11", "proposal PDF served with hash retained only");
      } catch (error) {
        failCase("C11", error);
      }
    }
    await writeReport();
  }

  // ---- Phase C: contract signing (synthetic signer, attribution booleans only). ----
  await portalPageA.setViewportSize({ width: 1440, height: 1000 });
  try {
    await portalPageA.goto(new URL(`/customer-portal/contracts/${contractA.id}`, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await portalPageA.getByLabel("Signer name", { exact: true }).fill("S059 Synthetic Signer");
    await portalPageA.getByRole("button", { name: "Sign contract", exact: true }).click();
    await portalPageA.getByText(/Signed on/, { exact: false }).waitFor({ timeout: 30_000 });
    const signedResponse = await portalContextA.request.get(`/api/customer-portal/contracts/${contractA.id}`);
    assert.equal(signedResponse.status(), 200, "Signed contract must still be readable");
    const signedContract = await signedResponse.json();
    const signed = signedContract.status === "signed";
    const signedAtPresent = Boolean(signedContract.signedAt);
    assert.ok(signed && signedAtPresent, "Contract must be signed with a recorded signedAt");
    report.signing = { signed, signedAtPresent };
    await screenshot(portalPageA, "portal-contract-signed-1440");
    passCase("D1", "contract signed with attribution recorded");
  } catch (error) {
    failCase("D1", error);
  }
  await writeReport();

  // ---- Phase D: negative security evidence. ----
  async function portalApiProbe(requestContext, method, suffix, expectedStatus, label) {
    const response = await requestContext.request.fetch(`/api/customer-portal/${suffix}`, { method });
    assert.equal(response.status(), expectedStatus, `${label} returned ${response.status()} (expected ${expectedStatus})`);
    return response;
  }

  // B5 replay: the same link again must land on the access-error page, and
  // the backend redeem must answer 410. The access GET only sets the pending
  // cookie and redirects to /confirm; redemption happens on the confirm
  // submit, so the replay must submit the form before access-error appears.
  try {
    const replayContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const replayPage = await replayContext.newPage();
    const replayAccessResponse = await replayPage.goto(new URL(`/customer-portal/access?token=${tokenA.token}`, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await replayPage.waitForURL("**/customer-portal/access/confirm", { timeout: 30_000 });
    await replayPage.getByRole("button", { name: "Continue to customer portal" }).click();
    await replayPage.waitForURL("**/customer-portal/access-error", { timeout: 30_000 });
    const state = await metrics(replayPage);
    assertAccessErrorPage({ ...state, status: replayAccessResponse?.status() ?? 0 });
    await screenshot(replayPage, "portal-replay-access-error-1440");
    countRateLimitedCall("redeem:replay");
    const replayApi = await staffPage.request.post(new URL("/api/proxy/customer-portal/redeem", baseUrl).toString(), {
      data: { token: tokenA.token },
    });
    assert.equal(replayApi.status(), expectedStatusForCase("B5"), `Replay redeem returned ${replayApi.status()} (expected 410)`);
    await replayContext.close();
    passCase("B5", "second redemption denied (confirm submit → browser access-error + API 410)");
  } catch (error) {
    failCase("B5", error);
  }

  // B7 revoked before redemption. The revoked token still reaches /confirm
  // (the access GET does not redeem); the confirm submit fails the redeem,
  // so access-error appears only after the form is submitted.
  try {
    await revokeToken(tokenRevoke.id, "revoke-before-redemption");
    const revokedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const revokedPage = await revokedContext.newPage();
    const revokedAccessResponse = await revokedPage.goto(new URL(`/customer-portal/access?token=${tokenRevoke.token}`, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await revokedPage.waitForURL("**/customer-portal/access/confirm", { timeout: 30_000 });
    await revokedPage.getByRole("button", { name: "Continue to customer portal" }).click();
    await revokedPage.waitForURL("**/customer-portal/access-error", { timeout: 30_000 });
    const state = await metrics(revokedPage);
    assertAccessErrorPage({ ...state, status: revokedAccessResponse?.status() ?? 0 });
    countRateLimitedCall("redeem:revoked");
    const revokedApi = await staffPage.request.post(new URL("/api/proxy/customer-portal/redeem", baseUrl).toString(), {
      data: { token: tokenRevoke.token },
    });
    assert.equal(revokedApi.status(), expectedStatusForCase("B7"), `Revoked redeem returned ${revokedApi.status()} (expected 410)`);
    await revokedContext.close();
    passCase("B7", "revoked link reaches confirmation, redemption denied (browser access-error + API 410)");
  } catch (error) {
    failCase("B7", error);
  }

  // B2 malformed link (browser) and B9 malformed redemption (API).
  try {
    const malformedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const malformedPage = await malformedContext.newPage();
    const malformedAccessResponse = await malformedPage.goto(new URL("/customer-portal/access?token=short", baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await malformedPage.waitForURL("**/customer-portal/access-error", { timeout: 30_000 });
    const state = await metrics(malformedPage);
    assertAccessErrorPage({ ...state, status: malformedAccessResponse?.status() ?? 0 });
    await malformedContext.close();
    passCase("B2", "malformed link lands on the access-error page");
  } catch (error) {
    failCase("B2", error);
  }
  try {
    countRateLimitedCall("redeem:malformed-short");
    const shortApi = await staffPage.request.post(new URL("/api/proxy/customer-portal/redeem", baseUrl).toString(), {
      data: { token: "short" },
    });
    assert.ok(
      expectedStatusForCase("B9").includes(shortApi.status()),
      `Malformed redeem returned ${shortApi.status()} (expected 400 or 401)`,
    );
    countRateLimitedCall("redeem:malformed-unknown");
    const unknownApi = await staffPage.request.post(new URL("/api/proxy/customer-portal/redeem", baseUrl).toString(), {
      data: { token: "x".repeat(43) },
    });
    assert.equal(unknownApi.status(), 410, `Unknown well-formed token redeem returned ${unknownApi.status()} (expected 410)`);
    passCase("B9", "malformed redemption denied (400/401); unknown token 410");
  } catch (error) {
    failCase("B9", error);
  }

  // B8 cross-origin redemption: the origin check runs before any token
  // validation, so the already-revoked token's pending cookie proves the
  // 403 without spending another issuance.
  try {
    const crossOriginContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const crossOriginPage = await crossOriginContext.newPage();
    await crossOriginPage.goto(new URL(`/customer-portal/access?token=${tokenRevoke.token}`, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await crossOriginPage.waitForURL("**/customer-portal/access/confirm", { timeout: 30_000 });
    countRateLimitedCall("redeem:cross-origin");
    const crossOriginApi = await crossOriginContext.request.post("/customer-portal/access/redeem", {
      headers: { origin: "https://evil.example" },
    });
    assert.equal(crossOriginApi.status(), expectedStatusForCase("B8"), `Cross-origin redeem returned ${crossOriginApi.status()} (expected 403)`);
    await crossOriginContext.close();
    passCase("B8", "cross-origin redemption rejected with 403");
  } catch (error) {
    failCase("B8", error);
  }

  // B's session: redeem once, then cross-customer (C4/C8), draft (C7),
  // cross-tenant (C5) probes, then revocation (E3) + GAP-1 proof.
  const portalContextB = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
  const portalPageB = await portalContextB.newPage();
  portalPageB.setDefaultTimeout(30_000);
  try {
    await portalPageB.goto(new URL(`/customer-portal/access?token=${tokenB.token}`, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await portalPageB.waitForURL("**/customer-portal/access/confirm", { timeout: 30_000 });
    countRateLimitedCall("redeem:B");
    await portalPageB.getByRole("button", { name: "Continue to customer portal", exact: true }).click();
    await portalPageB.waitForURL("**/customer-portal", { timeout: 30_000 });
    console.log("PASS B4 customer B redeemed");
  } catch (error) {
    failCase("B4-customer-B", error);
  }

  try {
    await portalApiProbe(portalContextB, "GET", `projects/${projectA.id}`, 404, "Cross-customer project read");
    await portalPageB.goto(new URL(`/customer-portal/projects/${projectA.id}`, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    const state = await metrics(portalPageB);
    assertAccessRequiredPage(state);
    passCase("C4", "customer B cannot read customer A's project (API 404 + access-required page)");
  } catch (error) {
    failCase("C4", error);
  }
  try {
    await portalApiProbe(portalContextB, "GET", `proposals/${proposalA.id}`, 404, "Foreign proposal read");
    await portalApiProbe(portalContextB, "GET", `proposals/${proposalA.id}/pdf`, 404, "Foreign proposal PDF read");
    await portalApiProbe(portalContextB, "GET", `invoices/${invoiceA.id}`, 404, "Foreign invoice read");
    await portalApiProbe(portalContextB, "GET", `invoices/${invoiceA.id}/pdf`, 404, "Foreign invoice PDF read");
    await portalApiProbe(portalContextB, "GET", `contracts/${contractA.id}`, 404, "Foreign contract read");
    await portalApiProbe(portalContextB, "GET", `contracts/${contractA.id}/pdf`, 404, "Foreign contract PDF read");
    passCase("C8", "customer B cannot read any of customer A's documents (all 404)");
  } catch (error) {
    failCase("C8", error);
  }
  try {
    await portalApiProbe(portalContextA, "GET", `proposals/${draftProposal.id}`, 404, "Draft proposal read");
    await portalApiProbe(portalContextA, "GET", `proposals/${draftProposal.id}/pdf`, 404, "Draft proposal PDF read");
    await portalApiProbe(portalContextA, "GET", `invoices/${draftInvoice.id}`, 404, "Draft invoice read");
    await portalApiProbe(portalContextA, "GET", `invoices/${draftInvoice.id}/pdf`, 404, "Draft invoice PDF read");
    passCase("C7", "draft proposal/invoice detail and PDF all 404 for the owning customer");
  } catch (error) {
    failCase("C7", error);
  }
  const foreignProjectId = process.env.BETA_FOREIGN_PROJECT_ID;
  if (foreignProjectId) {
    try {
      await portalApiProbe(portalContextA, "GET", `projects/${foreignProjectId}`, 404, "Cross-tenant project read");
      passCase("C5", "customer A cannot read the foreign tenant's project (404)");
    } catch (error) {
      failCase("C5", error);
    }
  } else {
    recordCase("C5", "NOT-APPLICABLE", "BETA_RC_FOREIGN_PROJECT_ID is not provisioned");
    console.log("NOT-APPLICABLE C5: no foreign project id provisioned");
  }

  // E3 revoked after redemption, then the GAP-1 proof: a detail page reloaded
  // after revocation must show the truthful access-required state.
  try {
    await revokeToken(tokenB.id, "revoke-after-redemption");
    await portalApiProbe(portalContextB, "GET", "projects", 401, "Revoked session read");
    await portalPageB.goto(new URL(`/customer-portal/projects/${projectB.id}`, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    const state = await metrics(portalPageB);
    assertAccessRequiredPage(state);
    await screenshot(portalPageB, "portal-revoked-access-required-1440");
    passCase("E3", "revoked session denied (API 401 + access-required page)");
    passCase("GAP-1", "detail page shows the access-required state after revocation");
  } catch (error) {
    failCase("E3", error);
    failCase("GAP-1", error);
  }

  // C12 unauthenticated (API + browser) and C13 wrong-principal.
  try {
    const anonContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const anonResponse = await anonContext.request.get("/api/customer-portal/projects");
    assert.equal(anonResponse.status(), 401, `Unauthenticated portal read returned ${anonResponse.status()} (expected 401)`);
    const anonPage = await anonContext.newPage();
    await anonPage.goto(new URL("/customer-portal", baseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
    const state = await metrics(anonPage);
    assertAccessRequiredPage(state);
    await anonContext.close();
    passCase("C12", "unauthenticated portal read denied (API 401 + access-required page)");
  } catch (error) {
    failCase("C12", error);
  }
  try {
    const staffPortalResponse = await staffPage.request.get(new URL("/api/customer-portal/projects", baseUrl).toString());
    assert.equal(staffPortalResponse.status(), 401, `Staff session on portal routes returned ${staffPortalResponse.status()} (expected 401)`);
    const portalOnStaffResponse = await portalContextA.request.get("/api/proxy/customers");
    assert.equal(portalOnStaffResponse.status(), 401, `Portal session on staff routes returned ${portalOnStaffResponse.status()} (expected 401)`);
    passCase("C13", "staff JWT is not a portal session and a portal session is not staff auth (both 401)");
  } catch (error) {
    failCase("C13", error);
  }

  // A2/A3/A5 issuance negatives.
  try {
    countRateLimitedCall("issue:no-email");
    const noEmailResponse = await staffPage.request.post(new URL("/api/proxy/customer-portal/access-tokens", baseUrl).toString(), {
      data: { customerId: customerNoEmail.id },
    });
    assert.equal(noEmailResponse.status(), 409, `Issue without email returned ${noEmailResponse.status()} (expected 409)`);
    passCase("A2", "issue for a customer without an email denied (409)");
  } catch (error) {
    failCase("A2", error);
  }
  try {
    countRateLimitedCall("issue:unknown-customer");
    const unknownResponse = await staffPage.request.post(new URL("/api/proxy/customer-portal/access-tokens", baseUrl).toString(), {
      data: { customerId: randomUUID() },
    });
    assert.equal(unknownResponse.status(), 404, `Issue for unknown customer returned ${unknownResponse.status()} (expected 404)`);
    passCase("A3", "issue for an unknown customer denied (404)");
  } catch (error) {
    failCase("A3", error);
  }
  try {
    const anonIssueContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    countRateLimitedCall("issue:unauthenticated");
    const anonIssue = await anonIssueContext.request.post("/api/proxy/customer-portal/access-tokens", {
      data: { customerId: customerA.id },
    });
    assert.equal(anonIssue.status(), 401, `Unauthenticated issue returned ${anonIssue.status()} (expected 401)`);
    await anonIssueContext.close();
    passCase("A5", "unauthenticated issue denied (401)");
  } catch (error) {
    failCase("A5", error);
  }

  // A4 wrong-role: only exercisable when a low-permission staff identity is
  // provisioned. The S052 admin is an admin and therefore holds
  // documents.manage, so a 201 from that identity proves the probe cannot
  // run here — it is recorded NOT-APPLICABLE, never invented.
  const wrongRoleEmail = process.env.BETA_S052_ADMIN_EMAIL;
  const wrongRolePassword = process.env.BETA_S052_ADMIN_PASSWORD;
  if (wrongRoleEmail && wrongRolePassword) {
    try {
      const wrongRoleContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
      const wrongRolePage = await wrongRoleContext.newPage();
      await wrongRolePage.addInitScript(() => {
        const noteIntroState = () => {
          const entry = document.querySelector(".entry-content");
          if (!entry) return;
          if (entry.hasAttribute("inert")) window.__tradeosLoginFilmSeen = true;
          else if (window.__tradeosLoginFilmSeen === true) window.__tradeosLoginFilmFinished = true;
        };
        new MutationObserver(noteIntroState).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert"] });
        noteIntroState();
      });
      await wrongRolePage.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
      await waitForLoginReady(wrongRolePage);
      await wrongRolePage.locator('[name="email"]').fill(wrongRoleEmail);
      await wrongRolePage.locator('[name="password"]').fill(wrongRolePassword);
      await wrongRolePage.getByRole("button", { name: "Sign in" }).click();
      await wrongRolePage.waitForURL(/\/(dashboard|finish-setup)(?:\?|$)/, { timeout: 60_000 });
      countRateLimitedCall("issue:wrong-role");
      const wrongRoleResponse = await wrongRolePage.request.post(new URL("/api/proxy/customer-portal/access-tokens", baseUrl).toString(), {
        data: { customerId: customerA.id },
      });
      if (wrongRoleResponse.status() === 403) {
        passCase("A4", "staff without documents.manage denied issue (403)");
      } else if (wrongRoleResponse.status() === 201) {
        const issued = await wrongRoleResponse.json();
        // Register the token BEFORE revoking it: if the revoke fails, Phase
        // E retries it from issuedTokens instead of leaking a live token.
        issuedTokens.push({ id: issued.id, customerId: customerA.id, token: issued.token });
        // The identity holds documents.manage after all; revoke the token
        // it just created and record the probe as not applicable.
        await revokeToken(issued.id, "wrong-role-cleanup");
        recordCase("A4", "NOT-APPLICABLE", "The provisioned S052 admin holds documents.manage (issue returned 201); no technician/viewer identity is provisioned");
        console.log("NOT-APPLICABLE A4: S052 admin holds documents.manage; token revoked");
      } else {
        throw new Error(`Wrong-role issue returned ${wrongRoleResponse.status()} (expected 403 or 201)`);
      }
      await wrongRoleContext.close();
    } catch (error) {
      failCase("A4", error);
    }
  } else {
    recordCase("A4", "NOT-APPLICABLE", "No low-permission staff identity is provisioned (BETA_RC_S052_ADMIN_* secrets absent); do not invent one");
    console.log("NOT-APPLICABLE A4: no low-permission staff identity provisioned");
  }

  // ---- Phase E: cleanup. Revoke every token this run created. ----
  // tokenB and tokenRevoke are already revoked (E3 / B7); revoking again is
  // a no-op at the service layer, but only revoke each id once here. The
  // loop lives in runCleanup (assigned after the staff page is created) so
  // a fatal failure mid-journey still revokes what was issued; the flag
  // inside it keeps the run exactly-once.
  await runCleanup();
  // The UI-issued token A has no id exposed to this script; it is revoked by
  // revoking its API twin is NOT possible (revocation is per-token). Record
  // the residual explicitly: token A's raw value is gone with this process,
  // its 7-day TTL bounds it, and the twin revocation does not revoke it.
  if (!tokenA.id) {
    report.cleanupNotes = [
      "Customer A's UI-issued token has no id exposed by the staff UI, so it cannot be revoked by id from this run. Its raw value existed only in process memory and is gone with this process; its 7-day TTL bounds it. Prefer the API issuance path when revocation-by-id is required.",
    ];
  }
  report.rateLimitedCalls = rateLimitedCalls;
  report.credentialScan = { performedBy: "workflow", result: "pending" };
  await staffContext.close();
  await portalContextA.close();
  await portalContextB.close();
} catch (error) {
  // A fatal failure (e.g. a navigation timeout on a magic-link URL) must not
  // skip the report: record it sanitized and let the report-writing code
  // below still run, so the artifact carries the failure instead of nothing.
  const detail = redactBearerMaterial(error.message);
  console.error(`FATAL: ${detail}`);
  recordCase("FATAL", "FAIL", detail);
  // Revoke what was issued before the failure; a fatal navigation must not
  // leave live tokens behind. runCleanup is a no-op when the staff page was
  // never created, and never throws past its own per-token handling — but
  // guard anyway so cleanup can never mask the FATAL record.
  try {
    await runCleanup();
  } catch (cleanupError) {
    console.error(`FATAL cleanup failed: ${redactBearerMaterial(cleanupError.message)}`);
  }
  report.rateLimitedCalls = rateLimitedCalls;
} finally {
  await browser.close();
}

const failedViewports = report.viewports.filter((entry) => !entry.passed);
const failedCases = report.cases.filter((entry) => entry.status === "FAIL");
report.result =
  failedViewports.length === 0 && failedCases.length === 0 && !report.cleanupFailures ? "PASS" : "FAIL";
report.blocked = EXPIRED_BROWSER_BLOCKED.map((entry) => ({ ...entry, status: "BLOCKED" }));
await writeReport();
console.log(`S059 browser evidence ${report.result}: ${report.viewports.length} viewports, ${report.cases.length} cases, ${report.blocked.length} blocked, ${rateLimitedCalls} rate-limited calls`);
if (report.result !== "PASS") process.exitCode = 1;
