import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  APPROVED_EVENT_TYPE,
  CHANGE_ORDER_PAGES,
  CREDENTIAL_SCAN_PATTERNS,
  NEGATIVE_CASES,
  REJECTED_EVENT_TYPE,
  ROLES_WITHOUT_BILLING_WRITE,
  S068_BLOCKED,
  STAGING_PROJECT_REF,
  WRONG_ROLE_BLOCKED,
  assertActivityEvent,
  assertChangeOrdersTab,
  assertDecisionHistory,
  assertPricing,
  createReportSkeleton,
  deploymentIdentityPath,
  expectedStatusForCase,
  matchesCredentialScan,
  redactBearerMaterial,
  round2,
  sha256Hex,
  validateEvidenceEnv,
} from "./s068-evidence-contract.mjs";
import { VIEWPORTS } from "./beta-evidence/lib/evidence-artifacts.mjs";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";

const projectId = "11111111-2222-4333-8444-555555555555";
const validTab = {
  pathname: `/projects/${projectId}`,
  search: "?tab=change-orders",
  projectId,
  status: 200,
  bodyText: "Change Orders Create change order CO-1 Approved 24 Nov 2026",
  scrollWidth: 1440,
  clientWidth: 1440,
  markers: ["Change Orders", "CO-1"],
};

test("accepts a truthful change-orders tab and requires all three captured states", () => {
  assert.doesNotThrow(() => assertChangeOrdersTab(validTab));
  assert.equal(CHANGE_ORDER_PAGES.length, 3);
  assert.deepEqual(
    CHANGE_ORDER_PAGES.map((page) => page.slug),
    ["change-order-draft", "change-order-approved", "change-order-rejected"],
  );
  assert.ok(CHANGE_ORDER_PAGES.every((page) => page.tab === "change-orders"));
});

test("rejects wrong project, wrong tab, error shells, missing markers, and overflow", () => {
  assert.throws(() => assertChangeOrdersTab({ ...validTab, pathname: "/projects/other-id" }));
  assert.throws(() => assertChangeOrdersTab({ ...validTab, search: "?tab=overview" }));
  assert.throws(() => assertChangeOrdersTab({ ...validTab, search: "" }));
  assert.throws(() => assertChangeOrdersTab({ ...validTab, bodyText: "Change Orders" }));
  assert.throws(() => assertChangeOrdersTab({ ...validTab, markers: ["Missing marker"] }));
  for (const bodyText of [
    "Couldn't load project",
    "Sign in required",
    "Application error",
    "Internal server error",
    "This page could not be found",
    "",
  ]) {
    assert.throws(() => assertChangeOrdersTab({ ...validTab, bodyText }));
  }
  assert.throws(() => assertChangeOrdersTab({ ...validTab, status: 500 }));
  assert.throws(() => assertChangeOrdersTab({ ...validTab, scrollWidth: 1500 }));
  assert.throws(() => assertChangeOrdersTab({ ...validTab, clientWidth: undefined }));
});

test("accepts the approval-history line only with the decision word and a timestamp", () => {
  assert.doesNotThrow(() =>
    assertDecisionHistory({ bodyText: "Approval history Approved 24 Nov 2026, 10:00", decision: "approved" }),
  );
  assert.doesNotThrow(() =>
    assertDecisionHistory({ bodyText: "Approval history Rejected 24 Nov 2026, 10:00", decision: "rejected" }),
  );
  // Regression (evidence run 45494547637): the workspace renders InfoPairs
  // labels with CSS `uppercase`, so innerText reports "APPROVAL HISTORY".
  assert.doesNotThrow(() =>
    assertDecisionHistory({ bodyText: "APPROVAL HISTORY Approved Nov 24, 2026, 9:48 PM", decision: "approved" }),
  );
  assert.doesNotThrow(() =>
    assertDecisionHistory({ bodyText: "APPROVAL HISTORY Rejected Nov 24, 2026, 9:50 PM", decision: "rejected" }),
  );
  assert.throws(() => assertDecisionHistory({ bodyText: "Approval history Draft", decision: "approved" }));
  assert.throws(() => assertDecisionHistory({ bodyText: "Approved 24 Nov 2026", decision: "approved" }));
  assert.throws(() =>
    assertDecisionHistory({ bodyText: "Approval history Rejected 24 Nov 2026", decision: "approved" }),
  );
  assert.throws(() => assertDecisionHistory({ bodyText: "Approval history Approved 24 Nov 2026", decision: "draft" }));
});

test("finds the attributable activity record and rejects unattributed or missing events", () => {
  const events = [
    { entityId: "other-id", entityType: "change_order", eventType: APPROVED_EVENT_TYPE, actorUserId: "user-1", occurredAt: "2026-11-24T10:00:00.000Z" },
    { entityId: projectId, entityType: "change_order", eventType: APPROVED_EVENT_TYPE, actorUserId: "user-2", occurredAt: "2026-11-24T10:01:00.000Z" },
  ];
  const found = assertActivityEvent({ events, eventType: APPROVED_EVENT_TYPE, changeOrderId: projectId });
  assert.equal(found.actorUserId, "user-2");
  assert.throws(() =>
    assertActivityEvent({ events, eventType: REJECTED_EVENT_TYPE, changeOrderId: projectId }),
  );
  assert.throws(() =>
    assertActivityEvent({
      events: [{ ...events[1], actorUserId: "" }],
      eventType: APPROVED_EVENT_TYPE,
      changeOrderId: projectId,
    }),
  );
  assert.throws(() =>
    assertActivityEvent({
      events: [{ ...events[1], occurredAt: "not-a-date" }],
      eventType: APPROVED_EVENT_TYPE,
      changeOrderId: projectId,
    }),
  );
  assert.throws(() => assertActivityEvent({ events: null, eventType: APPROVED_EVENT_TYPE, changeOrderId: projectId }));
});

test("pricing fidelity: line cost is quantity x unit cost and the amount equals it", () => {
  assert.doesNotThrow(() => assertPricing({ quantity: 2, unitCost: 150, lineCost: 300, amount: 300 }));
  assert.doesNotThrow(() => assertPricing({ quantity: 3, unitCost: 19.99, lineCost: 59.97, amount: 59.97 }));
  assert.equal(round2(3 * 19.99), 59.97);
  assert.throws(() => assertPricing({ quantity: 2, unitCost: 150, lineCost: 299.99, amount: 299.99 }));
  assert.throws(() => assertPricing({ quantity: 2, unitCost: 150, lineCost: 300, amount: 250 }));
  assert.throws(() => assertPricing({ quantity: 0, unitCost: 150, lineCost: 0, amount: 0 }));
  assert.throws(() => assertPricing({ quantity: 2, unitCost: -5, lineCost: -10, amount: -10 }));
});

test("covers every required negative case exactly once", () => {
  const ids = NEGATIVE_CASES.map((entry) => entry.caseId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9"]) {
    assert.ok(ids.includes(id), `negative case ${id} is missing`);
  }
  assert.equal(expectedStatusForCase("N1"), 409);
  assert.equal(expectedStatusForCase("N3"), 409);
  assert.equal(expectedStatusForCase("N4"), 403);
  assert.equal(expectedStatusForCase("N5"), 404);
  assert.equal(expectedStatusForCase("N6"), 401);
  // N9 is a 405, not a 404: the portal proxy route exports only GET, so
  // Next.js rejects the decision POST before any handler runs.
  assert.equal(expectedStatusForCase("N9"), 405);
  assert.throws(() => expectedStatusForCase("N10"), /Unknown negative case/);
});

test("roles without billing.write match the domain rolePermissions map", () => {
  // app/domain/contracts.ts: owner/admin/dispatcher/estimator hold
  // billing.write; only technician and viewer lack it.
  assert.deepEqual([...ROLES_WITHOUT_BILLING_WRITE], ["technician", "viewer"]);
  for (const role of ["owner", "admin", "dispatcher", "estimator"]) {
    assert.ok(!ROLES_WITHOUT_BILLING_WRITE.includes(role), `${role} holds billing.write`);
  }
});

test("customer portal decision is BLOCKED by design, never a pass or a failure", () => {
  assert.deepEqual(
    S068_BLOCKED.map((entry) => entry.caseId),
    ["P1"],
  );
  assert.match(S068_BLOCKED[0].reason, /ADR-010/);
  assert.match(S068_BLOCKED[0].reason, /changeOrders: \[\]/);
  assert.equal(WRONG_ROLE_BLOCKED.caseId, "N4");
  assert.match(WRONG_ROLE_BLOCKED.reason, /Billy/);
});

test("credential scan covers staff bearer material and matches nothing benign", () => {
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("tradeos_(access|refresh)_token"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("sb-[a-z0-9-]+-auth-token"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("Bearer [A-Za-z0-9._-]{20,}"));
  assert.equal(matchesCredentialScan("report.json with no secrets"), false);
  assert.equal(matchesCredentialScan("set-cookie: tradeos_access_token=abc123; Path=/; HttpOnly"), true);
  assert.equal(matchesCredentialScan("Authorization: Bearer abcdefghijklmnopqrst"), true);
  assert.equal(matchesCredentialScan('"cookies": []'), true);
  assert.equal(matchesCredentialScan("sb-abc123-auth-token"), true);
  assert.equal(matchesCredentialScan("change order CO-1 approved"), false);
});

test("redacts bearer material from error text without hiding the failure", () => {
  assert.equal(
    redactBearerMaterial("Authorization: Bearer abcdefghijklmnopqrst and tradeos_access_token=abc123"),
    "Authorization: Bearer [REDACTED] and tradeos_access_token=[REDACTED]",
  );
  assert.equal(
    redactBearerMaterial("set-cookie: sb-abc123-auth-token=xyz; Path=/; HttpOnly"),
    "set-cookie: sb-abc123-auth-token=[REDACTED]; Path=/; HttpOnly",
  );
  assert.equal(
    redactBearerMaterial('page.goto: Timeout 60000ms exceeded.\nCall log:\n - navigating to "https://example.test/projects/1?tab=change-orders"'),
    'page.goto: Timeout 60000ms exceeded.\nCall log:\n - navigating to "https://example.test/projects/1?tab=change-orders"',
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
    S068_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
    S068_EXPECTED_SHA: "a".repeat(40),
    S068_SANITIZED_TENANT: "true",
    S068_ALLOW_MUTATIONS: "true",
    S068_STORAGE_STATE_PATH: "/tmp/s068-storage-state.json",
    BETA_RC_SUPABASE_PROJECT_REF: STAGING_PROJECT_REF,
    BETA_SMOKE_ORG_ID: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
  };
  const config = validateEvidenceEnv(valid);
  assert.equal(config.useTestOrg, true);
  assert.equal(config.requireCorrelation, true);
  assert.equal(config.outDir, "../artifacts/s068-browser-evidence");
  assert.equal(deploymentIdentityPath(config.outDir), path.join(config.outDir, "deployment-identity.json"));
  assert.throws(() => validateEvidenceEnv({ ...valid, S068_BASE_URL: "" }), /S068_BASE_URL is required/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S068_EXPECTED_SHA: "short" }), /full 40-character commit SHA/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S068_SANITIZED_TENANT: "false" }), /Sanitized smoke tenant/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S068_ALLOW_MUTATIONS: "false" }), /mutation consent/);
  assert.throws(() => validateEvidenceEnv({ ...valid, S068_STORAGE_STATE_PATH: "" }), /STORAGE_STATE_PATH is required/);
  assert.throws(
    () => validateEvidenceEnv({ ...valid, BETA_RC_SUPABASE_PROJECT_REF: "kssaceuetdjwfqnbzhly" }),
    /staging data plane/,
  );
  assert.doesNotThrow(() =>
    validateEvidenceEnv({ ...valid, S068_USE_TEST_ORG: "false", BETA_RC_SUPABASE_PROJECT_REF: "kssaceuetdjwfqnbzhly" }),
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
      execFileSync(process.execPath, [new URL("./s068-browser-evidence.mjs", import.meta.url).pathname], {
        env: {
          ...process.env,
          S068_BASE_URL: "https://app.404tradeos.com",
          S068_EXPECTED_SHA: "a".repeat(40),
          S068_SANITIZED_TENANT: "true",
          S068_ALLOW_MUTATIONS: "true",
          S068_STORAGE_STATE_PATH: "/tmp/s068-storage-state.json",
          BETA_RC_SUPABASE_PROJECT_REF: STAGING_PROJECT_REF,
          S068_EVIDENCE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "s068-guard-")),
        },
        stdio: "pipe",
      }),
    /production/i,
  );
});

test("capture script fails closed when deployment identity is missing", () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "s068-identity-"));
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, [new URL("./s068-browser-evidence.mjs", import.meta.url).pathname], {
          env: {
            ...process.env,
            S068_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
            S068_EXPECTED_SHA: "a".repeat(40),
            S068_SANITIZED_TENANT: "true",
            S068_ALLOW_MUTATIONS: "true",
            S068_STORAGE_STATE_PATH: "/tmp/s068-storage-state.json",
            BETA_RC_SUPABASE_PROJECT_REF: STAGING_PROJECT_REF,
            S068_EVIDENCE_DIR: evidenceDir,
          },
          stdio: "pipe",
        }),
      /deployment-identity\.json/,
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});
