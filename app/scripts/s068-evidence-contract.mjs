import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";

// S068 change-order browser-evidence contract. Pure, dependency-free
// helpers so `node --test` can cover the acceptance rules without a browser,
// a network, or a deployment. The capture script
// (app/scripts/s068-browser-evidence.mjs) is the only runtime consumer.
//
// Bearer-material rule, stated once: no raw staff session, cookie, header,
// or bearer value is ever written to disk, logs, or report.json. Session
// material lives only in process memory (the Playwright storage state file
// the workflow creates under /tmp and deletes after the run). These helpers
// never receive a session value.
//
// The journey the contract covers (see
// docs/testing/S068_CHANGE_ORDER_EVIDENCE.md): staff owner creates a draft
// change order on a project workspace, adds a priced line item, approves it,
// and the approval-history line plus the attributable
// `change_order.approved` activity record are verified; a second draft is
// rejected and its `change_order.rejected` record verified. Customer
// approve/reject does not exist (ADR-010) and is BLOCKED by design, not
// attempted — see S068_BLOCKED.

// Canonical staging Supabase project ref. The TEST Org fixture
// (d86d0874-6ba3-4b06-94b6-bd0ae99fe532) exists only in TradeOS Staging, so a
// run with S068_USE_TEST_ORG=true must target this data plane; anything else
// fails closed before any mutation. Mirrors the staging constant in
// app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs.
export const STAGING_PROJECT_REF = "qfbgdkbamfaasmtjfyru";

// The activity event types the approve/reject transitions must record. The
// backend lane of this same PR records these events (entityType
// `change_order`, eventType below) with the acting staff user as actor; the
// capture script fails closed (FAIL, never a pass) when the query returns no
// matching event. The script queries by `entityId` only (no `entityType`
// filter): `change_order` is not registered in `intelligenceEntityTypes`,
// so the `entityType=change_order` list filter currently answers 400 —
// registering it is a backend-lane follow-up, and certification of the
// event itself does not depend on it.
export const APPROVED_EVENT_TYPE = "change_order.approved";
export const REJECTED_EVENT_TYPE = "change_order.rejected";

// The change-order workspace states the capture script screenshots, with
// the marker text that proves the page rendered real product state (not a
// loading shell or an error page). The project id is dynamic and is supplied
// by the capture script at run time.
export const CHANGE_ORDER_PAGES = Object.freeze([
  Object.freeze({ slug: "change-order-draft", tab: "change-orders", markers: ["Change Orders", "Create change order", "No change orders yet"] }),
  Object.freeze({ slug: "change-order-approved", tab: "change-orders", markers: ["Change Orders", "Approved "] }),
  Object.freeze({ slug: "change-order-rejected", tab: "change-orders", markers: ["Change Orders", "Rejected "] }),
]);

// Negative security cases. `expectedStatus` is the HTTP status the capture
// script must observe via the staff-proxy API probe (or the anonymous
// browser context where noted); `expectedPage` is the browser outcome
// instead. `null` expectedStatus means the case is proven by the page, not
// a status. Every case runs against the sanitized tenant only.
export const NEGATIVE_CASES = Object.freeze([
  Object.freeze({ caseId: "N1", step: "Approve an already-approved change order", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N2", step: "Reject an already-approved change order", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N3", step: "Add a line item to an approved change order (draft-only guard)", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N4", step: "Create a change order as staff without billing.write", expectedStatus: 403, expectedPage: null }),
  Object.freeze({ caseId: "N5", step: "Read a change order from another organization", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "N6", step: "Read / approve a change order unauthenticated", expectedStatus: 401, expectedPage: null }),
  Object.freeze({ caseId: "N7", step: "Approve an unknown change order id", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "N8", step: "Create a change order for an unknown project", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "N9", step: "Customer-portal change-order decision POST is rejected (405 — the route exports only GET)", expectedStatus: 405, expectedPage: null }),
]);

// Roles that lack billing.write, per app/domain/contracts.ts
// rolePermissions: owner/admin/dispatcher/estimator hold it; technician
// and viewer do not. The N4 wrong-role probe verifies the provisioned
// identity's role against this list before mutating, so a 201 from a
// confirmed low-permission principal is a FAIL, not a silent
// NOT-APPLICABLE.
export const ROLES_WITHOUT_BILLING_WRITE = Object.freeze(["technician", "viewer"]);

export function expectedStatusForCase(caseId) {
  const found = NEGATIVE_CASES.find((entry) => entry.caseId === caseId);
  assert.ok(found, `Unknown negative case ${caseId}`);
  return found.expectedStatus;
}

// Steps that cannot be automated in this lane, recorded BLOCKED in
// report.json and never a pass or a failure. P1 is blocked by design, not
// by missing infrastructure: ADR-010 limits customer-originated writes to
// signing pending contracts, the portal project payload returns
// `changeOrders: []`, and no portal change-order decision endpoint exists.
// Building customer approve/reject would change authorization and needs a
// separately governed decision; it must NOT be built inside this
// certification scope.
export const S068_BLOCKED = Object.freeze([
  Object.freeze({
    caseId: "P1",
    step: "Customer approve/reject of a change order in the customer portal",
    reason:
      "Blocked by design (ADR-010): customer-originated writes are limited to signing pending contracts; the portal returns changeOrders: [] and exposes no change-order decision endpoint. Staff-side approval/rejection is the certified path.",
  }),
]);

// The wrong-role probe (N4) can only run when a low-permission staff
// identity is provisioned. When it is not, the capture script appends this
// entry to report.blocked and records N4 BLOCKED instead of inventing a
// principal. Owner of the missing provisioning: Billy.
export const WRONG_ROLE_BLOCKED = Object.freeze({
  caseId: "N4",
  step: "Create a change order as staff without billing.write",
  reason: "no low-permission staff identity is provisioned (owner: Billy); a second principal cannot be built without staging writes beyond the sanitized-tenant flag",
});

// Credential-scan patterns. These are the exact sources the workflow grep
// applies to the uploaded bundle. A hit fails the run and blocks upload.
// The staff session cookie itself is never written to the bundle, so its
// presence here only guards against a script bug that logs or persists it.
export const CREDENTIAL_SCAN_PATTERNS = Object.freeze([
  '"cookies"\\s*:',
  "sb-[a-z0-9-]+-auth-token",
  "tradeos_(access|refresh)_token",
  "Bearer [A-Za-z0-9._-]{20,}",
]);

export function matchesCredentialScan(text) {
  if (typeof text !== "string") return false;
  const combined = new RegExp(`(${CREDENTIAL_SCAN_PATTERNS.join("|")})`);
  return combined.test(text);
}

// Redact bearer material from error text before it is logged or recorded in
// report.json. Playwright navigation errors embed the full request URL, so a
// failed goto would otherwise leak session material into the workflow log
// and the retained artifact. Every error message the capture script records
// or prints must pass through here first.
export function redactBearerMaterial(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/(Bearer )[A-Za-z0-9._-]+/g, "$1[REDACTED]")
    .replace(/(tradeos_(?:access|refresh)_token=)[^;\s"']+/g, "$1[REDACTED]")
    .replace(/(sb-[a-z0-9-]+-auth-token[=:]\s*)[^\s"';]+/g, "$1[REDACTED]");
}

export function sha256Hex(value) {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return createHash("sha256").update(buffer).digest("hex");
}

// Round-half-up to cents, matching `round2` in
// app/modules/estimate-engine/formulas.ts. Pricing assertions compare
// rounded values only; unrounded intermediates never reach the report.
export function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Pricing fidelity for the single-line-item fixture: line cost must equal
 * quantity x unit cost (rounded to cents) and the change-order amount must
 * equal the line cost. The capture script verifies the same figures against
 * the live API response; this is the offline rule it enforces.
 */
export function assertPricing({ quantity, unitCost, lineCost, amount }) {
  assert.ok(Number.isFinite(quantity) && quantity > 0, "Line-item quantity must be a positive number");
  assert.ok(Number.isFinite(unitCost) && unitCost >= 0, "Line-item unit cost must be a non-negative number");
  assert.equal(round2(quantity * unitCost), lineCost, `Line cost must equal quantity x unit cost (${quantity} x ${unitCost} != ${lineCost})`);
  assert.equal(lineCost, amount, `Change-order amount must equal the line cost (${lineCost} != ${amount})`);
}

/**
 * Validate the capture script's environment before any browser, network, or
 * mutation. Returns the normalized run config. URL approval itself lives in
 * app/scripts/beta-evidence/lib/rc-target.mjs (assertApprovedRcUrl /
 * assertNonProductionDataPlane), which the capture script applies to the
 * returned baseUrl; this function covers presence, consent, and shape only.
 */
export function validateEvidenceEnv(env) {
  const baseUrl = env.S068_BASE_URL?.trim() ?? "";
  assert.ok(baseUrl.length > 0, "S068_BASE_URL is required");
  const expectedSha = env.S068_EXPECTED_SHA?.trim() ?? "";
  assert.match(expectedSha, /^[a-f0-9]{40}$/, "S068_EXPECTED_SHA must be a full 40-character commit SHA");
  assert.equal(env.S068_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
  assert.equal(env.S068_ALLOW_MUTATIONS, "true", "Smoke fixture mutation consent required");
  const storageState = env.S068_STORAGE_STATE_PATH?.trim() ?? "";
  assert.ok(storageState.length > 0, "S068_STORAGE_STATE_PATH is required");
  const supabaseRef = env.BETA_RC_SUPABASE_PROJECT_REF?.trim() ?? "";
  assert.ok(supabaseRef.length > 0, "BETA_RC_SUPABASE_PROJECT_REF is required");
  const useTestOrg = (env.S068_USE_TEST_ORG ?? "true") !== "false";
  if (useTestOrg) {
    assert.equal(
      supabaseRef,
      STAGING_PROJECT_REF,
      "The TEST Org fixture exists only in TradeOS Staging; use_test_org requires the staging data plane",
    );
  }
  const requireCorrelation = (env.S068_REQUIRE_SHA_CORRELATION ?? "true") !== "false";
  return {
    baseUrl,
    expectedSha,
    storageState,
    supabaseRef,
    useTestOrg,
    requireCorrelation,
    outDir: env.S068_EVIDENCE_DIR || "../artifacts/s068-browser-evidence",
    orgId: env.BETA_SMOKE_ORG_ID ?? null,
    tenantLabel: env.S068_SMOKE_TENANT_LABEL ?? null,
    foreignChangeOrderId: env.BETA_FOREIGN_CHANGE_ORDER_ID ?? null,
    wrongRoleEmail: env.BETA_S068_WRONG_ROLE_EMAIL ?? null,
    wrongRolePassword: env.BETA_S068_WRONG_ROLE_PASSWORD ?? null,
  };
}

/** The deployment-identity file the capture script must read before capture. */
export function deploymentIdentityPath(outDir) {
  return path.join(outDir, "deployment-identity.json");
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
 * Truth check for the staff project workspace change-orders tab: right
 * project, change-orders tab selected, HTTP 200, non-empty body, every
 * expected marker present, no error shell, no horizontal overflow beyond
 * the 2px tolerance shared with the S027/S059 gates.
 */
export function assertChangeOrdersTab({ pathname, search, projectId, status, bodyText, scrollWidth, clientWidth, markers = [] }) {
  assert.equal(pathname, `/projects/${projectId}`, "Navigation must remain on the requested project workspace");
  assert.ok(
    typeof search === "string" && new URLSearchParams(search).get("tab") === "change-orders",
    "The change-orders tab must be selected",
  );
  assert.equal(status, 200, "Project workspace must return HTTP 200");
  const text = (bodyText ?? "").trim();
  assert.ok(text.length > 0, "Change-orders tab rendered an empty body");
  for (const marker of markers) {
    assert.ok(text.includes(marker), `Change-orders tab is missing expected content: ${marker}`);
  }
  assertNoErrorShell(text, "Change-orders tab");
  assertDimensions({ scrollWidth, clientWidth }, "Change-orders tab");
}

/**
 * The approval-history line the workspace renders per change order
 * ("Approval history: Approved <date>" / "Rejected <date>"). The timestamp
 * itself is product-rendered with `formatDateTime` (en-US medium date +
 * short time, e.g. "Nov 24, 2026, 9:48 PM"); the assertion requires the
 * decision word followed by a timestamp, so a bare status badge — or a
 * decision word with no timestamp ("Approved missing") — cannot stand in
 * for the history line. The day-first 24-hour shape is accepted too; it
 * predates this change in the contract tests.
 */
const DECISION_TIMESTAMP_PATTERN =
  /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s*[AP]M|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4},\s+\d{1,2}:\d{2})/;

export function assertDecisionHistory({ bodyText, decision }) {
  assert.ok(decision === "approved" || decision === "rejected", "Decision must be approved or rejected");
  const text = (bodyText ?? "").trim();
  // Case-insensitive: the workspace renders InfoPairs labels with CSS
  // `uppercase`, so document.body.innerText reports "APPROVAL HISTORY"
  // while the source label is "Approval history". The decision word and
  // timestamp render in normal case and stay case-sensitive.
  assert.ok(text.toLowerCase().includes("approval history"), "Change order must render the Approval history line");
  const decisionWord = decision === "approved" ? "Approved" : "Rejected";
  assert.ok(
    new RegExp(`${decisionWord} ${DECISION_TIMESTAMP_PATTERN.source}`).test(text),
    `Approval history must record the ${decision} decision with a timestamp`,
  );
}

/**
 * Find the attributable activity record for a change-order decision in the
 * `GET /api/v1/intelligence/activity` response. The event must belong to
 * this change order, carry the expected event type, name a non-empty actor,
 * and carry an occurredAt timestamp. Only booleans derived from the match
 * are recorded in the report — never the actor id.
 */
export function assertActivityEvent({ events, eventType, changeOrderId }) {
  assert.ok(Array.isArray(events), "Activity response must be an array of events");
  const event = events.find((entry) => entry?.entityId === changeOrderId && entry?.eventType === eventType);
  assert.ok(event, `No ${eventType} activity record found for change order ${changeOrderId}`);
  assert.ok(typeof event.actorUserId === "string" && event.actorUserId.length > 0, "Activity record must attribute an actor");
  assert.ok(Number.isFinite(Date.parse(event.occurredAt)), "Activity record must carry an occurredAt timestamp");
  return event;
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
    stepPaths: {},
    fixtures: {},
    viewports: [],
    cases: [],
    blocked: S068_BLOCKED.map((entry) => ({ ...entry, status: "BLOCKED" })),
    credentialScan: { performedBy: "workflow", result: "pending" },
    result: "PENDING",
  };
}
