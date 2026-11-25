import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  CREDENTIAL_SCAN_PATTERNS,
  EXPIRED_BROWSER_BLOCKED,
  NEGATIVE_CASES,
  PORTAL_PAGES,
  STAGING_PROJECT_REF,
  assertAccessErrorPage,
  assertAccessRequiredPage,
  assertPdfResponse,
  assertPortalPage,
  createReportSkeleton,
  expectedStatusForCase,
  isValidPortalTokenShape,
  matchesCredentialScan,
  redactBearerMaterial,
  sha256Hex,
} from "./s059-evidence-contract.mjs";

const valid = {
  pathname: "/customer-portal",
  expectedPath: "/customer-portal",
  status: 200,
  bodyText: "Your projects S059 Customer A",
  scrollWidth: 390,
  clientWidth: 390,
  markers: ["Your projects"],
};

test("accepts a truthful portal home page and requires all six portal pages", () => {
  assert.doesNotThrow(() => assertPortalPage(valid));
  assert.equal(PORTAL_PAGES.length, 6);
  assert.equal(new Set(PORTAL_PAGES.map((page) => page.path)).size, 6);
});

test("rejects login redirects, access-required state, error shells, and overflow", () => {
  assert.throws(() => assertPortalPage({ ...valid, pathname: "/login" }));
  assert.throws(() => assertPortalPage({ ...valid, bodyText: "Portal access required" }));
  assert.throws(() => assertPortalPage({ ...valid, bodyText: "Unrelated page content with no marker" }));
  for (const bodyText of [
    "Couldn't load project",
    "Sign in required",
    "Application error",
    "Internal server error",
    "This page could not be found",
    "",
  ]) {
    assert.throws(() => assertPortalPage({ ...valid, bodyText }));
  }
  assert.throws(() => assertPortalPage({ ...valid, status: 500 }));
  assert.throws(() => assertPortalPage({ ...valid, scrollWidth: 420 }));
  assert.throws(() => assertPortalPage({ ...valid, clientWidth: undefined }));
});

test("accepts the access-error page only with the non-enumerating message", () => {
  const error = {
    pathname: "/customer-portal/access-error",
    status: 200,
    bodyText: "This link is no longer available Ask your contractor for a new invitation",
    scrollWidth: 390,
    clientWidth: 390,
  };
  assert.doesNotThrow(() => assertAccessErrorPage(error));
  assert.throws(() => assertAccessErrorPage({ ...error, pathname: "/customer-portal" }));
  assert.throws(() => assertAccessErrorPage({ ...error, bodyText: "Something went wrong" }));
  assert.throws(() => assertAccessErrorPage({ ...error, scrollWidth: 500 }));
});

test("accepts the access-required state on any portal route", () => {
  const required = {
    pathname: "/customer-portal/projects/00000000-0000-0000-0000-000000000000",
    bodyText: "Portal access required Open the customer portal invitation from your contractor to continue.",
    scrollWidth: 390,
    clientWidth: 390,
  };
  assert.doesNotThrow(() => assertAccessRequiredPage(required));
  assert.throws(() => assertAccessRequiredPage({ ...required, pathname: "/login" }));
  assert.throws(() => assertAccessRequiredPage({ ...required, bodyText: "Your projects" }));
});

test("requires a real PDF content type", () => {
  assert.doesNotThrow(() => assertPdfResponse({ status: 200, contentType: "application/pdf" }));
  assert.doesNotThrow(() => assertPdfResponse({ status: 200, contentType: "application/pdf; charset=binary" }));
  assert.throws(() => assertPdfResponse({ status: 404, contentType: "application/pdf" }));
  assert.throws(() => assertPdfResponse({ status: 200, contentType: "text/html; charset=utf-8" }));
});

test("covers every required negative case exactly once", () => {
  const ids = NEGATIVE_CASES.map((entry) => entry.caseId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["A2", "A3", "A4", "A5", "B2", "B5", "B7", "B8", "B9", "C4", "C5", "C7", "C8", "C12", "C13", "E3", "GAP-1"]) {
    assert.ok(ids.includes(id), `negative case ${id} is missing`);
  }
  assert.equal(expectedStatusForCase("B5"), 410);
  assert.deepEqual(expectedStatusForCase("B9"), [400, 401]);
  assert.equal(expectedStatusForCase("C4"), 404);
  assert.equal(expectedStatusForCase("B2"), null);
  assert.throws(() => expectedStatusForCase("B6"), /Unknown negative case/);
});

test("expired browser cases are BLOCKED, never a pass or a failure", () => {
  assert.deepEqual(
    EXPIRED_BROWSER_BLOCKED.map((entry) => entry.caseId),
    ["B6", "E4"],
  );
  for (const entry of EXPIRED_BROWSER_BLOCKED) {
    assert.match(entry.reason, /staging-DB write access/);
    assert.match(entry.reason, /Billy/);
  }
});

test("credential scan covers portal bearer material and matches nothing benign", () => {
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("tradeos_customer_portal_pending_access"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("tradeos_customer_portal_session"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("x-tradeos-portal-session"));
  assert.ok(CREDENTIAL_SCAN_PATTERNS.includes("token=[A-Za-z0-9_-]{40,128}"));
  assert.equal(matchesCredentialScan("report.json with no secrets"), false);
  assert.equal(matchesCredentialScan("set-cookie: tradeos_customer_portal_session=abc"), true);
  assert.equal(matchesCredentialScan("Authorization: Bearer abcdefghijklmnopqrst"), true);
  assert.equal(matchesCredentialScan('"cookies": []'), true);
  assert.equal(matchesCredentialScan("sb-abc123-auth-token"), true);
  assert.equal(matchesCredentialScan(`https://example.test/customer-portal/access?token=${"a".repeat(43)}`), true);
  assert.equal(matchesCredentialScan("https://example.test/customer-portal/access?token=[REDACTED]"), false);
  assert.equal(matchesCredentialScan("unknown token 410"), false);
});

test("redacts bearer material from error text without hiding the failure", () => {
  const raw = "a".repeat(43);
  const url = `page.goto: Timeout 60000ms exceeded.\nCall log:\n - navigating to "https://example.test/customer-portal/access?token=${raw}", waiting until "networkidle"`;
  const redacted = redactBearerMaterial(url);
  assert.doesNotMatch(redacted, new RegExp(raw));
  assert.match(redacted, /token=\[REDACTED\]/);
  assert.match(redacted, /Timeout 60000ms exceeded/);
  assert.match(redacted, /navigating to/);
  assert.equal(
    redactBearerMaterial("Authorization: Bearer abcdefghijklmnopqrst and x-tradeos-portal-session: abcdefghijklmnopqrst"),
    "Authorization: Bearer [REDACTED] and x-tradeos-portal-session: [REDACTED]",
  );
  assert.equal(
    redactBearerMaterial("set-cookie: tradeos_customer_portal_session=abc123; Path=/; HttpOnly"),
    "set-cookie: tradeos_customer_portal_session=[REDACTED]; Path=/; HttpOnly",
  );
  assert.equal(redactBearerMaterial("plain failure with no secrets"), "plain failure with no secrets");
  assert.equal(redactBearerMaterial(undefined), undefined);
});

test("validates the portal token shape without accepting short values", () => {
  assert.equal(isValidPortalTokenShape("a".repeat(40)), true);
  assert.equal(isValidPortalTokenShape("A".repeat(128)), true);
  assert.equal(isValidPortalTokenShape("short"), false);
  assert.equal(isValidPortalTokenShape("a".repeat(129)), false);
  assert.equal(isValidPortalTokenShape("has space in it".padEnd(40, "a")), false);
  assert.equal(isValidPortalTokenShape(undefined), false);
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
  assert.equal(report.blocked.length, 2);
  assert.equal(report.blocked[0].status, "BLOCKED");
  assert.equal(report.credentialScan.result, "pending");
  // No bearer value can hide in the report: it carries no token, session,
  // cookie, or header field at all (blocked entries carry labels only).
  assert.equal("token" in report, false);
  assert.equal("session" in report, false);
  assert.equal("cookie" in report, false);
  assert.equal("Authorization" in report, false);
});

test("sha256 helper hashes PDF bytes deterministically", () => {
  assert.equal(sha256Hex(Buffer.from("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("abc"), sha256Hex(Buffer.from("abc")));
});

test("deployment identity proves web SHA, API SHA, and /ready project ref without an env inventory", () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "s059-identity-"));
  const ref = STAGING_PROJECT_REF;
  const sha = "a".repeat(40);
  const apiUrl = "tradeos-costbook-fixture.vercel.app";
  const preload = `
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      if (url.pathname.startsWith("/v13/deployments/")) {
        if (url.pathname.endsWith("/${apiUrl}")) return Response.json({
          uid: "dpl_api_fixture", url: "${apiUrl}", projectId: "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD",
          readyState: "READY", target: null, createdAt: 2000, meta: { githubCommitSha: "${sha}", githubCommitRef: "staging" }
        });
        return Response.json({
          id: "dpl_web_fixture", url: "tradeos-costbook-web-fixture.vercel.app", projectId: "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36",
          readyState: "READY", target: null, createdAt: 2000, meta: { githubCommitSha: "${sha}", githubCommitRef: "staging" }
        });
      }
      if (url.pathname === "/api/staging-runtime-identity") return Response.json({
        status: "configured", commitSha: "${sha}", branch: "staging", environment: "preview",
        supabaseProjectRef: "${ref}", backendOrigin: "https://${apiUrl}", scope: "public_configuration_only",
      });
      if (url.pathname === "/v6/deployments") return Response.json({ deployments: [{
        uid: "dpl_api_fixture", url: "${apiUrl}", projectId: "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD",
        state: "READY", createdAt: 2000, meta: { githubCommitSha: "${sha}", githubCommitRef: "staging" }
      }]});
      if (url.pathname === "/health") return Response.json({ status: "ok", service: "tradeos-costbook-api", commitSha: "${sha}", environment: "preview" });
      if (url.pathname === "/ready") return Response.json({
        status: "ready", checks: { database: { status: "ok", latencyMs: 1, projectRef: "${ref}" }, schema: { status: "ok" } }
      });
      throw new Error("Unexpected API request: " + url.pathname);
    };
  `;
  try {
    execFileSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, new URL("./s059-deployment-identity.mjs", import.meta.url).pathname], {
      env: {
        ...process.env,
        S059_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
        S059_EXPECTED_SHA: sha,
        S059_REQUIRE_SHA_CORRELATION: "true",
        BETA_RC_SUPABASE_PROJECT_REF: ref,
        VERCEL_TOKEN: "fixture-only",
        S059_SANITIZED_TENANT: "true",
        BETA_SMOKE_ORG_ID: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
        S059_EVIDENCE_DIR: evidenceDir,
      },
      stdio: "pipe",
    });
    const identity = JSON.parse(fs.readFileSync(path.join(evidenceDir, "deployment-identity.json"), "utf8"));
    assert.equal(identity.supabaseProjectRef, ref);
    assert.equal(identity.commitSha, sha);
    assert.equal(identity.branch, "staging");
    // The fixture host is a preview host, so the deployment environment
    // derived from its URL is "preview" even though the branch is staging.
    assert.equal(identity.environment, "preview");
    assert.equal(identity.apiDeploymentId, "dpl_api_fixture");
    assert.equal(identity.backendOrigin, `https://${apiUrl}`);
    assert.equal(identity.backendBinding, "verified");
    assert.equal(identity.shaCorrelated, true);
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});

test("deployment identity refuses a backend alias that resolves to another API deployment", () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "s059-identity-"));
  const ref = STAGING_PROJECT_REF;
  const sha = "a".repeat(40);
  const apiUrl = "tradeos-costbook-fixture.vercel.app";
  const otherUrl = "tradeos-costbook-other.vercel.app";
  const preload = `
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      if (url.pathname.startsWith("/v13/deployments/")) {
        if (url.pathname.endsWith("/${otherUrl}")) return Response.json({
          uid: "dpl_other", url: "${otherUrl}", projectId: "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD",
          readyState: "READY", target: null, createdAt: 2000, meta: { githubCommitSha: "${sha}", githubCommitRef: "staging" }
        });
        return Response.json({
          id: "dpl_web_fixture", url: "tradeos-costbook-web-fixture.vercel.app", projectId: "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36",
          readyState: "READY", target: null, createdAt: 2000, meta: { githubCommitSha: "${sha}", githubCommitRef: "staging" }
        });
      }
      if (url.pathname === "/api/staging-runtime-identity") return Response.json({
        status: "configured", commitSha: "${sha}", branch: "staging", environment: "preview",
        supabaseProjectRef: "${ref}", backendOrigin: "https://${otherUrl}", scope: "public_configuration_only",
      });
      if (url.pathname === "/v6/deployments") return Response.json({ deployments: [{
        uid: "dpl_api_fixture", url: "${apiUrl}", projectId: "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD",
        state: "READY", createdAt: 2000, meta: { githubCommitSha: "${sha}", githubCommitRef: "staging" }
      }]});
      if (url.pathname === "/health") return Response.json({ status: "ok", service: "tradeos-costbook-api", commitSha: "${sha}", environment: "preview" });
      if (url.pathname === "/ready") return Response.json({
        status: "ready", checks: { database: { status: "ok", latencyMs: 1, projectRef: "${ref}" }, schema: { status: "ok" } }
      });
      throw new Error("Unexpected API request: " + url.pathname);
    };
  `;
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, new URL("./s059-deployment-identity.mjs", import.meta.url).pathname], {
          env: {
            ...process.env,
            S059_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
            S059_EXPECTED_SHA: sha,
            S059_REQUIRE_SHA_CORRELATION: "true",
            BETA_RC_SUPABASE_PROJECT_REF: ref,
            VERCEL_TOKEN: "fixture-only",
            S059_SANITIZED_TENANT: "true",
            BETA_SMOKE_ORG_ID: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
            S059_EVIDENCE_DIR: evidenceDir,
          },
          stdio: "pipe",
        }),
      /does not resolve to the selected API deployment/,
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});

test("deployment identity refuses a SHA mismatch and a wrong data plane", () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "s059-identity-"));
  const ref = STAGING_PROJECT_REF;
  const sha = "a".repeat(40);
  const preload = `
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      if (url.pathname.startsWith("/v13/deployments/")) return Response.json({
        id: "dpl_web_fixture", url: "tradeos-costbook-web-fixture.vercel.app", projectId: "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36",
        readyState: "READY", target: null, createdAt: 2000, meta: { githubCommitSha: "${"b".repeat(40)}", githubCommitRef: "staging" }
      });
      throw new Error("Unexpected API request: " + url.pathname);
    };
  `;
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, new URL("./s059-deployment-identity.mjs", import.meta.url).pathname], {
          env: {
            ...process.env,
            S059_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
            S059_EXPECTED_SHA: sha,
            S059_REQUIRE_SHA_CORRELATION: "true",
            BETA_RC_SUPABASE_PROJECT_REF: ref,
            VERCEL_TOKEN: "fixture-only",
            S059_SANITIZED_TENANT: "true",
            BETA_SMOKE_ORG_ID: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
            S059_EVIDENCE_DIR: evidenceDir,
          },
          stdio: "pipe",
        }),
      /Preview deployed SHA mismatch/,
    );
    assert.throws(
      () =>
        execFileSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, new URL("./s059-deployment-identity.mjs", import.meta.url).pathname], {
          env: {
            ...process.env,
            S059_BASE_URL: "https://tradeos-costbook-web-fixture.vercel.app",
            S059_EXPECTED_SHA: sha,
            S059_REQUIRE_SHA_CORRELATION: "true",
            BETA_RC_SUPABASE_PROJECT_REF: "kssaceuetdjwfqnbzhly",
            VERCEL_TOKEN: "fixture-only",
            S059_SANITIZED_TENANT: "true",
            BETA_SMOKE_ORG_ID: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
            S059_EVIDENCE_DIR: evidenceDir,
          },
          stdio: "pipe",
        }),
      /production Supabase project/,
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});
