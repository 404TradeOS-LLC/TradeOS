import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// S059 customer-portal evidence contract. Pure, dependency-free helpers so
// `node --test` can cover the acceptance rules without a browser, a network,
// or a deployment. The capture script
// (app/scripts/s059-browser-evidence.mjs) and the deployment-identity script
// (app/scripts/s059-deployment-identity.mjs) are the only runtime consumers.
//
// Bearer-material rule, stated once: no raw access token, portal session,
// cookie, header, or bearer value is ever written to disk, logs, or
// report.json. Tokens live only in process memory. These helpers never
// receive a token value.

// Canonical staging Supabase project ref. The TEST Org fixture
// (d86d0874-6ba3-4b06-94b6-bd0ae99fe532) exists only in TradeOS Staging, so a
// run with S059_USE_TEST_ORG=true must target this data plane; anything else
// fails closed before any mutation. Mirrors the staging constant in
// app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs.
export const STAGING_PROJECT_REF = "qfbgdkbamfaasmtjfyru";

// The portal pages the capture script reads, with the marker text that proves
// the page rendered real product state (not a loading shell or an error page).
// Project/invoice markers are dynamic (project name / invoice number) and are
// supplied by the capture script at run time.
export const PORTAL_PAGES = Object.freeze([
  Object.freeze({ slug: "portal-home", path: "/customer-portal", markers: ["Your projects"] }),
  Object.freeze({ slug: "portal-project", path: "/customer-portal/projects/:id", markers: [] }),
  Object.freeze({ slug: "portal-proposal", path: "/customer-portal/proposals/:id", markers: ["Proposal review"] }),
  Object.freeze({ slug: "portal-invoice", path: "/customer-portal/invoices/:id", markers: ["Invoice #"] }),
  Object.freeze({ slug: "portal-contract", path: "/customer-portal/contracts/:id", markers: ["Contract review"] }),
  Object.freeze({ slug: "portal-confirm", path: "/customer-portal/access/confirm", markers: ["Open your project documents"] }),
]);

// Negative security cases. `expectedStatus` is the HTTP status the capture
// script must observe (via the staff-proxy API probe where the browser path
// does not surface it); `expectedPage` is the browser outcome instead.
// `null` expectedStatus means the case is proven by the page, not a status.
export const NEGATIVE_CASES = Object.freeze([
  Object.freeze({ caseId: "A2", step: "Issue for a customer without an email address", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "A3", step: "Issue for an unknown customer", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "A4", step: "Issue by staff without documents.manage", expectedStatus: 403, expectedPage: null }),
  Object.freeze({ caseId: "A5", step: "Issue unauthenticated", expectedStatus: 401, expectedPage: null }),
  Object.freeze({ caseId: "B2", step: "Open a malformed link", expectedStatus: null, expectedPage: "access-error" }),
  Object.freeze({ caseId: "B5", step: "Replay an already-redeemed link", expectedStatus: 410, expectedPage: "access-error" }),
  Object.freeze({ caseId: "B7", step: "Redeem a token revoked before redemption", expectedStatus: 410, expectedPage: "access-error" }),
  Object.freeze({ caseId: "B8", step: "Cross-origin redemption POST", expectedStatus: 403, expectedPage: null }),
  Object.freeze({ caseId: "B9", step: "Redeem a malformed token", expectedStatus: [400, 401], expectedPage: null }),
  Object.freeze({ caseId: "C4", step: "Cross-customer project read", expectedStatus: 404, expectedPage: "access-required" }),
  Object.freeze({ caseId: "C5", step: "Cross-tenant project read", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "C7", step: "Draft proposal/invoice read", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "C8", step: "Foreign proposal/invoice/contract read", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "C12", step: "Unauthenticated portal read", expectedStatus: 401, expectedPage: "access-required" }),
  Object.freeze({ caseId: "C13", step: "Wrong-principal session use", expectedStatus: 401, expectedPage: null }),
  Object.freeze({ caseId: "E3", step: "Read with a session whose token was revoked", expectedStatus: 401, expectedPage: "access-required" }),
  Object.freeze({ caseId: "GAP-1", step: "Detail page after its session is revoked", expectedStatus: null, expectedPage: "access-required" }),
]);

export function expectedStatusForCase(caseId) {
  const found = NEGATIVE_CASES.find((entry) => entry.caseId === caseId);
  assert.ok(found, `Unknown negative case ${caseId}`);
  return found.expectedStatus;
}

// Expired-token / expired-session browser states cannot be produced against a
// hosted deployment: the only token-creation path is the issue endpoint,
// which always sets expiresAt = now + 7d, and there is no staging-DB write
// path for this runner. These cases are recorded BLOCKED in report.json and
// never fail the run. The substitute is live-PostgreSQL expiry evidence in
// app/tests/s059.portal.integration.ts. Owner of the missing infrastructure:
// Billy (staging-DB write access or a provisioned expired fixture).
export const EXPIRED_BROWSER_BLOCKED = Object.freeze([
  Object.freeze({
    caseId: "B6",
    step: "Redeem an expired access token",
    reason: "expired fixture requires staging-DB write access (owner: Billy)",
  }),
  Object.freeze({
    caseId: "E4",
    step: "Read with an expired portal session",
    reason: "expired fixture requires staging-DB write access (owner: Billy)",
  }),
]);

// Credential-scan patterns. These are the exact sources the workflow grep
// applies to the uploaded bundle (S027/Beta pattern plus the portal cookie
// names and session header). A hit fails the run and blocks upload. The
// HttpOnly session cookie itself is never written to the bundle, so its
// presence here only guards against a script bug that logs or persists it.
export const CREDENTIAL_SCAN_PATTERNS = Object.freeze([
  '"cookies"\\s*:',
  "sb-[a-z0-9-]+-auth-token",
  "tradeos_(access|refresh)_token",
  "Bearer [A-Za-z0-9._-]{20,}",
  "tradeos_customer_portal_pending_access",
  "tradeos_customer_portal_session",
  "x-tradeos-portal-session",
  // A raw portal token value in a URL query string. The capture script never
  // writes one, but the scan must catch it if a failure path ever does.
  "token=[A-Za-z0-9_-]{40,128}",
]);

export function matchesCredentialScan(text) {
  if (typeof text !== "string") return false;
  const combined = new RegExp(`(${CREDENTIAL_SCAN_PATTERNS.join("|")})`);
  return combined.test(text);
}

// Redact bearer material from error text before it is logged or recorded in
// report.json. Playwright navigation errors embed the full request URL, so a
// failed goto of a magic-link URL would otherwise leak the raw token into
// the workflow log and the retained artifact. Every error message the capture
// script records or prints must pass through here first.
export function redactBearerMaterial(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/([?&]token=)[^&\s"']+/g, "$1[REDACTED]")
    .replace(/(Bearer )[A-Za-z0-9._-]+/g, "$1[REDACTED]")
    .replace(/(tradeos_customer_portal_(?:pending_access|session)=)[^;\s"']+/g, "$1[REDACTED]")
    .replace(/(x-tradeos-portal-session[:=]\s*)[^\s"']+/g, "$1[REDACTED]");
}

// Same shape rule as the service (`assertPortalSecret` in
// app/modules/customer-portal/service.ts): 40-128 base64url characters. The
// capture script asserts this on an issued token before navigating with it,
// so a malformed issuance fails fast without the value ever being logged.
export function isValidPortalTokenShape(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{40,128}$/.test(token);
}

export function sha256Hex(value) {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return createHash("sha256").update(buffer).digest("hex");
}

function assertNoErrorShell(bodyText, context) {
  assert.doesNotMatch(
    bodyText,
    /couldn.t load|sign in required|application error|internal server error|this page could not be found/i,
    `${context} rendered an error shell`,
  );
}

function assertDimensions({ scrollWidth, clientWidth }, context) {
  assert.ok(
    Number.isFinite(clientWidth) && clientWidth > 0 && Number.isFinite(scrollWidth),
    `${context} rendered dimensions are required`,
  );
  assert.ok(scrollWidth <= clientWidth + 2, `${context} horizontal overflow: ${scrollWidth} > ${clientWidth}`);
}

/**
 * Truth check for a portal read page: right path, HTTP 200, non-empty body,
 * every expected marker present, no error shell, no horizontal overflow
 * beyond the 2px tolerance shared with the S027/Beta gates.
 */
export function assertPortalPage({ pathname, expectedPath, status, bodyText, scrollWidth, clientWidth, markers = [] }) {
  assert.equal(pathname, expectedPath, "Navigation must remain on the requested portal route");
  assert.equal(status, 200, "Portal route must return HTTP 200");
  const text = (bodyText ?? "").trim();
  assert.ok(text.length > 0, "Portal page rendered an empty body");
  assert.doesNotMatch(text, /portal access required/i, "Portal read rendered the access-required state instead of the document");
  for (const marker of markers) {
    assert.ok(text.includes(marker), `Portal page is missing expected content: ${marker}`);
  }
  assertNoErrorShell(text, "Portal page");
  assertDimensions({ scrollWidth, clientWidth }, "Portal page");
}

/** The access-error page is the only safe denial screenshot: it carries no bearer material. */
export function assertAccessErrorPage({ pathname, status, bodyText, scrollWidth, clientWidth }) {
  assert.equal(pathname, "/customer-portal/access-error", "Denied redemption must land on the access-error page");
  assert.ok([200, 303].includes(status), "Access-error page must load");
  const text = (bodyText ?? "").trim();
  assert.ok(text.includes("This link is no longer available"), "Access-error page must show the non-enumerating denial message");
  assertNoErrorShell(text, "Access-error page");
  assertDimensions({ scrollWidth, clientWidth }, "Access-error page");
}

/**
 * The truthful access-required state the portal home and detail pages render
 * when the session is absent, expired, or revoked. The detail pages keep
 * their own URL, so only the portal prefix is asserted, not an exact path.
 */
export function assertAccessRequiredPage({ pathname, bodyText, scrollWidth, clientWidth }) {
  assert.ok(
    typeof pathname === "string" && pathname.startsWith("/customer-portal"),
    "Access-required state must render on a portal route",
  );
  const text = (bodyText ?? "").trim();
  assert.ok(text.includes("Portal access required"), "Page must show the portal access-required state");
  assertNoErrorShell(text, "Access-required page");
  assertDimensions({ scrollWidth, clientWidth }, "Access-required page");
}

/** A retained PDF is proven by status + content-type + hash only; no PDF bytes are kept. */
export function assertPdfResponse({ status, contentType }) {
  assert.equal(status, 200, "Portal PDF must return HTTP 200");
  assert.ok(
    typeof contentType === "string" && contentType.toLowerCase().startsWith("application/pdf"),
    "Portal PDF must be served as application/pdf",
  );
}

/** Report shape. Bearer material never appears in any field of this object. */
export function createReportSkeleton({ baseUrl, runId, workflowSha, deployedSha, supabaseProjectRef, tenantLabel, orgId }) {
  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    runId,
    workflowSha: workflowSha ?? null,
    deployedSha: deployedSha ?? null,
    supabaseProjectRef: supabaseProjectRef ?? null,
    tenantLabel: tenantLabel ?? null,
    orgId: orgId ?? null,
    issuancePath: {},
    fixtures: {},
    viewports: [],
    cases: [],
    blocked: EXPIRED_BROWSER_BLOCKED.map((entry) => ({ ...entry, status: "BLOCKED" })),
    credentialScan: { performedBy: "workflow", result: "pending" },
    result: "PENDING",
  };
}
