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

import { assertAuthenticatedSmokeTenant } from "../../app/scripts/beta-evidence/lib/tenant-identity.mjs";
import { createdCustomerIdFromUrl } from "../../app/scripts/beta-evidence/lib/customer-detail-url.mjs";
import { matchesReviewedSavedLine, renderedVerifiedRowMatches, reloadEstimateAndRead } from "../../app/scripts/beta-evidence/lib/saved-line-verification.mjs";

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
  const legacySlug = "https://tradeos-costbook-web-git-fix-contracts-09eca2-billykshowalters.vercel.app";
  const currentSlug = "https://tradeos-costbook-ot04eq22u-billykshowalters.vercel.app";
  assert.equal(assertApprovedRcUrl(legacySlug).origin, legacySlug);
  assert.equal(assertApprovedRcUrl(currentSlug).origin, currentSlug);
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

test("project save accepts the projects list or a direct workspace navigation", () => {
  const source = read("app/scripts/beta-evidence/capture-evidence.mjs");
  assert.ok(
    source.includes(
      "await page.waitForURL(/\\/projects(?:\\?|$|\\/(?!new(?:$|[/?]))[^/?]+(?:$|[/?]))/, { timeout: 60_000 });",
    ),
    "post-save wait must accept the projects list or a direct workspace URL, never /projects/new",
  );
  assert.match(source, /const directProjectId = \/\\\/projects\\\/\(\[\^\/\?]\+\)\/\.exec\(postSavePath\)\?\.\[1\];/);
  assert.match(source, /if \(directProjectId && directProjectId !== "new"\) \{/);
  assert.match(
    source,
    /await projectLink\.click\(\);\s*await page\.waitForURL\(\s*new RegExp\(`\/projects\/\$\{projectId\}\(\?:\$\|\[\/\?\]\)`\),\s*\{\s*timeout: 60_000,\s*waitUntil: "commit",\s*\}\s*\);\s*\}\s*await page\.waitForLoadState\("networkidle"\);/,
  );
});

test("staging orchestrator requires the exact staging project for direct and pooler credentials", () => {
  const source = read(".github/workflows/staging-orchestrator.yml");
  assert.ok(source.includes('const directHost = `db.${process.env.STAGING_PROJECT_REF}.supabase.co`;'));
  assert.ok(source.includes('const poolerHost = "aws-0-us-east-2.pooler.supabase.com";'));
  assert.ok(source.includes('poolerUsername.endsWith("." + process.env.STAGING_PROJECT_REF)') ||
    source.includes('poolerUsername.endsWith("."+process.env.STAGING_PROJECT_REF)'));
  assert.ok(source.includes('url.pathname !== "/postgres"'));
  assert.ok(source.includes('!(directMatch || poolerMatch)'));
});

test("staging orchestrator uses a verified session-mode URL only for Prisma migration status", () => {
  const source = read(".github/workflows/staging-orchestrator.yml");
  const start = source.indexOf("- name: Report Prisma migrate status");
  const finish = source.indexOf("- name: Verify app role exists", start);
  assert.ok(start >= 0 && finish > start);
  const step = source.slice(start, finish);
  assert.ok(step.includes("timeout-minutes: 10"));
  assert.ok(step.includes('const poolerHost = "aws-0-us-east-2.pooler.supabase.com";'));
  assert.ok(step.includes('if (pooler) url.port = "5432";'));
  assert.ok(step.includes('url.searchParams.delete("pgbouncer");'));
  assert.ok(step.includes('DATABASE_URL="$DATABASE_URL" npx prisma migrate status || true'));
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
const stagingOrchestrator = read(".github/workflows/staging-orchestrator.yml");
const capture = read("app/scripts/beta-evidence/capture-evidence.mjs");
const runner = read("app/scripts/beta-evidence/run.mjs");
const validator = read("app/scripts/beta-evidence/validate-artifacts.mjs");
const authSetup = read("app/scripts/beta-evidence/auth-setup.mjs");
const isolation = read("app/scripts/beta-evidence/tenant-isolation.mjs");
const s052Role = read("app/scripts/beta-evidence/s052-role-evidence.mjs");
const seedGuard = read("app/db/seed/productionGuard.ts");
const seed = read("app/db/seed/seed.ts");

test("S052 evidence is opt-in, fixture-gated, and cannot pass without explicit role proof", () => {
  assert.match(workflow, /scenario:\s*[\s\S]*default: canonical[\s\S]*- canonical[\s\S]*- s052[\s\S]*- s053/);
  assert.match(workflow, /BETA_S052_ADMIN_EMAIL: \$\{\{ secrets\.BETA_RC_S052_ADMIN_EMAIL \}\}/);
  assert.match(workflow, /BETA_S052_ADMIN_PASSWORD: \$\{\{ secrets\.BETA_RC_S052_ADMIN_PASSWORD \}\}/);
  assert.match(workflow, /BETA_S052_INACTIVE_EMAIL: \$\{\{ secrets\.BETA_RC_S052_INACTIVE_EMAIL \}\}/);
  assert.match(workflow, /BETA_S052_INACTIVE_PASSWORD: \$\{\{ secrets\.BETA_RC_S052_INACTIVE_PASSWORD \}\}/);
  assert.match(workflow, /BETA_RC_S052_ADMIN_EMAIL and BETA_RC_S052_ADMIN_PASSWORD are required for the s052 admin happy-path evidence/);
  assert.match(workflow, /BETA_RC_S052_INACTIVE_EMAIL and BETA_RC_S052_INACTIVE_PASSWORD are required for the s052 inactive-membership denial/);
  assert.match(workflow, /BETA_RC_FOREIGN_CUSTOMER_ID and BETA_RC_FOREIGN_PROJECT_ID are both required for the s052 cross-tenant evidence/);
  assert.match(workflow, /node scripts\/beta-evidence\/s052-role-evidence\.mjs/);
  assert.equal((workflow.match(/HAS_S052_ADMIN_EMAIL:/g) ?? []).length, 1);
  assert.equal((workflow.match(/BETA_SCENARIO" = "s052"/g) ?? []).length, 2);
  assert.match(runner, /--scenario=<canonical\|s052\|s053\|beta_pdf>/);
  assert.match(runner, /\["s052", "s053", "beta_pdf"\]\.includes\(scenario\) \? "true"/);
  assert.match(runner, /S052 admin and inactive-membership evidence/);
  assert.match(capture, /\["canonical", "s052", "s053", "beta_pdf"\]\.includes\(scenario\)/);
  assert.match(capture, /S052 smoke identity is the owner role/);
  assert.match(capture, /s052-customer-created/);
  assert.match(capture, /s052-customer-service-address/);
  assert.match(capture, /s052-project-reloaded/);
  assert.match(capture, /duplicate advice points to the existing customer without silently merging/);
  assert.match(capture, /customer project fields survive workspace reload/);
  assert.ok(capture.includes('`/projects/new?customerId=${encodeURIComponent(customerId)}`'));
  assert.ok(capture.includes('page.locator(\'form [name="customerId"]\')'));
  assert.match(capture, /customerLinkType === "customer-context"/);
  assert.match(capture, /element\.tagName === "SELECT"[\s\S]*\? "customer-selector"/);
  assert.match(capture, /linkedCustomerId === customerId/);
  assert.match(capture, /project creation carries the exact server-created customer/);
  assert.match(capture, /S052 uses the resolved customer-context form/);
  assert.match(capture, /project persists the selected customer/);
  assert.match(capture, /beforeReload\.body\?\.customerId === customerId/);
  assert.doesNotMatch(capture, /selectOption\(customerId\)/);
  assert.match(capture, /saved service address is carried into project creation/);
  assert.ok(capture.includes('select[name="siteAddress"]'));
  assert.ok(capture.includes('input[name="siteAddress"]'));
  assert.match(capture, /beforeReload\.body\?\.siteAddress === expectedProjectSiteAddress/);
  assert.match(capture, /afterReload\.body\?\.siteAddress === expectedProjectSiteAddress/);
  assert.match(capture, /data-s052-submit-count/);
  assert.match(capture, /invalidSubmitCount === 0/);
  assert.doesNotMatch(capture, /waitForTimeout\(150\)/);
  assert.match(s052Role, /requiredRoleViewportNames = \["1440", "768", "390"\]/);
  assert.doesNotMatch(s052Role, /BETA_S052_ROLE_VIEWPORTS/);
  assert.match(s052Role, /browser\.close\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(s052Role, /settings\?\.currentRole !== "admin"/);
  assert.match(s052Role, /s052-admin/);
  assert.match(s052Role, /Authenticated user is not provisioned in this organization/);
  assert.match(s052Role, /bootstrapDenied: true/);
  assert.match(validator, /scenario === "s052"/);
  assert.match(validator, /s052-role-report\.json/);
  assert.match(validator, /S052 role report is stale or belongs to another run/);
  assert.match(validator, /S052 certification requires exact SHA correlation/);
  assert.match(validator, /foreign customer/);
  assert.match(validator, /foreign project/);
  assert.match(validator, /S052 smoke identity is the owner role/);
  assert.match(validator, /inactive-membership bootstrap denial was not proven/);
  assert.match(validator, /s052-customer-created/);
  assert.match(validator, /s052-customer-service-address/);
  assert.match(validator, /s052-project-reloaded/);
  assert.match(validator, /s052-admin/);
});

test("canonical evidence navigates focused estimate stages at 390/768 and checks active step", () => {
  assert.match(capture, /async function navigateEstimateStage\(stage\)/);
  assert.match(capture, /getByRole\("navigation", \{ name: "Estimate stages" \}\)/);
  assert.match(capture, /viewport\.width >= 1024/);
  assert.match(capture, /getAttribute\("aria-current"\)\) === "step"/);
  assert.match(capture, /navigateEstimateStage\("Items"\)/);
  assert.match(capture, /navigateEstimateStage\("Price"\)/);
  assert.match(capture, /navigateEstimateStage\("Review"\)/);
  assert.match(capture, /getByRole\("link", \{ name: "Review proposal draft", exact: true \}\)/);
  assert.doesNotMatch(capture, /Create proposal\|Review proposal draft/);
  assert.match(capture, /runS053Certification\(projectId, estimateId\);[\s\S]*page\.goto/);
});

test("canonical beta evidence verifies persisted Costbook-independent line costs and proposal total", () => {
  assert.match(capture, /saved estimate retains both explicit reviewed work items/);
  assert.match(capture, /saved direct line costs match the authoritative Estimate Engine snapshots/);
  assert.match(capture, /savedAfterAdd\.subtotalCost/);
  assert.match(capture, /Estimate Engine persists finalized status and customer total/);
  assert.match(capture, /finalizedEstimate\.status === "ready"/);
  assert.match(capture, /async function readProposalDetail\(proposalId\)/);
  assert.match(capture, /\/api\/proxy\/proposals\//);
  assert.match(capture, /proposal snapshots selected finalized Estimate identity and exact fixed total/);
  assert.match(capture, /savedProposal\.estimateId === estimateId/);
  assert.match(capture, /savedProposal\.finalPrice/);
  // The evidence runner must continue refusing production and unproven tenants.
  assert.match(capture, /assertApprovedRcUrl\(baseUrlInput\)/);
  assert.match(capture, /BETA_ALLOW_MUTATIONS=true is required/);
});

test("post-markup rendered total settles on Review before it is asserted", () => {
  // Regression guard for the run-41289571105 failure: the markup save is
  // learned by the builder only via mutation onSuccess -> invalidate ->
  // async React Query refetch, and stage navigation awaits aria-current,
  // not the refetched data. A bare innerText read after navigating to
  // Review races that refetch and sees the stale pre-markup snapshot.
  // The rendered-text check must therefore wait for the marked-up total
  // to appear in visible text before the assertion reads it.
  const markupBlock = capture.slice(capture.indexOf('"markup apply lands the marked-up total"'));
  const reviewNav = markupBlock.indexOf('navigateEstimateStage("Review")');
  const totalAssert = markupBlock.indexOf('"post-markup total matches the shipped formula"');
  const settle = markupBlock.indexOf("waitForFunction", reviewNav);
  assert.ok(reviewNav !== -1 && settle !== -1 && totalAssert !== -1, "expected the markup Review navigation, settle wait, and total assertion");
  assert.ok(reviewNav < settle && settle < totalAssert, "expected the settle wait between the markup Review navigation and the post-markup total assertion");
  assert.match(markupBlock.slice(settle, totalAssert), /\$7,105\.07/);
  assert.doesNotMatch(markupBlock.slice(reviewNav, settle), /innerText\(\)/);
  // The ordering check alone would still pass if the wait lost its
  // `await` (the following read would then race the refetch again), so
  // pin the awaited call itself.
  assert.match(
    markupBlock.slice(reviewNav, settle + "waitForFunction".length),
    /await\s+page\.waitForFunction/,
    "expected the settle wait to be awaited",
  );
});

test("finalize ready wait is scoped to the Estimate workflow region", () => {
  // Regression guard for the run-41359082129 failure: the builder renders
  // the estimate status badge twice (page-header actions row + Review-stage
  // "Internal estimate review" panel), so a bare getByText("ready") wait
  // after Finalize estimate trips Playwright strict mode. The wait must be
  // scoped to the Estimate workflow region, which selects the Review-stage
  // badge adjacent to the finalize flow.
  const finalizeBlock = capture.slice(capture.indexOf('getByRole("button", { name: "Finalize estimate" })'));
  const checkpoint06 = finalizeBlock.indexOf('await checkpoint("06"');
  assert.ok(checkpoint06 !== -1, "expected the finalize step to end at checkpoint 06");
  const regionWait = finalizeBlock.indexOf('getByRole("region", { name: "Estimate workflow" })');
  assert.ok(regionWait !== -1 && regionWait < checkpoint06, "expected a region-scoped wait in the finalize step");
  assert.match(
    finalizeBlock.slice(regionWait, checkpoint06),
    /^getByRole\("region", \{ name: "Estimate workflow" \}\)\s*\.getByText\("ready", \{ exact: true \}\)\.waitFor/,
    "expected the finalize ready wait to be scoped to the Estimate workflow region",
  );
  assert.doesNotMatch(
    finalizeBlock.slice(0, checkpoint06),
    /await page\.getByText\("ready"/,
    "expected no bare ready wait in the finalize step",
  );
});

test("invoice total read is scoped to the Invoice financial summary section", () => {
  // Regression guard for the run-41377520305 failure: the invoice page
  // renders no bare "Total" label, and "Invoice total" renders twice
  // (financial-summary metric + totals-block row), so a bare
  // getByText("Total") read can never resolve and a bare
  // getByText("Invoice total") read would trip Playwright strict mode.
  // The read must be scoped to the Invoice financial summary section,
  // whose MoneyMetric parent div carries the value alongside the label.
  const invoiceBlock = capture.slice(capture.indexOf('invoice resolves an id'));
  const checkpoint08 = invoiceBlock.indexOf('await checkpoint("08"');
  assert.ok(checkpoint08 !== -1, "expected the invoice step to end at checkpoint 08");
  const sectionRead = invoiceBlock.indexOf('page.locator(\'section[aria-label="Invoice financial summary"]\')');
  assert.ok(sectionRead !== -1 && sectionRead < checkpoint08, "expected a section-scoped read in the invoice step");
  assert.match(
    invoiceBlock.slice(sectionRead, checkpoint08),
    /^page\.locator\('section\[aria-label="Invoice financial summary"\]'\)\.getByText\("Invoice total", \{ exact: true \}\)\.locator\("\.\."\)\.innerText/,
    "expected the invoice total read to be scoped to the Invoice financial summary section",
  );
  assert.doesNotMatch(
    invoiceBlock.slice(0, checkpoint08),
    /await page\.getByText\("Total"/,
    "expected no bare Total read in the invoice step",
  );
});

test("beta capture waits for the persisted Customer UUID rather than matching /customers/new", () => {
  const uuid = "1643d999-509c-4742-8d68-46c6a9129d55";
  const origin = "https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app";
  assert.equal(createdCustomerIdFromUrl(`${origin}/customers/new`), null);
  assert.equal(createdCustomerIdFromUrl(`${origin}/customers`), null);
  assert.equal(createdCustomerIdFromUrl(`${origin}/customers/not-a-uuid`), null);
  assert.equal(createdCustomerIdFromUrl(`${origin}/customers/${uuid}/edit`), null);
  assert.equal(createdCustomerIdFromUrl("not a URL"), null);
  assert.equal(createdCustomerIdFromUrl(`${origin}/customers/${uuid}`), uuid);
  assert.equal(createdCustomerIdFromUrl(`${origin}/customers/${uuid}?tab=projects`), uuid);
  assert.match(capture, /waitForURL\(\(url\) => createdCustomerIdFromUrl\(url\) !== null/);
  assert.match(capture, /const customerId = createdCustomerIdFromUrl\(page\.url\(\)\)/);
});

test("S053 evidence is opt-in and defaults do not change the canonical beta flow", () => {
  assert.match(workflow, /scenario:\s*[\s\S]*default: canonical[\s\S]*- canonical[\s\S]*- s052[\s\S]*- s053/);
  assert.match(workflow, /BETA_SCENARIO: \$\{\{ inputs\.scenario \}\}/);
  assert.match(workflow, /BETA_RC_FOREIGN_ESTIMATE_ID is required for the s053 scenario/);
  assert.match(workflow, /BETA_REQUIRE_SHA_CORRELATION: \$\{\{ inputs\.scenario == 's052' \|\| inputs\.scenario == 's053' \|\| inputs\.scenario == 'beta_pdf' \|\| inputs\.require_sha_correlation \}\}/);
  assert.match(runner, /--scenario=<canonical\|s052\|s053\|beta_pdf>/);
  assert.match(runner, /const scenario = flagValue\("scenario"\) \|\| process\.env\.BETA_SCENARIO \|\| "canonical"/);
  assert.match(runner, /BETA_REQUIRE_SHA_CORRELATION: \["s052", "s053", "beta_pdf"\]\.includes\(scenario\) \? "true"/);
  assert.match(capture, /const scenario = process\.env\.BETA_SCENARIO \|\| "canonical"/);
  assert.match(capture, /if \(scenario === "s053" \|\| scenario === "beta_pdf"\)/);
});

test("S053 browser evidence cleans run-created lines even when post-apply assertions fail", () => {
  assert.match(capture, /try \{[\s\S]*page\.waitForResponse\([\s\S]*applyButton\.click\(\)[\s\S]*\} finally \{/);
  assert.match(capture, /filter\(\(item\) => !baselineIds\.has\(item\.id\)\)/);
  assert.match(capture, /deleteEvidenceLineItems\(estimateId, leftoverIds\)\.catch\(\(\) => \{\}\)/);
});

test("S053 browser evidence proves review-first behavior before an explicit apply", () => {
  assert.match(capture, /s053-setup-required/);
  assert.match(capture, /s053-athena-review/);
  assert.match(capture, /s053-athena-applied/);
  assert.match(capture, /unmapped Athena scope fails safe as setup required/);
  assert.match(capture, /setup-required Athena draft does not write estimate lines/);
  assert.match(capture, /setup-required Athena draft cannot be applied/);
  assert.match(isolation, /foreign S053 Athena draft/);
  assert.match(isolation, /foreign S053 Athena apply/);
  assert.match(isolation, /ai-estimator\/draft/);
  assert.match(isolation, /ai-estimator\/apply/);
  assert.match(capture, /Athena generation and local acceptance do not silently write estimate lines/);
  assert.match(capture, /explicit Athena apply persists at least one reviewed estimate line/);
  assert.match(capture, /pricing refreshes after the reviewed Athena apply/);
  assert.match(capture, /reviewed Athena saved-line IDs survive an authenticated hard reload/);
  assert.match(capture, /Documented source\|Unverified pricing\|Placeholder pricing/);
});

test("S053 scenario validation requires its Athena checkpoints and passing assertions", () => {
  assert.match(validator, /scenario === "s053"/);
  assert.match(validator, /s053-setup-required/);
  assert.match(validator, /s053-athena-review/);
  assert.match(validator, /s053-athena-applied/);
  assert.match(validator, /scenarioFailures/);
  assert.match(validator, /S053 certification requires exact SHA correlation/);
  assert.match(validator, /foreign S053 Athena draft/);
  assert.match(validator, /foreign S053 Athena apply/);
  assert.match(validator, /scenario screenshot/);
  assert.match(validator, /Scenario evidence/);
});

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

  // The repository variable reaches the resolver under a different name than
  // the workflow input, and they must not be conflated.
  assert.match(workflow, /BETA_RC_BASE_URL_VARIABLE: \$\{\{ vars\.BETA_RC_BASE_URL \}\}/);
  assert.match(doc, /BETA_RC_BASE_URL_VARIABLE/);

  // Every row must sit inside the table and carry the header's column count.
  // Inserting prose mid-table orphans the rows that follow: a renderer then
  // shows them as literal pipe text rather than table rows.
  const lines = doc.slice(doc.indexOf("| GitHub secret / variable")).split("\n");
  const rows = [];
  for (const line of lines) {
    if (!line.startsWith("|")) break;
    rows.push(line);
  }
  const widths = new Set(rows.map((row) => row.split("|").length));
  assert.equal(widths.size, 1, `secrets table rows have inconsistent column counts: ${[...widths].join(", ")}`);

  // Every documented name must be inside that contiguous block, not stranded
  // after a paragraph further down.
  for (const name of [
    "BETA_RC_SMOKE_EMAIL",
    "BETA_RC_FOREIGN_ESTIMATE_ID",
    "BETA_RC_BASE_URL_VARIABLE",
    "BETA_RC_DEPLOYMENT_URL",
    "BETA_RC_DEPLOYMENT_SHA",
  ]) {
    assert.ok(
      rows.some((row) => row.includes(name)),
      `${name} is documented outside the secrets table, so it will not render as a table row`,
    );
  }
});

test("smoke tenant verification requires canonical authenticated Settings identity", () => {
  const orgId = "9814bd72-626a-42f4-8871-cd755cb9d685";
  const otherId = "00000000-0000-4000-8000-000000000001";
  const good = { orgId, settings: { companyName: "TradeOS Beta Smoke" } };
  assert.equal(assertAuthenticatedSmokeTenant(good, "TradeOS Beta Smoke"), orgId);
  assert.equal(assertAuthenticatedSmokeTenant(
    { orgId, settings: { companyName: "Custom brand" } },
    "TradeOS Beta Smoke", orgId,
  ), orgId);
  assert.throws(() => assertAuthenticatedSmokeTenant(
    { orgId: otherId, settings: { companyName: "TradeOS Beta Smoke" } },
    "TradeOS Beta Smoke", orgId,
  ), /organization ID does not match/);
  assert.throws(() => assertAuthenticatedSmokeTenant(
    { orgId: otherId, settings: { companyName: "Other Organization" } },
    "TradeOS Beta Smoke",
  ), /organization name does not match/);
  assert.throws(() => assertAuthenticatedSmokeTenant(
    { settings: { companyName: "TradeOS Beta Smoke" } }, "TradeOS Beta Smoke",
  ), /valid organization identity/);
  assert.throws(() => assertAuthenticatedSmokeTenant(
    { orgId, settings: { companyName: "Other Organization" } }, "",
  ), /label is required/);
  assert.match(authSetup, /assertAuthenticatedSmokeTenant\(await response\.json\(\), expectedOrg, expectedOrgId\)/);
  assert.doesNotMatch(authSetup, /settingsText\.includes\(expectedOrg\)/);
});

test("staging beta evidence pins the canonical smoke UUID and forwards it to the authenticator", () => {
  assert.match(stagingOrchestrator, /smoke_org_id:\s+9814bd72-626a-42f4-8871-cd755cb9d685/);
  assert.match(workflow, /smoke_org_id:\s+[\s\S]*?type: string/);
  assert.match(workflow, /BETA_SMOKE_ORG_ID: \$\{\{ inputs\.smoke_org_id \}\}/);
  assert.match(authSetup, /expectedOrgId = process\.env\.BETA_SMOKE_ORG_ID/);
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
  // The shipped estimate formula's outputs, not incidental copy. The
  // customer-facing totals are asserted against rendered text; the tax
  // figure and the marked-up pre-tax figure are asserted against the
  // authoritative estimate API because neither is visible text at every
  // width on the builder this run targets (the tax figure has no visible
  // row on the Price stage and the pre-tax header row is hidden below lg).
  for (const total of ["\\$5,920\\.89", "\\$7,105\\.07"]) {
    assert.match(capture, new RegExp(total));
  }
  assert.match(capture, /taxAmount\) - 310\.89/);
  assert.match(capture, /preTaxTotalPrice\) - 6732\.00/);
  assert.match(capture, /overhead persists across reload/);
  assert.match(capture, /tax rate persists across reload/);
  assert.match(capture, /proposal carries the finalized estimate value/);
  assert.match(capture, /proposal does not show a placeholder price/);
  assert.match(capture, /invoice bills sell price rather than direct cost/);
});

test("S053 saved-line evidence compares the persisted row with the reviewed request", async () => {
  const acknowledgement = {
    draftLineItemId: "draft-1",
    lineItemId: "line-1",
    description: "Deck framing",
    quantity: 1.2346,
  };
  const reviewed = {
    status: "accepted",
    targetKind: "assembly",
    targetId: "assembly-1",
    description: " Deck framing ",
    quantity: 1.23456,
  };
  const saved = {
    id: "line-1",
    assemblyId: "assembly-1",
    costItemId: null,
    description: "Deck framing",
    quantity: 1.2346,
  };

  assert.equal(matchesReviewedSavedLine({ acknowledgement, reviewed, saved }), true);
  assert.equal(matchesReviewedSavedLine({
    acknowledgement,
    reviewed: { ...reviewed, targetKind: "costItem", targetId: "cost-1" },
    saved: { ...saved, assemblyId: null, costItemId: "cost-1" },
  }), true);
  assert.equal(renderedVerifiedRowMatches("Deck framing\\n1.2346 LF · saved line matched the reviewed assembly", acknowledgement), true);
  assert.equal(renderedVerifiedRowMatches("Different line\\n1.2346 LF", acknowledgement), false);
  assert.equal(renderedVerifiedRowMatches("Deck framing\\n11.2346 LF", acknowledgement), false);
  assert.equal(matchesReviewedSavedLine({ acknowledgement, reviewed, saved: { ...saved, assemblyId: "other" } }), false);
  assert.equal(matchesReviewedSavedLine({ acknowledgement, reviewed, saved: { ...saved, description: "Other" } }), false);
  assert.equal(matchesReviewedSavedLine({ acknowledgement, reviewed, saved: { ...saved, quantity: 1.2345 } }), false);

  // A blank reviewed label uses the backend-effective acknowledgement label,
  // which the saved detail must preserve.
  assert.equal(matchesReviewedSavedLine({
    acknowledgement,
    reviewed: { ...reviewed, description: " " },
    saved,
  }), true);

  const calls = [];
  const afterReload = await reloadEstimateAndRead({
    page: { reload: async (options) => calls.push(options) },
    estimateId: "estimate-1",
    readEstimateDetail: async (id) => ({ id, lineItems: [saved] }),
  });
  assert.equal(calls.length, 1, "the exercised helper must perform a hard reload");
  assert.deepEqual(calls[0], { waitUntil: "networkidle", timeout: 60_000 });
  assert.equal(afterReload.id, "estimate-1");
});

test("S053 authenticated Estimate evidence reconciles saved line identity through reload", () => {
  assert.match(capture, /Saved line verification/);
  assert.match(capture, /row\.isVisible\(\)/);
  assert.match(capture, /renderedVerifiedRowMatches/);
  assert.match(capture, /matchesReviewedSavedLine/);
  assert.match(capture, /reloadEstimateAndRead/);
  assert.match(capture, /reviewed Apply acknowledgement succeeds/);
  assert.match(capture, /acknowledgement\.applied/);
  assert.match(capture, /acknowledgement\.skipped\.filter\(\(line\) => line\.lineItemId/);
  assert.match(capture, /matches the authenticated review/);
  assert.match(capture, /reviewed Athena saved-line IDs survive an authenticated hard reload/);
  assert.match(capture, /keeps reviewed identity and target/);
  assert.match(isolation, /name: "foreign estimate"/);
  assert.match(isolation, /method: "GET"/);
  assert.match(isolation, /apiRoute: `\/api\/proxy\/estimates\/\$\{foreignEstimateId\}`/);
  assert.match(isolation, /const deniedByApi = apiStatus === 403 \|\| apiStatus === 404/);
  assert.match(isolation, /!deniedByApi/);
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
  // An Estimate id alone must execute the authenticated API denial probe.
  assert.match(workflow, /A foreign customer.*BETA_RC_FOREIGN_ESTIMATE_ID/);
  assert.match(isolation, /foreignEstimateId[\s\S]*route: foreignProjectId/);
  assert.doesNotMatch(isolation, /foreignEstimateId && foreignProjectId/);
  assert.match(workflow, /HAS_FOREIGN_RESOURCE/);
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
