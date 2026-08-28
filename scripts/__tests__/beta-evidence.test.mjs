import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PRODUCTION_SUPABASE_REF,
  RcTargetError,
  assertApprovedRcUrl,
  assertDeploymentSha,
  assertEnvironmentIdentity,
  assertNonProductionDataPlane,
  resolveRcBaseUrl,
} from "../../app/scripts/beta-evidence/lib/rc-target.mjs";

import {
  CHECKPOINTS,
  VIEWPORTS,
  assessResponsiveQuality,
  assessScreenshotTruth,
  expectedScreenshots,
  readPngDimensions,
  screenshotFileName,
  validateEvidenceSet,
} from "../../app/scripts/beta-evidence/lib/evidence-artifacts.mjs";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function codeOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof RcTargetError, `expected RcTargetError, got ${error}`);
    return error.code;
  }
  throw new assert.AssertionError({ message: "expected the call to throw" });
}

test("production and production-tracking hosts are refused as RC targets", () => {
  assert.equal(codeOf(() => assertApprovedRcUrl("https://app.404tradeos.com")), "RC_URL_IS_PRODUCTION");
  assert.equal(codeOf(() => assertApprovedRcUrl("https://api.404tradeos.com")), "RC_URL_IS_PRODUCTION");
  assert.equal(
    codeOf(() => assertApprovedRcUrl("https://tradeos-costbook-web.vercel.app")),
    "RC_URL_IS_PRODUCTION_ALIAS",
  );
  assert.equal(
    codeOf(() => assertApprovedRcUrl("https://tradeos-costbook-web-git-main-billykshowalters.vercel.app")),
    "RC_URL_TRACKS_MAIN",
  );
  assert.equal(codeOf(() => assertApprovedRcUrl("https://example.com")), "RC_URL_NOT_APPROVED");
});

test("RC target URLs must be bare HTTPS origins without credentials", () => {
  assert.equal(codeOf(() => assertApprovedRcUrl("")), "RC_URL_MISSING");
  assert.equal(codeOf(() => assertApprovedRcUrl("not-a-url")), "RC_URL_MALFORMED");
  assert.equal(
    codeOf(() => assertApprovedRcUrl("http://tradeos-costbook-web-abc123.vercel.app")),
    "RC_URL_NOT_HTTPS",
  );
  assert.equal(
    codeOf(() => assertApprovedRcUrl("https://user:pw@tradeos-costbook-web-abc123.vercel.app")),
    "RC_URL_HAS_CREDENTIALS",
  );
  assert.equal(
    codeOf(() => assertApprovedRcUrl("https://tradeos-costbook-web-abc123.vercel.app?token=x")),
    "RC_URL_NOT_ORIGIN",
  );
});

test("an approved preview host is accepted", () => {
  const parsed = assertApprovedRcUrl("https://tradeos-costbook-web-git-fix-contracts-09eca2-billykshowalters.vercel.app");
  assert.equal(parsed.origin, "https://tradeos-costbook-web-git-fix-contracts-09eca2-billykshowalters.vercel.app");
});

test("environment identity must be explicit, supported, and self-consistent", () => {
  assert.equal(codeOf(() => assertEnvironmentIdentity(undefined, "preview")), "ENV_EXPECTED_MISSING");
  assert.equal(codeOf(() => assertEnvironmentIdentity("preview", undefined)), "ENV_ACTUAL_MISSING");
  assert.equal(codeOf(() => assertEnvironmentIdentity("production", "production")), "ENV_UNSUPPORTED");
  assert.equal(codeOf(() => assertEnvironmentIdentity("preview", "staging")), "ENV_MISMATCH");
  assert.equal(assertEnvironmentIdentity("Preview", "preview"), "preview");
});

test("mutating runs refuse an unproven or production data plane", () => {
  assert.equal(codeOf(() => assertNonProductionDataPlane(undefined)), "DATA_PLANE_UNPROVEN");
  assert.equal(codeOf(() => assertNonProductionDataPlane("too-short")), "DATA_PLANE_MALFORMED");
  assert.equal(codeOf(() => assertNonProductionDataPlane(PRODUCTION_SUPABASE_REF)), "DATA_PLANE_IS_PRODUCTION");
  assert.equal(assertNonProductionDataPlane("abcdefghijklmnopqrst"), "abcdefghijklmnopqrst");
});

test("URL resolution is deterministic and refuses ambiguity", () => {
  assert.equal(codeOf(() => resolveRcBaseUrl([])), "RC_URL_UNRESOLVED");
  assert.equal(
    codeOf(() =>
      resolveRcBaseUrl([
        { source: "workflow_input", value: "https://a.vercel.app" },
        { source: "repository_variable", value: "https://b.vercel.app" },
      ]),
    ),
    "RC_URL_AMBIGUOUS",
  );
  const resolved = resolveRcBaseUrl([
    { source: "workflow_input", value: "https://a.vercel.app/" },
    { source: "repository_variable", value: "https://a.vercel.app" },
  ]);
  assert.deepEqual(resolved, { url: "https://a.vercel.app", source: "workflow_input" });
});

test("deployment SHA correlation is asserted, never assumed", () => {
  assert.equal(codeOf(() => assertDeploymentSha("2828f67", undefined)), "SHA_ACTUAL_MISSING");
  assert.equal(codeOf(() => assertDeploymentSha(undefined, "2828f67")), "SHA_EXPECTED_MISSING");
  assert.equal(codeOf(() => assertDeploymentSha("2828f67", "deadbee")), "SHA_MISMATCH");
  assert.equal(assertDeploymentSha("2828f67a3546238cf49487860ec3b588943b3cb1", "2828f67"), "2828f67");
});

test("the viewport matrix is exactly the beta contract", () => {
  assert.deepEqual(
    VIEWPORTS.map((viewport) => [viewport.width, viewport.height]),
    [
      [1440, 1000],
      [1024, 900],
      [768, 1024],
      [390, 844],
    ],
  );
});

test("screenshot names follow <workflow>-<viewport>-<sequence>-<checkpoint>.png", () => {
  assert.equal(screenshotFileName("390", "05", "estimate-reloaded"), "beta-390-05-estimate-reloaded.png");
  const required = expectedScreenshots();
  assert.equal(required.length, VIEWPORTS.length * CHECKPOINTS.filter((c) => c.required).length);
  assert.ok(required.every((entry) => entry.file.startsWith("beta-")));
});

test("PNG dimensions are read from the IHDR chunk", () => {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(390, 16);
  png.writeUInt32BE(844, 20);
  assert.deepEqual(readPngDimensions(png), { width: 390, height: 844 });
  assert.equal(readPngDimensions(Buffer.from("not a png")), null);
});

test("artifact validation rejects missing, empty, and wrong-width screenshots", () => {
  const complete = expectedScreenshots().map((entry) => ({
    file: entry.file,
    bytes: 2048,
    width: entry.expectedWidth,
    height: 800,
  }));
  assert.equal(validateEvidenceSet(complete).ok, true);

  const missingOne = complete.slice(1);
  const missingResult = validateEvidenceSet(missingOne);
  assert.equal(missingResult.ok, false);
  assert.ok(missingResult.failures.some((failure) => failure.code === "MISSING"));

  const zeroByte = complete.map((entry, index) => (index === 0 ? { ...entry, bytes: 0 } : entry));
  assert.ok(validateEvidenceSet(zeroByte).failures.some((failure) => failure.code === "EMPTY"));

  // A desktop screenshot renamed to look like a mobile one must be rejected.
  const resized = complete.map((entry) =>
    entry.file.startsWith("beta-390-") ? { ...entry, width: 1440 } : entry,
  );
  const resizedResult = validateEvidenceSet(resized);
  assert.equal(resizedResult.ok, false);
  assert.ok(resizedResult.failures.some((failure) => failure.code === "WRONG_WIDTH"));
});

test("artifact validation reports a viewport that produced nothing", () => {
  const withoutMobile = expectedScreenshots()
    .filter((entry) => entry.viewport !== "390")
    .map((entry) => ({ file: entry.file, bytes: 100, width: entry.expectedWidth, height: 800 }));
  const result = validateEvidenceSet(withoutMobile);
  assert.ok(result.failures.some((failure) => failure.code === "VIEWPORT_UNREPRESENTED" && failure.file === "390"));
});

test("screenshot truth check rejects login, error, 404, empty, and stuck-loading pages", () => {
  assert.equal(assessScreenshotTruth({ pathname: "/dashboard", bodyText: "Dashboard", checkpoint: "01" }).ok, true);
  assert.equal(assessScreenshotTruth({ pathname: "/login", bodyText: "Sign in", checkpoint: "01" }).ok, false);
  assert.equal(assessScreenshotTruth({ pathname: "/dashboard", bodyText: "", checkpoint: "01" }).ok, false);
  assert.equal(
    assessScreenshotTruth({ pathname: "/x", bodyText: "404: This page could not be found.", checkpoint: "02" }).ok,
    false,
  );
  assert.equal(
    assessScreenshotTruth({ pathname: "/x", bodyText: "Internal Server Error", checkpoint: "02" }).ok,
    false,
  );
  assert.equal(assessScreenshotTruth({ pathname: "/x", bodyText: "Loading TradeOS…", checkpoint: "02" }).ok, false);
});

test("responsive gate flags horizontal overflow with the same tolerance as S027", () => {
  assert.equal(assessResponsiveQuality({ viewport: "390", scrollWidth: 392, clientWidth: 390 }).ok, true);
  const overflow = assessResponsiveQuality({ viewport: "390", scrollWidth: 520, clientWidth: 390 });
  assert.equal(overflow.ok, false);
  assert.match(overflow.problems[0], /horizontal overflow/);
  assert.equal(
    assessResponsiveQuality({ viewport: "768", scrollWidth: 768, clientWidth: 768, obscuredControls: ["Finalize estimate"] }).ok,
    false,
  );
});

// ---------------------------------------------------------------------------
// Workflow and script contract — these keep the guarantees from silently
// regressing the way rc-smoke-contract.test.mjs does for the RC smoke lane.
// ---------------------------------------------------------------------------

const workflow = read(".github/workflows/beta-evidence.yml");
const capture = read("app/scripts/beta-evidence/capture-evidence.mjs");
const authSetup = read("app/scripts/beta-evidence/auth-setup.mjs");
const isolation = read("app/scripts/beta-evidence/tenant-isolation.mjs");
const seedGuard = read("app/db/seed/productionGuard.ts");
const seed = read("app/db/seed/seed.ts");

test("the workflow runs every evidence stage at all four viewports", () => {
  for (const viewport of ["1440", "1024", "768", "390"]) {
    assert.match(workflow, new RegExp(`Capture evidence at ${viewport}px`));
  }
  assert.match(workflow, /node scripts\/beta-evidence\/resolve-rc-target\.mjs/);
  assert.match(workflow, /node scripts\/beta-evidence\/auth-setup\.mjs/);
  assert.match(workflow, /node scripts\/beta-evidence\/tenant-isolation\.mjs/);
  assert.match(workflow, /node scripts\/beta-evidence\/validate-artifacts\.mjs/);
});

test("the workflow is least privilege, serialized, and never continues on error", () => {
  assert.match(workflow, /permissions:\n {2}contents: read/);
  assert.match(workflow, /group: tradeos-beta-evidence/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /set -x/);
});

test("session state is written outside the repository and removed afterwards", () => {
  assert.match(workflow, /BETA_STORAGE_STATE_PATH=\$\{RUNNER_TEMP\}/);
  assert.match(workflow, /Remove runtime storage state/);
  assert.match(workflow, /Scan evidence bundle for credential material/);
  assert.match(authSetup, /is inside the repository/);
  assert.match(authSetup, /chmod\(resolvedStatePath, 0o600\)/);
});

test("evidence capture fails closed without explicit mutation consent", () => {
  assert.match(capture, /BETA_ALLOW_MUTATIONS=true is required/);
  assert.match(capture, /assertApprovedRcUrl/);
  assert.match(capture, /fullPage: false/);
});

test("evidence capture asserts business meaning, not just DOM presence", () => {
  // The shipped estimate formula's outputs, not incidental copy.
  for (const total of ["\\$310\\.89", "\\$5,920\\.89", "\\$6,732\\.00", "\\$7,105\\.07"]) {
    assert.match(capture, new RegExp(total));
  }
  assert.match(capture, /overhead persists across reload/);
  assert.match(capture, /tax rate persists across reload/);
  assert.match(capture, /proposal carries the finalized estimate value/);
  assert.match(capture, /proposal does not show a placeholder price/);
  assert.match(capture, /invoice bills sell price rather than direct cost/);
});

test("tenant isolation treats a readable foreign resource as a release blocker", () => {
  assert.match(isolation, /RELEASE BLOCKER/);
  assert.match(isolation, /deniedByStatus|deniedByRedirect|deniedByNotFoundUi/);
  assert.match(isolation, /at least one of/i);
});

test("the destructive seed refuses to run against production and has no override", () => {
  assert.match(seed, /assertSeedTargetIsNotProduction\(\);/);
  assert.match(seedGuard, /Refusing to run destructive seed against a production target/);
  assert.match(seedGuard, /There is no override flag/);
  // No environment variable or flag may re-enable destructive seeding.
  assert.doesNotMatch(seedGuard, /SEED_ALLOW_DESTRUCTIVE/);
  assert.doesNotMatch(seedGuard, /process\.argv/);
});
