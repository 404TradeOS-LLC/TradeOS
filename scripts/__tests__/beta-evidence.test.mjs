import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  StorageStatePathError,
  assertStorageStatePathOutsideRepo,
} from "../../app/scripts/beta-evidence/lib/storage-state-path.mjs";

import {
  PRODUCTION_SUPABASE_REF,
  RcTargetError,
  assertApprovedRcUrl,
  assertDeploymentSha,
  assertEnvironmentIdentity,
  assertNonProductionDataPlane,
  deriveEnvironmentFromUrl,
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
  selectViewports,
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
  // Only the origin is carried forward, so a path would be silently dropped.
  assert.equal(
    codeOf(() => assertApprovedRcUrl("https://tradeos-costbook-web-abc123.vercel.app/path")),
    "RC_URL_NOT_ORIGIN",
  );
});

test("a malformed RC URL is never echoed back, because it may carry credentials", () => {
  const secret = "https://user:hunter2@[";
  try {
    assertApprovedRcUrl(secret);
    assert.fail("expected a throw");
  } catch (error) {
    assert.equal(error.code, "RC_URL_MALFORMED");
    assert.doesNotMatch(error.message, /hunter2/);
    assert.doesNotMatch(error.message, /user:/);
  }
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

  // Ambiguity is reported before the candidates are validated, so the values
  // may still carry userinfo and must not reach the message.
  try {
    resolveRcBaseUrl([
      { source: "workflow_input", value: "https://user:hunter2@a.vercel.app" },
      { source: "repository_variable", value: "https://b.vercel.app" },
    ]);
    assert.fail("expected ambiguity to throw");
  } catch (error) {
    assert.equal(error.code, "RC_URL_AMBIGUOUS");
    assert.doesNotMatch(error.message, /hunter2/);
    assert.doesNotMatch(error.message, /user:/);
    // The sources are still named, so the operator can tell which to fix.
    assert.match(error.message, /workflow_input/);
    assert.match(error.message, /repository_variable/);
  }
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

test("the environment is derived from the deployment host, not from the operator's claim", () => {
  assert.equal(
    deriveEnvironmentFromUrl("https://tradeos-costbook-web-git-fix-abc123-billykshowalters.vercel.app"),
    "preview",
  );
  assert.equal(
    deriveEnvironmentFromUrl("https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app"),
    "staging",
  );
  assert.equal(deriveEnvironmentFromUrl("https://app.404tradeos.com"), "production");
  assert.equal(deriveEnvironmentFromUrl("https://tradeos-costbook-web.vercel.app"), "production");
  assert.equal(codeOf(() => deriveEnvironmentFromUrl("https://example.com")), "ENV_UNDERIVABLE");

  // A preview deployment declared as staging must be rejected; before the
  // actual side was derived, this comparison could never fail.
  assert.equal(
    codeOf(() =>
      assertEnvironmentIdentity(
        "staging",
        deriveEnvironmentFromUrl("https://tradeos-costbook-web-git-fix-abc123-billykshowalters.vercel.app"),
      ),
    ),
    "ENV_MISMATCH",
  );
});

test("validation can be scoped to a viewport subset without demanding the full matrix", () => {
  const mobileOnly = selectViewports(["390"]);
  assert.equal(mobileOnly.length, 1);
  assert.equal(selectViewports([]).length, VIEWPORTS.length);
  assert.throws(() => selectViewports(["999"]));

  const captured = expectedScreenshots({ viewports: mobileOnly }).map((entry) => ({
    file: entry.file,
    bytes: 512,
    width: entry.expectedWidth,
    height: 844,
  }));
  // Scoped to 390 this is complete; against the full matrix it is not.
  assert.equal(validateEvidenceSet(captured, { viewports: mobileOnly }).ok, true);
  assert.equal(validateEvidenceSet(captured).ok, false);
});

test("storage state may not be written inside the repository, even through a symlink", async () => {
  const repoRoot = process.cwd();
  const scratch = await fsp.mkdtemp(path.join(os.tmpdir(), "beta-evidence-symlink-"));

  try {
    // A genuinely external path is fine.
    const external = path.join(scratch, "state.json");
    assert.equal(typeof (await assertStorageStatePathOutsideRepo(external, repoRoot)), "string");

    // A directly-inside path is refused.
    await assert.rejects(
      () => assertStorageStatePathOutsideRepo(path.join(repoRoot, "app", "state.json"), repoRoot),
      (error) => error instanceof StorageStatePathError,
    );

    // path.resolve is lexical, so a symlinked directory pointing back into the
    // repository looks external but writes into the working tree. It must be
    // refused on the real location, not the lexical one.
    const link = path.join(scratch, "into-repo");
    await fsp.symlink(path.join(repoRoot, "app"), link, "dir");
    const throughSymlink = path.join(link, "leaked-state.json");

    // Confirm the naive lexical check would have allowed it, so this test keeps
    // testing the thing it is named after.
    const lexical = path.resolve(throughSymlink);
    assert.ok(!lexical.startsWith(`${repoRoot}${path.sep}`), "expected the lexical path to look external");

    await assert.rejects(
      () => assertStorageStatePathOutsideRepo(throughSymlink, repoRoot),
      (error) => {
        assert.ok(error instanceof StorageStatePathError);
        assert.match(error.message, /symbolic link into the repository/);
        return true;
      },
    );
  } finally {
    await fsp.rm(scratch, { recursive: true, force: true });
  }
});

test("a storage state path whose parent does not exist yet is still checked", async () => {
  const repoRoot = process.cwd();
  // Nothing along this path exists; the nearest existing ancestor is what
  // decides, and it is outside the repository.
  const resolved = await assertStorageStatePathOutsideRepo(
    path.join(os.tmpdir(), "beta-evidence-missing", "deeper", "state.json"),
    repoRoot,
  );
  assert.ok(!resolved.startsWith(`${repoRoot}${path.sep}`));
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

test("a failed run still clears session state, so cleanup is not truncated", () => {
  const run = read("app/scripts/beta-evidence/run.mjs");
  // process.exit() terminates before an awaited finally completes, which would
  // leave an authenticated session on disk after a failed run.
  assert.doesNotMatch(run, /process\.exit\(1\)/);
  assert.match(run, /process\.exitCode = 1/);
  assert.match(run, /rm\(storageStatePath, \{ force: true \}\)/);
});

test("a capture report without a run id is not trusted", () => {
  const validator = read("app/scripts/beta-evidence/validate-artifacts.mjs");
  // Requiring equality (rather than `report.runId && ...`) means a missing id
  // is stale too, instead of bypassing the check.
  assert.match(validator, /expectedRunId && report\.runId !== expectedRunId/);
  assert.doesNotMatch(validator, /report\.runId && report\.runId !== expectedRunId/);
});

test("the documented secret names map to the runtime names the scripts read", () => {
  const doc = read("docs/testing/BETA_EVIDENCE.md");
  const isolation = read("app/scripts/beta-evidence/tenant-isolation.mjs");
  const workflow = read(".github/workflows/beta-evidence.yml");

  // The scripts read the unprefixed names; the workflow maps the secrets onto
  // them. The doc must show both so neither side is set by mistake.
  assert.match(isolation, /process\.env\.BETA_FOREIGN_PROJECT_ID/);
  assert.match(workflow, /BETA_FOREIGN_PROJECT_ID: \$\{\{ secrets\.BETA_RC_FOREIGN_PROJECT_ID \}\}/);
  assert.match(doc, /\| GitHub secret \/ variable \| Runtime variable \|/);
  assert.match(doc, /`BETA_RC_FOREIGN_PROJECT_ID` \| `BETA_FOREIGN_PROJECT_ID`/);
});

test("the tenant assertion cannot be skipped and mutation consent is never implicit", () => {
  // An unset organization label previously recorded the tenant check as passed.
  assert.match(authSetup, /BETA_SMOKE_ORG_LABEL/);
  assert.match(authSetup, /tenant assertion cannot be skipped/);
  assert.doesNotMatch(authSetup, /tenant assertion skipped/);

  // An unset BETA_ALLOW_MUTATIONS previously defaulted to "true".
  const run = read("app/scripts/beta-evidence/run.mjs");
  assert.doesNotMatch(run, /BETA_ALLOW_MUTATIONS \?\? "true"/);
  assert.match(run, /hasFlag\("allow-mutations"\) \|\| process\.env\.BETA_ALLOW_MUTATIONS === "true"/);
  // Each run starts from an empty evidence directory.
  assert.match(run, /rm\(evidenceDir, \{ recursive: true, force: true \}\)/);
});

test("third-party actions are pinned to an immutable commit", () => {
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7\.0\.1/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact@v7\s*$/m);
});

test("session state is written outside the repository and removed afterwards", () => {
  assert.match(workflow, /BETA_STORAGE_STATE_PATH=\$\{RUNNER_TEMP\}/);
  assert.match(workflow, /Remove runtime storage state/);
  assert.match(workflow, /Scan evidence bundle for credential material/);
  assert.match(authSetup, /assertStorageStatePathOutsideRepo/);
  assert.match(authSetup, /chmod\(resolvedStatePath, 0o600\)/);
  // The containment check must not be purely lexical.
  const storageStatePath = read("app/scripts/beta-evidence/lib/storage-state-path.mjs");
  assert.match(storageStatePath, /realpath/);
  assert.match(storageStatePath, /symbolic link into the repository/);
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

test("the evidence bundle is never uploaded after the credential scan rejects it", () => {
  assert.match(workflow, /id: credential_scan/);
  assert.match(workflow, /steps\.credential_scan\.outcome == 'success'/);
});

test("tenant isolation refuses to report PASS without a probeable resource", () => {
  assert.match(isolation, /No tenant-isolation probe could be constructed/);
  assert.match(isolation, /refusing to report PASS/i);
  // An estimate id alone is not probeable, so the workflow must not accept it.
  assert.match(workflow, /BETA_RC_FOREIGN_PROJECT_ID or BETA_RC_FOREIGN_CUSTOMER_ID is required/);
});

test("the workflow declares only the expected environment and derives the actual one", () => {
  assert.match(workflow, /BETA_EXPECTED_ENVIRONMENT: \$\{\{ inputs\.target_environment \}\}/);
  assert.doesNotMatch(workflow, /BETA_ACTUAL_ENVIRONMENT: \$\{\{ inputs\.target_environment \}\}/);
});

test("the destructive seed refuses to run against production and has no override", () => {
  assert.match(seed, /assertSeedTargetIsNotProduction\(\);/);
  assert.match(seedGuard, /Refusing to run destructive seed against a production target/);
  assert.match(seedGuard, /There is no override flag/);
  // Pooler URLs hide the project ref in the username, so the hostname alone is
  // not a sufficient production check.
  assert.match(seedGuard, /extractSupabaseProjectRef/);
  assert.match(seedGuard, /could not be determined/);
  // No environment variable or flag may re-enable destructive seeding.
  assert.doesNotMatch(seedGuard, /SEED_ALLOW_DESTRUCTIVE/);
  assert.doesNotMatch(seedGuard, /process\.argv/);
});
