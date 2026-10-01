import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { assertCostbookPage, COSTBOOK_ROUTES, deploymentSupabaseProjectRef, hasVisibleFocusIndicator } from "./s027-evidence-contract.mjs";

const valid = { pathname: "/costbook", expectedPath: "/costbook", status: 200, bodyText: "Costbook No Costbook catalog records yet", scrollWidth: 390, clientWidth: 390 };
test("accepts a truthful empty catalog, and requires all nine canonical routes", () => {
  assert.doesNotThrow(() => assertCostbookPage(valid));
  assert.equal(COSTBOOK_ROUTES.length, 9);
  assert.equal(new Set(COSTBOOK_ROUTES.map(route => route.path)).size, 9);
});
test("rejects login redirects and HTTP 200 application error shells", () => {
  assert.throws(() => assertCostbookPage({ ...valid, pathname: "/login" }));
  for (const bodyText of ["Couldn't load materials", "Sign in required", "Manage access required", "Application error", "This page could not be found", ""]) {
    assert.throws(() => assertCostbookPage({ ...valid, bodyText }));
  }
});
test("rejects failed responses and missing or overflowing dimensions", () => {
  assert.throws(() => assertCostbookPage({ ...valid, status: 500 }));
  assert.throws(() => assertCostbookPage({ ...valid, scrollWidth: 420 }));
  assert.throws(() => assertCostbookPage({ ...valid, clientWidth: undefined }));
});
test("accepts only focus-induced visible paint changes", () => {
  const base = {
    color: "rgb(100, 100, 100)", backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopColor: "rgb(0, 0, 0)", borderRightColor: "rgb(0, 0, 0)", borderBottomColor: "rgb(0, 0, 0)", borderLeftColor: "rgb(0, 0, 0)",
    borderTopWidth: "0px", borderRightWidth: "0px", borderBottomWidth: "0px", borderLeftWidth: "0px",
    borderTopStyle: "none", borderRightStyle: "none", borderBottomStyle: "none", borderLeftStyle: "none",
    textDecorationLine: "none", textDecorationColor: "rgb(100, 100, 100)", textDecorationThickness: "auto",
    outlineStyle: "none", outlineWidth: "0px", outlineColor: "rgb(0, 0, 0)", boxShadow: "none",
  };
  assert.equal(hasVisibleFocusIndicator(base, { ...base, outlineStyle: "solid", outlineWidth: "2px" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, outlineStyle: "solid", outlineWidth: "2px", outlineColor: "rgba(0, 0, 0, 0)" }), false);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, boxShadow: "rgb(0, 0, 0) 0px 0px 0px 2px" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, boxShadow: "rgba(0, 0, 0, 0) 0px 0px 0px 2px" }), false);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, boxShadow: "rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.62 0.06 0.10 / 0.5) 0px 0px 0px 3px" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, color: "rgb(20, 20, 20)" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, color: "rgba(20, 20, 20, 0)" }), false);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, backgroundColor: "rgba(255, 255, 255, 0)" }), false);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, textDecorationLine: "underline", textDecorationColor: "rgba(0, 0, 0, 0)" }), false);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, borderTopColor: "rgba(0, 0, 0, 0)", borderTopWidth: "2px", borderTopStyle: "solid" }), false);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, borderTopColor: "rgb(20, 20, 20)", borderTopWidth: "2px", borderTopStyle: "solid" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base }), false);

  const persistentOutline = { ...base, outlineStyle: "solid", outlineWidth: "2px", outlineColor: "rgba(0, 0, 0, 0)" };
  assert.equal(hasVisibleFocusIndicator(persistentOutline, { ...persistentOutline, outlineColor: "rgb(20, 20, 20)" }), true);
  const persistentShadow = { ...base, boxShadow: "rgb(0, 0, 0) 0px 0px 0px 2px" };
  assert.equal(hasVisibleFocusIndicator(persistentOutline, { ...persistentOutline }), false);
  assert.equal(hasVisibleFocusIndicator(persistentShadow, { ...persistentShadow }), false);
});
test("binds Supabase attestation to applicable Preview configuration", () => {
  const deployedAt = 2_000;
  const envs = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["preview"], value: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", updatedAt: 1_900 },
    { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["preview"], gitBranch: "rc/beta", value: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co", updatedAt: 1_500 },
  ];
  assert.equal(deploymentSupabaseProjectRef(envs, "rc/beta", deployedAt), "bbbbbbbbbbbbbbbbbbbb");
  assert.throws(() => deploymentSupabaseProjectRef([envs[0]], "rc/beta", deployedAt), /Branch-scoped/);
  assert.throws(() => deploymentSupabaseProjectRef([{ ...envs[1], updatedAt: 2_500 }], "rc/beta", deployedAt), /redeploy before mutating evidence/);
  assert.throws(() => deploymentSupabaseProjectRef([{ ...envs[1], value: "https://example.com" }], "rc/beta", deployedAt), /identify a Supabase project/);
  assert.throws(() => deploymentSupabaseProjectRef([{ ...envs[1], value: "http://bbbbbbbbbbbbbbbbbbbb.supabase.co" }], "rc/beta", deployedAt), /must use HTTPS/);
});

test("deployment identity requires the exact branch-scoped Preview value", () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "s027-identity-"));
  const ref = "qfbgdkbamfaasmtjfyru";
  const sha = "a".repeat(40);
  const preload = `
    const envs = [
      { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["preview"], value: "https://${ref}.supabase.co", updatedAt: 1000 },
      { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["preview"], gitBranch: "staging", value: "https://${ref}.supabase.co", updatedAt: 1000 },
      { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["preview"], gitBranch: "other", value: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co", updatedAt: 1500 },
      { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["production"], value: "https://cccccccccccccccccccc.supabase.co", updatedAt: 1500 }
    ];
    globalThis.fetch = async input => {
      const url = new URL(input);
      if (url.pathname.startsWith("/v13/deployments/")) return Response.json({
        id: "dpl_fixture", url: "tradeos-costbook-fixture.vercel.app", projectId: "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36",
        readyState: "READY", target: null, createdAt: 2000, meta: { githubCommitSha: "${sha}", githubCommitRef: "staging" }
      });
      if (url.pathname.endsWith("/env")) {
        if (url.searchParams.get("decrypt") !== "true") throw new Error("Environment values required");
        const branch = url.searchParams.get("gitBranch");
        return Response.json({ envs: branch ? envs.filter(env => env.gitBranch === branch) : envs });
      }
      throw new Error("Unexpected API request");
    };
  `;
  try {
    execFileSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, new URL("./s027-deployment-identity.mjs", import.meta.url).pathname], {
      env: { ...process.env, S027_BASE_URL: "https://tradeos-costbook-fixture.vercel.app", S027_EXPECTED_SHA: sha,
        BETA_RC_SUPABASE_PROJECT_REF: ref, S027_SANITIZED_TENANT: "true", BETA_SMOKE_ORG_ID: "9814bd72-626a-42f4-8871-cd755cb9d685",
        VERCEL_TOKEN: "fixture-only", S027_EVIDENCE_DIR: evidenceDir },
      stdio: "pipe",
    });
    const identity = JSON.parse(fs.readFileSync(path.join(evidenceDir, "deployment-identity.json"), "utf8"));
    assert.equal(identity.supabaseProjectRef, ref);
    assert.equal(identity.commitSha, sha);
    assert.equal(identity.branch, "staging");
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
});
