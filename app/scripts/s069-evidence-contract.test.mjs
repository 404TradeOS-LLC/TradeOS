import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  CLOSEOUT_CREATED_EVENT_TYPE,
  CLOSEOUT_HANDED_OFF_EVENT_TYPE,
  CLOSEOUT_PAGES,
  CLOSEOUT_READY_EVENT_TYPE,
  CREDENTIAL_SCAN_PATTERNS,
  NEGATIVE_CASES,
  PUNCH_CREATED_EVENT_TYPE,
  PUNCH_RESOLVED_EVENT_TYPE,
  PUNCH_VERIFIED_EVENT_TYPE,
  ROLES_WITHOUT_CRM_WRITE,
  S069_BLOCKED,
  STAGING_PROJECT_REF,
  TECHNICIAN_MEMBER_REQUIRED,
  WARRANTY_CREATED_EVENT_TYPE,
  WRONG_ROLE_BLOCKED,
  assertActivityEvent,
  assertChecklist,
  assertCloseoutDocument,
  assertCloseoutStatus,
  assertCloseoutTab,
  assertPortalHandoff,
  createReportSkeleton,
  deploymentIdentityPath,
  expectedStatusForCase,
  matchesCredentialScan,
  redactBearerMaterial,
  sha256Hex,
  unblockCase,
  validateEvidenceEnv,
} from "./s069-evidence-contract.mjs";
import { VIEWPORTS } from "./beta-evidence/lib/evidence-artifacts.mjs";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";

const projectId = "11111111-2222-4333-8444-555555555555";
const validTab = {
  pathname: `/projects/${projectId}`,
  search: "?tab=closeout",
  projectId,
  status: 200,
  bodyText: "Closeout and warranty Closeout status Draft — work through the checklist and punch list below. Artifact checklist Completed job Open punch items Ready to hand off Punch list Warranties",
  scrollWidth: 1440,
  clientWidth: 1440,
  markers: ["Closeout and warranty", "Closeout status"],
};

test("accepts a truthful closeout tab and requires all four captured states", () => {
  assert.doesNotThrow(() => assertCloseoutTab(validTab));
  assert.equal(CLOSEOUT_PAGES.length, 4);
  assert.deepEqual(
    CLOSEOUT_PAGES.map((page) => page.slug),
    ["closeout-draft", "closeout-ready", "closeout-handed-off", "portal-handoff"],
  );
  assert.ok(CLOSEOUT_PAGES.slice(0, 3).every((page) => page.tab === "closeout"));
  assert.equal(CLOSEOUT_PAGES[3].tab, null);
});

test("rejects wrong project, wrong tab, error shells, missing markers, and overflow", () => {
  assert.throws(() => assertCloseoutTab({ ...validTab, pathname: "/projects/other-id" }));
  assert.throws(() => assertCloseoutTab({ ...validTab, search: "?tab=change-orders" }));
  assert.throws(() => assertCloseoutTab({ ...validTab, search: "" }));
  assert.throws(() => assertCloseoutTab({ ...validTab, bodyText: "Closeout and warranty" }));
  assert.throws(() => assertCloseoutTab({ ...validTab, markers: ["Missing marker"] }));
  for (const bodyText of [
    "Couldn't load project",
    "Sign in required",
    "Application error",
    "Internal server error",
    "This page could not be found",
    "",
  ]) {
    assert.throws(() => assertCloseoutTab({ ...validTab, bodyText }));
  }
  assert.throws(() => assertCloseoutTab({ ...validTab, status: 500 }));
  assert.throws(() => assertCloseoutTab({ ...validTab, scrollWidth: 1500 }));
  assert.throws(() => assertCloseoutTab({ ...validTab, clientWidth: undefined }));
});

test("accepts the closeout status line only for the matching state", () => {
  assert.doesNotThrow(() =>
    assertCloseoutStatus({ bodyText: "Closeout status Draft — work through the checklist and punch list below.", status: "draft" }),
  );
  assert.doesNotThrow(() =>
    assertCloseoutStatus({ bodyText: "Closeout status Ready for handoff since 24 Nov 2026.", status: "ready" }),
  );
  assert.doesNotThrow(() =>
    assertCloseoutStatus({ bodyText: "Closeout status Handed off 24 Nov 2026.", status: "handed_off" }),
  );
  assert.throws(() =>
    assertCloseoutStatus({ bodyText: "Closeout status Ready for handoff since 24 Nov 2026.", status: "draft" }),
  );
  assert.throws(() =>
    assertCloseoutStatus({ bodyText: "Ready for handoff since 24 Nov 2026.", status: "ready" }),
  );
  assert.throws(() => assertCloseoutStatus({ bodyText: "Closeout status Draft", status: "handed_off" }));
  assert.throws(() => assertCloseoutStatus({ bodyText: "Closeout status Draft", status: "archived" }));
});

test("checklist verdict distinguishes ready from not-ready", () => {
  const readyText = "Artifact checklist Completed job Open punch items Ready to hand off";
  const notReadyText = "Artifact checklist Completed job Open punch items Not ready yet — still missing: open punch items (1)";
  assert.doesNotThrow(() => assertChecklist({ bodyText: readyText, ready: true }));
  assert.doesNotThrow(() => assertChecklist({ bodyText: notReadyText, ready: false }));
  assert.throws(() => assertChecklist({ bodyText: readyText, ready: false }));
  assert.throws(() => assertChecklist({ bodyText: notReadyText, ready: true }));
  assert.throws(() => assertChecklist({ bodyText: "Completed job Open punch items", ready: true }));
});

test("portal handoff requires the read-only section and refuses staff controls", () => {
  const validPortal = {
    pathname: `/customer-portal/projects/${projectId}`,
    projectId,
    status: 200,
    bodyText: "Closeout handoff Read-only — the same closeout truth your contractor sees. Closeout status Handed off Punch items: 1 resolved · 0 open View closeout document",
    scrollWidth: 1440,
    clientWidth: 1440,
    markers: ["Closeout handoff", "Closeout status", "Handed off", "View closeout document"],
  };
  assert.doesNotThrow(() => assertPortalHandoff(validPortal));
  assert.throws(() => assertPortalHandoff({ ...validPortal, pathname: `/customer-portal/projects/other-id` }));
  assert.throws(() => assertPortalHandoff({ ...validPortal, bodyText: "Closeout handoff Closeout status Handed off" }));
  assert.throws(() => assertPortalHandoff({ ...validPortal, bodyText: `${validPortal.bodyText} Mark ready` }));
  assert.throws(() => assertPortalHandoff({ ...validPortal, bodyText: `${validPortal.bodyText} Record handoff` }));
  assert.throws(() => assertPortalHandoff({ ...validPortal, bodyText: `${validPortal.bodyText} Add punch item` }));
  assert.throws(() => assertPortalHandoff({ ...validPortal, status: 401 }));
  assert.throws(() => assertPortalHandoff({ ...validPortal, scrollWidth: 1500 }));
});

test("closeout document requires text/html, a project name, and the frame", () => {
  assert.doesNotThrow(() =>
    assertCloseoutDocument({ contentType: "text/html; charset=utf-8", bodyText: "<html>Closeout S069 Project A</html>", projectName: "S069 Project A" }),
  );
  assert.throws(() =>
    assertCloseoutDocument({ contentType: "application/pdf", bodyText: "<html>Closeout S069 Project A</html>", projectName: "S069 Project A" }),
  );
  assert.throws(() =>
    assertCloseoutDocument({ contentType: "text/html", bodyText: "<html>Closeout</html>", projectName: "S069 Project A" }),
  );
  assert.throws(() =>
    assertCloseoutDocument({ contentType: "text/html", bodyText: "<html>S069 Project A</html>", projectName: "S069 Project A" }),
  );
  assert.throws(() =>
    assertCloseoutDocument({ contentType: "text/html", bodyText: "", projectName: "S069 Project A" }),
  );
});

test("finds the attributable activity record and rejects unattributed or missing events", () => {
  const events = [
    { entityId: "other-id", entityType: "punch_item", eventType: PUNCH_RESOLVED_EVENT_TYPE, actorUserId: "user-1", occurredAt: "2026-11-24T10:00:00.000Z" },
    { entityId: projectId, entityType: "punch_item", eventType: PUNCH_RESOLVED_EVENT_TYPE, actorUserId: "user-2", occurredAt: "2026-11-24T10:01:00.000Z" },
    { entityId: projectId, entityType: "project_closeout", eventType: CLOSEOUT_READY_EVENT_TYPE, actorUserId: "user-2", occurredAt: "2026-11-24T10:02:00.000Z" },
  ];
  const found = assertActivityEvent({ events, eventType: PUNCH_RESOLVED_EVENT_TYPE, entityId: projectId });
  assert.equal(found.actorUserId, "user-2");
  assert.equal(
    assertActivityEvent({ events, eventType: CLOSEOUT_READY_EVENT_TYPE, entityId: projectId }).eventType,
    CLOSEOUT_READY_EVENT_TYPE,
  );
  assert.throws(() =>
    assertActivityEvent({ events, eventType: PUNCH_VERIFIED_EVENT_TYPE, entityId: projectId }),
  );
  assert.throws(() =>
    assertActivityEvent({
      events: [{ ...events[1], actorUserId: "" }],
      eventType: PUNCH_RESOLVED_EVENT_TYPE,
      entityId: projectId,
    }),
  );
  assert.throws(() =>
    assertActivityEvent({
      events: [{ ...events[1], occurredAt: "not-a-date" }],
      eventType: PUNCH_RESOLVED_EVENT_TYPE,
      entityId: projectId,
    }),
  );
  assert.throws(() => assertActivityEvent({ events: null, eventType: PUNCH_RESOLVED_EVENT_TYPE, entityId: projectId }));
  assert.equal(PUNCH_CREATED_EVENT_TYPE, "punch_item.created");
  assert.equal(CLOSEOUT_CREATED_EVENT_TYPE, "project_closeout.created");
  assert.equal(CLOSEOUT_HANDED_OFF_EVENT_TYPE, "project_closeout.handed_off");
  assert.equal(WARRANTY_CREATED_EVENT_TYPE, "warranty_record.created");
});

test("covers every required negative case exactly once", () => {
  const ids = NEGATIVE_CASES.map((entry) => entry.caseId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10"]) {
    assert.ok(ids.includes(id), `negative case ${id} is missing`);
  }
  assert.equal(expectedStatusForCase("N1"), 409);
  assert.equal(expectedStatusForCase("N2"), 409);
  assert.equal(expectedStatusForCase("N3"), 409);
  assert.equal(expectedStatusForCase("N4"), 409);
  assert.equal(expectedStatusForCase("N5"), 409);
  assert.equal(expectedStatusForCase("N6"), 403);
  assert.equal(expectedStatusForCase("N7"), 404);
  assert.equal(expectedStatusForCase("N8"), 401);
  assert.equal(expectedStatusForCase("N9"), 404);
  // N10 is a 405, not a 404: the portal proxy route exports only GET, so
  // Next.js rejects the document POST before any handler runs.
  assert.equal(expectedStatusForCase("N10"), 405);
  assert.throws(() => expectedStatusForCase("N11"), /Unknown negative case/);
});

test("roles without crm.write match the domain rolePermissions map", () => {
  // app/domain/contracts.ts: owner/admin/dispatcher/estimator hold
  // crm.write; only technician and viewer lack it.
  assert.deepEqual([...ROLES_WITHOUT_CRM_WRITE], ["technician", "viewer"]);
  for (const role of ["owner", "admin", "dispatcher", "estimator"]) {
    assert.ok(!ROLES_WITHOUT_CRM_WRITE.includes(role), `${role} holds crm.write`);
  }
});

test("technician-session resolve is BLOCKED without provisioning, never a pass or a failure", () => {
  assert.deepEqual(
    S069_BLOCKED.map((entry) => entry.caseId),
    ["P1"],
  );
  assert.match(S069_BLOCKED[0].reason, /Billy/);
  assert.match(S069_BLOCKED[0].reason, /rls\.integration\.ts/);
  assert.equal(WRONG_ROLE_BLOCKED.caseId, "N6");
  assert.match(WRONG_ROLE_BLOCKED.reason, /Billy/);
  assert.match(TECHNICIAN_MEMBER_REQUIRED.reason, /Billy/);
  assert.match(TECHNICIAN_MEMBER_REQUIRED.reason, /dispatch requires an active technician assignment/);
});

test("unblockCase removes only the passed case from the blocked entries", () => {
  const blocked = [
    { caseId: "P1", step: "technician resolve", status: "BLOCKED" },
    { caseId: "N6", step: "wrong-role probe", status: "BLOCKED" },
  ];
  const remaining = unblockCase(blocked, "P1");
  assert.deepEqual(
    remaining.map((entry) => entry.caseId),
    ["N6"],
  );
  // The caller's list is untouched, and an unknown case removes nothing.
  assert.equal(blocked.length, 2);
  assert.deepEqual(
    unblockCase(blocked, "N9").map((entry) => entry.caseId),
    ["P1", "N6"],
  );
  assert.deepEqual(unblockCase(undefined, "P1"), []);
});

test("credential scan covers staff and portal bearer material and matches nothing benign", () => {
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("tradeos_(access|refresh)_token"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("sb-[a-z0-9-]+-auth-token"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("Bearer [A-Za-z0-9._-]{20,}"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("tradeos_customer_portal_session"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("tradeos_customer_portal_pending_access"));
  assert.equal(matchesCredentialScan("report.json with no secrets"), false);
  assert.equal(matchesCredentialScan("set-cookie: tradeos_access_token=abc123; Path=/; HttpOnly"), true);
  assert.equal(matchesCredentialScan("Authorization: Bearer abcdefghijklmnopqrst"), true);
  assert.equal(matchesCredentialScan('"cookies": []'), true);
  assert.equal(matchesCredentialScan("sb-abc123-auth-token"), true);
  assert.equal(matchesCredentialScan("tradeos_customer_portal_session=abc123"), true);
  assert.equal(matchesCredentialScan("closeout handed off"), false);
});

test("redacts bearer material — including the portal token in a URL — without hiding the failure", () => {
  assert.equal(
    redactBearerMaterial("Authorization: Bearer abcdefghijklmnopqrst and tradeos_access_token=abc123"),
    "Authorization: Bearer [REDACTED] and tradeos_access_token=[REDACTED]",
  );
  assert.equal(
    redactBearerMaterial("set-cookie: sb-abc123-auth-token=xyz; Path=/; HttpOnly"),
    "set-cookie: sb-abc123-auth-token=[REDACTED]; Path=/; HttpOnly",
  );
  assert.equal(
    redactBearerMaterial('page.goto: Timeout 60000ms exceeded.\nCall log:\n - navigating to "https://example.test/customer-portal/access?token=abcdefghijklmnopqrst0123456789abcdefghij"'),
    'page.goto: Timeout 60000ms exceeded.\nCall log:\n - navigating to "https://example.test/customer-portal/access?token=[REDACTED]"',
  );
  assert.equal(
    redactBearerMaterial("set-cookie: tradeos_customer_portal_session=abc123; Path=/; HttpOnly"),
    "set-cookie: tradeos_customer_portal_session=[REDACTED]; Path=/; HttpOnly",
  );
  assert.equal(
    redactBearerMaterial('page.goto: Timeout 60000ms exceeded.\nCall log:\n - navigating to "https://example.test/projects/1?tab=closeout"'),
    'page.goto: Timeout 60000ms exceeded.\nCall log:\n - navigating to "https://example.test/projects/1?tab=closeout"',
  );
  assert.equal(redactBearerMaterial("plain failure with no secrets"), "plain failure with no secrets");
  assert.equal(redactBearerMaterial(undefined), undefined);
});

test("report skeleton carries no bearer field and lists the blocked cases", () => {
  const report = createReportSkeleton({
    baseUrl: "https://tradeos-costbook-web-fixture.vercel.app",
    runId: "1",
    workflowSha: "b".repeat(40),
    deployedSha: "a".repeat(40),
    supabaseProjectRef: STAGING_PROJECT_REF,
    tenantLabel: "TEST Org — Delete Me",
    orgId: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
  });
  assert.equal(report.result, "PENDING");
  assert.equal(report.blocked.length, 1);
  assert.equal(report.blocked[0].caseId, "P1");
  assert.equal(report.blocked[0].status, "BLOCKED");
  assert.equal(report.credentialScan.result, "pending");
  // No bearer value can hide in the report: it carries no token, session,
  // cookie, or header field at all (blocked entries carry labels only).
  assert.equal("token" in report, false);
  assert.equal("session" in report, false);
  assert.equal("cookie" in report, false);
  assert.equal("Authorization" in report, false);
});

test("sha256 helper hashes bytes deterministically", () => {
  assert.equal(sha256Hex(Buffer.from("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("abc"), sha256Hex(Buffer.from("abc")));
});

test("validates the evidence environment and applies the staging default", () => {
  const valid = {
    S069_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
    S069_EXPECTED_SHA: "a".repeat(40),
    S069_SANITIZED_TENANT: "true",
    S069_ALLOW_MUTATIONS: "true",
    S069_STORAGE_STATE_PATH: "/tmp/s069-storage-state.json",
    BETA_RC_SUPABASE_PROJECT_REF: STAGING_PROJECT_REF,
    BETA_SMOKE_ORG_ID: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
  };
  const config = validateEvidenceEnv(valid);
  assert.equal(config.useTestOrg, true);
  assert.equal(config.requireCorrelation, true);
  assert.equal(config.outDir, "../artifacts/s069-browser-evidence");
  assert.equal(deploymentIdentityPath(config.outDir), path.join(config.outDir, "deployment-identity.json"));
  assert.throws(() => validateEvidenceEnv({ ...valid, S069_BASE_URL: "" }), /S069_BASE_URL is required/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S069_EXPECTED_SHA: "short" }), /full 40-character commit SHA/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S069_SANITIZED_TENANT: "false" }), /Sanitized smoke tenant/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S069_ALLOW_MUTATIONS: "false" }), /mutation consent/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S069_STORAGE_STATE_PATH: "" }), /STORAGE_STATE_PATH is required/);
  assert.throws(
    () => validateEvidenceEnv({ ...valid, BETA_RC_SUPABASE_PROJECT_REF: "kssaceuetdjwfqnbzhly" }),
    /staging data plane/,
  );
  assert.doesNotThrow(() =>
    validateEvidenceEnv({ ...valid, S069_USE_TEST_ORG: "false", BETA_RC_SUPABASE_PROJECT_REF: "kssaceuetdjwfqnbzhly" }),
  );
});

test("RC-target guards refuse production hosts, the Production alias, and -git-main- previews", () => {
  assert.throws(() => assertApprovedRcUrl("https://app.404tradeos.com"), /production/i);
  assert.throws(() => assertApprovedRcUrl("https://api.404tradeos.com"), /production/i);
  assert.throws(() => assertApprovedRcUrl("https://tradeos-costbook-web.vercel.app"), /production|approved/i);
  assert.throws(
    () => assertApprovedRcUrl("https://tradeos-costbook-web-git-main-abc123.vercel.app"),
    /git-main|production/i,
  );
  assert.doesNotThrow(() =>
    assertApprovedRcUrl("https://tradeos-costbook-web-abc123-def456.vercel.app"),
  );
  assert.throws(() => assertNonProductionDataPlane("kssaceuetdjwfqnbzhly"), /production/i);
  assert.equal(assertNonProductionDataPlane(STAGING_PROJECT_REF), STAGING_PROJECT_REF);
});

test("viewport matrix is the four beta-evidence widths", () => {
  assert.deepEqual(
    VIEWPORTS.map((viewport) => viewport.name),
    ["1440", "1024", "768", "390"],
  );
  assert.deepEqual(
    VIEWPORTS.map((viewport) => viewport.width),
    [1440, 1024, 768, 390],
  );
});

test("capture script fails closed before any network when the target is production", () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [new URL("./s069-browser-evidence.mjs", import.meta.url).pathname], {
        env: {
          ...process.env,
          S069_BASE_URL: "https://app.404tradeos.com",
          S069_EXPECTED_SHA: "a".repeat(40),
          S069_SANITIZED_TENANT: "true",
          S069_ALLOW_MUTATIONS: "true",
          S069_STORAGE_STATE_PATH: "/tmp/s069-storage-state.json",
          BETA_RC_SUPABASE_PROJECT_REF: STAGING_PROJECT_REF,
          S069_EVIDENCE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "s069-guard-")),
        },
        stdio: "pipe",
      }),
    /production/i,
  );
});

test("capture script fails closed when deployment identity is missing", () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "s069-identity-"));
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, [new URL("./s069-browser-evidence.mjs", import.meta.url).pathname], {
          env: {
            ...process.env,
            S069_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
            S069_EXPECTED_SHA: "a".repeat(40),
            S069_SANITIZED_TENANT: "true",
            S069_ALLOW_MUTATIONS: "true",
            S069_STORAGE_STATE_PATH: "/tmp/s069-storage-state.json",
            BETA_RC_SUPABASE_PROJECT_REF: STAGING_PROJECT_REF,
            S069_EVIDENCE_DIR: evidenceDir,
          },
          stdio: "pipe",
        }),
      /deployment-identity\.json/,
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});
