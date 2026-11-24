import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";

// S069 closeout and warranty workspace browser-evidence contract. Pure,
// dependency-free helpers so `node --test` can cover the acceptance rules
// without a browser, a network, or a deployment. The capture script
// (app/scripts/s069-browser-evidence.mjs) is the only runtime consumer.
//
// Bearer-material rule, stated once: no raw staff session, cookie, header,
// bearer value, or customer-portal access token is ever written to disk,
// logs, or report.json. Session material lives only in process memory
// (the Playwright storage state file the workflow creates under /tmp and
// deletes after the run, and the single-use portal token the script holds
// in a local variable until it is redeemed). These helpers never receive
// a session value.
//
// The journey the contract covers (see
// docs/testing/S069_CLOSEOUT_WARRANTY_EVIDENCE.md): staff owner builds
// the ready-checklist prerequisites in the TEST Org (accepted proposal,
// signed contract, sent invoice, completed job), creates the closeout,
// adds a punch item assigned to the field technician, the technician
// resolves it, staff verifies it, staff records a warranty quoting the
// signed contract, marks the closeout ready, hands it off, and the
// customer portal shows the same handoff read-only with the rendered
// closeout document. No closeout operation mutates the Contract
// snapshot, the Invoice amount/status, or the Proposal status — the
// snapshot-stability proof lives in app/tests/s069.closeout.integration.ts,
// not in the browser run.

// Canonical staging Supabase project ref. The TEST Org fixture
// (d86d0874-6ba3-4b06-94b6-bd0ae99fe532) exists only in TradeOS Staging, so a
// run with S069_USE_TEST_ORG=true must target this data plane; anything else
// fails closed before any mutation. Mirrors the staging constant in
// app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs.
export const STAGING_PROJECT_REF = "qfbgdkbamfaasmtjfyru";

// The activity event types the closeout transitions must record. The
// backend lane of this same PR records these events (entityType
// `punch_item` / `project_closeout` / `warranty_record`, eventType below)
// with the acting staff user as actor; the capture script fails closed
// (FAIL, never a pass) when the query returns no matching event. The
// script queries by `entityId` only (no `entityType` filter): the query
// without entityType requires crm.read, which the staff owner holds.
export const PUNCH_CREATED_EVENT_TYPE = "punch_item.created";
export const PUNCH_RESOLVED_EVENT_TYPE = "punch_item.resolved";
export const PUNCH_VERIFIED_EVENT_TYPE = "punch_item.verified";
export const CLOSEOUT_CREATED_EVENT_TYPE = "project_closeout.created";
export const CLOSEOUT_READY_EVENT_TYPE = "project_closeout.ready";
export const CLOSEOUT_HANDED_OFF_EVENT_TYPE = "project_closeout.handed_off";
export const WARRANTY_CREATED_EVENT_TYPE = "warranty_record.created";

// The closeout workspace states the capture script screenshots, with the
// marker text that proves the page rendered real product state (not a
// loading shell or an error page). The project id is dynamic and is supplied
// by the capture script at run time.
export const CLOSEOUT_PAGES = Object.freeze([
  Object.freeze({ slug: "closeout-draft", tab: "closeout", markers: ["Closeout and warranty", "Closeout status", "Draft — work through the checklist"] }),
  Object.freeze({ slug: "closeout-ready", tab: "closeout", markers: ["Closeout and warranty", "Closeout status", "Ready for handoff"] }),
  Object.freeze({ slug: "closeout-handed-off", tab: "closeout", markers: ["Closeout and warranty", "Closeout status", "Handed off"] }),
  Object.freeze({ slug: "portal-handoff", tab: null, markers: ["Closeout handoff", "Closeout status", "Handed off", "View closeout document"] }),
]);

// Negative security cases. `expectedStatus` is the HTTP status the capture
// script must observe via the staff-proxy API probe (or the anonymous
// browser context where noted); `expectedPage` is the browser outcome
// instead. `null` expectedStatus means the case is proven by the page, not
// a status. Every case runs against the sanitized tenant only.
export const NEGATIVE_CASES = Object.freeze([
  Object.freeze({ caseId: "N1", step: "Mark ready on a handed-off closeout", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N2", step: "Hand off a draft closeout", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N3", step: "Verify an open punch item", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N4", step: "Resolve a verified punch item", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N5", step: "Create a second closeout for the same project", expectedStatus: 409, expectedPage: null }),
  Object.freeze({ caseId: "N6", step: "Create a punch item as staff without crm.write", expectedStatus: 403, expectedPage: null }),
  Object.freeze({ caseId: "N7", step: "Read a closeout from another organization", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "N8", step: "Read / create a closeout unauthenticated", expectedStatus: 401, expectedPage: null }),
  Object.freeze({ caseId: "N9", step: "Resolve an unknown punch item id", expectedStatus: 404, expectedPage: null }),
  Object.freeze({ caseId: "N10", step: "Customer-portal closeout document POST is rejected (405 — the portal proxy route exports only GET)", expectedStatus: 405, expectedPage: null }),
]);

// Roles that lack crm.write, per app/domain/contracts.ts
// rolePermissions: owner/admin/dispatcher/estimator hold it; technician
// and viewer do not. The N6 wrong-role probe verifies the provisioned
// identity's role against this list before mutating, so a 201 from a
// confirmed low-permission principal is a FAIL, not a silent
// NOT-APPLICABLE.
export const ROLES_WITHOUT_CRM_WRITE = Object.freeze(["technician", "viewer"]);

export function expectedStatusForCase(caseId) {
  const found = NEGATIVE_CASES.find((entry) => entry.caseId === caseId);
  assert.ok(found, `Unknown negative case ${caseId}`);
  return found.expectedStatus;
}

// Steps that cannot be automated in this lane, recorded BLOCKED in
// report.json and never a pass or a failure. P1 is blocked by missing
// provisioning, not by design: the assigned-technician punch resolve is
// the one field-staff write in this workspace, and it can only be driven
// through a technician session when a technician sign-in is provisioned.
// When it is not, the owner (manager) resolve is the certified path and
// the technician-session resolve stays BLOCKED.
export const S069_BLOCKED = Object.freeze([
  Object.freeze({
    caseId: "P1",
    step: "Assigned-technician punch resolve through a technician browser session",
    reason:
      "Blocked when no technician sign-in is provisioned (owner: Billy): the punch resolve is certified through the manager path instead, and the technician carve-out itself is proven at the database boundary in app/tests/rls.integration.ts. A technician login cannot be built without staging writes beyond the sanitized-tenant flag.",
  }),
]);

// The wrong-role probe (N6) can only run when a low-permission staff
// identity is provisioned. When it is not, the capture script appends this
// entry to report.blocked and records N6 BLOCKED instead of inventing a
// principal. Owner of the missing provisioning: Billy.
export const WRONG_ROLE_BLOCKED = Object.freeze({
  caseId: "N6",
  step: "Create a punch item as staff without crm.write",
  reason: "no low-permission staff identity is provisioned (owner: Billy); a second principal cannot be built without staging writes beyond the sanitized-tenant flag",
});

// The job-completion prerequisite: a closeout starts only at field
// completion, and dispatch requires an active technician assignment, so
// the journey cannot start when the TEST Org has no active technician
// member. This is a dispatch prerequisite failure (the run fails closed
// with the reason), not a BLOCKED case: without a completed job there is
// no closeout journey to certify.
export const TECHNICIAN_MEMBER_REQUIRED = Object.freeze({
  step: "Complete a job in the TEST Org (closeout prerequisite)",
  reason:
    "no active technician member exists in the TEST Org (owner: Billy); dispatch requires an active technician assignment, so no job can reach completed and no closeout can start. Provision a technician member in the TEST Org and re-dispatch.",
});

// Credential-scan patterns. These are the exact sources the workflow grep
// applies to the uploaded bundle. A hit fails the run and blocks upload.
// The staff session cookie itself is never written to the bundle, so its
// presence here only guards against a script bug that logs or persists it.
// The single-use portal access token is bearer material too: it lives only
// in process memory and is consumed by redemption, never in report.json.
export const CREDENTIAL_SCAN_PATTERNS = Object.freeze([
  '"cookies"\\s*:',
  "sb-[a-z0-9-]+-auth-token",
  "tradeos_(access|refresh)_token",
  "tradeos_customer_portal_session",
  "tradeos_customer_portal_pending_access",
  "Bearer [A-Za-z0-9._-]{20,}",
]);

export function matchesCredentialScan(text) {
  if (typeof text !== "string") return false;
  const combined = new RegExp(`(${CREDENTIAL_SCAN_PATTERNS.join("|")})`);
  return combined.test(text);
}

// Redact bearer material from error text before it is logged or recorded in
// report.json. Playwright navigation errors embed the full request URL, so
// a failed goto would otherwise leak session material — including the
// single-use portal access token carried in the /customer-portal/access
// URL — into the workflow log and the retained artifact. Every error
// message the capture script records or prints must pass through here
// first.
export function redactBearerMaterial(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/(Bearer )[A-Za-z0-9._-]+/g, "$1[REDACTED]")
    .replace(/(tradeos_(?:access|refresh)_token=)[^;\s"']+/g, "$1[REDACTED]")
    .replace(/(sb-[a-z0-9-]+-auth-token[=:]\s*)[^\s"';]+/g, "$1[REDACTED]")
    .replace(/([?&]token=)[^&\s"']+/g, "$1[REDACTED]")
    .replace(/(tradeos_customer_portal_(?:session|pending_access)[=:]\s*)[^\s"';]+/g, "$1[REDACTED]");
}

export function sha256Hex(value) {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validate the capture script's environment before any browser, network, or
 * mutation. Returns the normalized run config. URL approval itself lives in
 * app/scripts/beta-evidence/lib/rc-target.mjs (assertApprovedRcUrl /
 * assertNonProductionDataPlane), which the capture script applies to the
 * returned baseUrl; this function covers presence, consent, and shape only.
 */
export function validateEvidenceEnv(env) {
  const baseUrl = env.S069_BASE_URL?.trim() ?? "";
  assert.ok(baseUrl.length > 0, "S069_BASE_URL is required");
  const expectedSha = env.S069_EXPECTED_SHA?.trim() ?? "";
  assert.match(expectedSha, /^[a-f0-9]{40}$/, "S069_EXPECTED_SHA must be a full 40-character commit SHA");
  assert.equal(env.S069_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
  assert.equal(env.S069_ALLOW_MUTATIONS, "true", "Smoke fixture mutation consent required");
  const storageState = env.S069_STORAGE_STATE_PATH?.trim() ?? "";
  assert.ok(storageState.length > 0, "S069_STORAGE_STATE_PATH is required");
  const supabaseRef = env.BETA_RC_SUPABASE_PROJECT_REF?.trim() ?? "";
  assert.ok(supabaseRef.length > 0, "BETA_RC_SUPABASE_PROJECT_REF is required");
  const useTestOrg = (env.S069_USE_TEST_ORG ?? "true") !== "false";
  if (useTestOrg) {
    assert.equal(
      supabaseRef,
      STAGING_PROJECT_REF,
      "The TEST Org fixture exists only in TradeOS Staging; use_test_org requires the staging data plane",
    );
  }
  const requireCorrelation = (env.S069_REQUIRE_SHA_CORRELATION ?? "true") !== "false";
  return {
    baseUrl,
    expectedSha,
    storageState,
    supabaseRef,
    useTestOrg,
    requireCorrelation,
    outDir: env.S069_EVIDENCE_DIR || "../artifacts/s069-browser-evidence",
    orgId: env.BETA_SMOKE_ORG_ID ?? null,
    tenantLabel: env.S069_SMOKE_TENANT_LABEL ?? null,
    foreignProjectId: env.BETA_FOREIGN_PROJECT_ID ?? null,
    wrongRoleEmail: env.BETA_S069_WRONG_ROLE_EMAIL ?? null,
    wrongRolePassword: env.BETA_S069_WRONG_ROLE_PASSWORD ?? null,
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
 * Truth check for the staff project workspace closeout tab: right project,
 * closeout tab selected, HTTP 200, non-empty body, every expected marker
 * present, no error shell, no horizontal overflow beyond the 2px tolerance
 * shared with the S027/S059 gates.
 */
export function assertCloseoutTab({ pathname, search, projectId, status, bodyText, scrollWidth, clientWidth, markers = [] }) {
  assert.equal(pathname, `/projects/${projectId}`, "Navigation must remain on the requested project workspace");
  assert.ok(
    typeof search === "string" && new URLSearchParams(search).get("tab") === "closeout",
    "The closeout tab must be selected",
  );
  assert.equal(status, 200, "Project workspace must return HTTP 200");
  const text = (bodyText ?? "").trim();
  assert.ok(text.length > 0, "Closeout tab rendered an empty body");
  for (const marker of markers) {
    assert.ok(text.includes(marker), `Closeout tab is missing expected content: ${marker}`);
  }
  assertNoErrorShell(text, "Closeout tab");
  assertDimensions({ scrollWidth, clientWidth }, "Closeout tab");
}

/**
 * The closeout status line the workspace renders in the "Closeout status"
 * card ("Draft — work through the checklist and punch list below." /
 * "Ready for handoff …" / "Handed off …"). The timestamp itself is
 * product-rendered; the assertion is that the status word is present, so
 * a bare status badge cannot stand in for the status line.
 */
export function assertCloseoutStatus({ bodyText, status }) {
  assert.ok(status === "draft" || status === "ready" || status === "handed_off", "Status must be draft, ready, or handed_off");
  const text = (bodyText ?? "").trim();
  assert.ok(text.includes("Closeout status"), "Closeout workspace must render the Closeout status card");
  const expected =
    status === "draft"
      ? "Draft — work through the checklist"
      : status === "ready"
        ? "Ready for handoff"
        : "Handed off";
  assert.ok(text.includes(expected), `Closeout status line must record the ${status} state`);
}

/**
 * The readiness checklist the workspace renders: the artifact checklist
 * plus the completed-job / open-punch / ready verdict lines. The backend
 * computes the verdict; the browser proof is that the rendered verdict
 * matches the journey state. "Ready to hand off" is the verdict label,
 * so a ready checklist must also show no "Not ready yet" box.
 */
export function assertChecklist({ bodyText, ready }) {
  const text = (bodyText ?? "").trim();
  assert.ok(text.includes("Artifact checklist"), "Closeout workspace must render the Artifact checklist");
  assert.ok(text.includes("Completed job"), "Checklist must show the completed-job line");
  assert.ok(text.includes("Open punch items"), "Checklist must show the open-punch-items line");
  if (ready) {
    assert.ok(text.includes("Ready to hand off"), "Checklist must show the ready verdict");
    assert.doesNotMatch(text, /Not ready yet/, "A ready checklist must not show the not-ready box");
  } else {
    assert.ok(text.includes("Not ready yet"), "Checklist must show the not-ready box");
  }
}

/**
 * Truth check for the customer-portal project page handoff section: right
 * project, HTTP 200, the read-only handoff section with the handed-off
 * status, the punch summary, and the document link — and no staff control
 * (no Mark ready / Record handoff / Add punch item button). The portal
 * page is read-only by design.
 */
export function assertPortalHandoff({ pathname, projectId, status, bodyText, scrollWidth, clientWidth, markers = [] }) {
  assert.equal(pathname, `/customer-portal/projects/${projectId}`, "Navigation must remain on the requested portal project page");
  assert.equal(status, 200, "Portal project page must return HTTP 200");
  const text = (bodyText ?? "").trim();
  assert.ok(text.length > 0, "Portal handoff rendered an empty body");
  for (const marker of markers) {
    assert.ok(text.includes(marker), `Portal handoff is missing expected content: ${marker}`);
  }
  assert.ok(text.includes("Read-only"), "Portal handoff must state it is read-only");
  assert.doesNotMatch(text, /Mark ready|Record handoff|Add punch item|Record warranty/, "Portal handoff must expose no staff closeout control");
  assertNoErrorShell(text, "Portal handoff");
  assertDimensions({ scrollWidth, clientWidth }, "Portal handoff");
}

/**
 * The rendered closeout document served as text/html: right content type,
 * non-empty body, and the project name plus the closeout frame heading,
 * so a blank or wrong-document response cannot stand in for the packet.
 */
export function assertCloseoutDocument({ contentType, bodyText, projectName }) {
  assert.ok(
    typeof contentType === "string" && contentType.includes("text/html"),
    `Closeout document must be served as text/html (got ${contentType})`,
  );
  const text = (bodyText ?? "").trim();
  assert.ok(text.length > 0, "Closeout document rendered an empty body");
  assert.ok(text.includes(projectName), "Closeout document must name the project");
  assert.ok(/Closeout/i.test(text), "Closeout document must carry the closeout frame");
}

/**
 * Find the attributable activity record for a closeout transition in the
 * `GET /api/v1/intelligence/activity` response. The event must belong to
 * this entity, carry the expected event type, name a non-empty actor,
 * and carry an occurredAt timestamp. Only booleans derived from the match
 * are recorded in the report — never the actor id.
 */
export function assertActivityEvent({ events, eventType, entityId }) {
  assert.ok(Array.isArray(events), "Activity response must be an array of events");
  const event = events.find((entry) => entry?.entityId === entityId && entry?.eventType === eventType);
  assert.ok(event, `No ${eventType} activity record found for entity ${entityId}`);
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
    blocked: S069_BLOCKED.map((entry) => ({ ...entry, status: "BLOCKED" })),
    credentialScan: { performedBy: "workflow", result: "pending" },
    result: "PENDING",
  };
}
