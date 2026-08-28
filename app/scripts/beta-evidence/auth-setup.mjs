// Phase 9/10 — generate authenticated Playwright storage state at runtime by
// driving the real login form, then prove the resulting session is genuinely
// authenticated before any evidence depends on it.
//
// This replaces the previous model where a human baked a storage state out of
// band and pasted it into a base64 CI secret. Nothing durable is written to the
// repository: storage state is created under a caller-supplied path (a runner
// temp dir in CI) with owner-only permissions.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertApprovedRcUrl } from "./lib/rc-target.mjs";

const baseUrlInput = process.env.BETA_RC_BASE_URL_RESOLVED;
const email = process.env.BETA_SMOKE_EMAIL;
const password = process.env.BETA_SMOKE_PASSWORD;
const storageStatePath = process.env.BETA_STORAGE_STATE_PATH;
const expectedOrg = process.env.BETA_SMOKE_ORG_LABEL;
const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";

// Startup misconfiguration should read as one actionable line, not a stack
// trace, so CI logs name the phase and the fix.
function startupFailure(message) {
  console.error(`::error::[auth-setup] ${message}`);
  process.exit(1);
}

function requireEnv(value, name, guidance) {
  if (!value || String(value).trim() === "") {
    startupFailure(`${name} is required. ${guidance}`);
  }
  return String(value);
}

requireEnv(baseUrlInput, "BETA_RC_BASE_URL_RESOLVED", "Run resolve-rc-target.mjs first.");
requireEnv(email, "BETA_SMOKE_EMAIL", "Provision a dedicated RC smoke identity and expose it as a secret.");
requireEnv(password, "BETA_SMOKE_PASSWORD", "Provision a dedicated RC smoke identity and expose it as a secret.");
requireEnv(storageStatePath, "BETA_STORAGE_STATE_PATH", "Point this at a runner temp path, never at the repository.");

let parsedBaseUrl;
try {
  parsedBaseUrl = assertApprovedRcUrl(baseUrlInput);
} catch (error) {
  startupFailure(error.message);
}

// A storage state written inside the working tree would be one `git add -A`
// away from committing a live session. Refuse outright.
const resolvedStatePath = path.resolve(storageStatePath);
// Derive the repository root from this file's own location
// (<repo>/app/scripts/beta-evidence/auth-setup.mjs) rather than from cwd, so
// the check is correct no matter which directory the script is invoked from.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
if (resolvedStatePath === repoRoot || resolvedStatePath.startsWith(`${repoRoot}${path.sep}`)) {
  startupFailure(
    `BETA_STORAGE_STATE_PATH (${resolvedStatePath}) is inside the repository. ` +
      "Authenticated session material must be written outside the working tree.",
  );
}

await fs.mkdir(outDir, { recursive: true });

const steps = [];
function record(name, passed, detail) {
  steps.push({ name, passed, ...(detail ? { detail } : {}) });
}

const browser = await chromium.launch({ headless: true });
let failure = null;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  // 1. Real login through the shipped form.
  await page.goto(new URL("/login", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  if (new URL(page.url()).origin !== parsedBaseUrl.origin) {
    throw new Error("Login navigation left the approved RC origin before credentials were entered.");
  }
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The app redirects to /dashboard on success and to /finish-setup when the
  // account has no organization yet — the latter is a provisioning problem, not
  // an authentication success, so it is reported distinctly.
  await page.waitForURL(/\/(dashboard|finish-setup)(?:\?|$)/, { timeout: 60_000 }).catch(() => {
    throw new Error(
      "Login did not reach an authenticated route within 60s. Check the RC smoke credentials and that the deployment is reachable.",
    );
  });

  const landedPath = new URL(page.url()).pathname;
  if (landedPath === "/finish-setup") {
    throw new Error(
      "The RC smoke identity authenticated but has no organization. Complete beta smoke tenant onboarding before capturing evidence.",
    );
  }
  record("real login reaches the authenticated workspace", true);

  // 2. Prove the session is authenticated, not merely that a file was written.
  await page.goto(new URL("/dashboard", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  const dashboardPath = new URL(page.url()).pathname;
  if (dashboardPath === "/login") {
    throw new Error("Authenticated navigation was redirected back to /login; the session did not establish.");
  }
  const bodyText = (await page.locator("body").innerText()).trim();
  if (bodyText.length === 0) {
    throw new Error("The authenticated dashboard rendered an empty body.");
  }
  record("authenticated route renders without redirecting to login", true);

  // 3. Tenant assertion — the session must belong to the expected smoke org.
  if (expectedOrg) {
    const signOutVisible = await page
      .getByRole("button", { name: "Sign out" })
      .first()
      .isVisible()
      .catch(() => false);
    if (!signOutVisible) {
      throw new Error("Authenticated shell did not render a Sign out control; the session may not be a real operator session.");
    }
    const settingsResponse = await page.goto(new URL("/settings", parsedBaseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    const settingsText = (await page.locator("body").innerText()).trim();
    const status = settingsResponse?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`Settings route returned HTTP ${status} while asserting tenant identity.`);
    }
    if (!settingsText.includes(expectedOrg)) {
      throw new Error(
        `Authenticated session is not scoped to the expected smoke tenant "${expectedOrg}". ` +
          "Refusing to capture evidence against an unexpected organization.",
      );
    }
    record(`session is scoped to the expected smoke tenant`, true);
  } else {
    record("tenant assertion skipped (BETA_SMOKE_ORG_LABEL not set)", true, "no expected organization supplied");
  }

  // 4. Persist storage state outside the repository, owner-readable only.
  await fs.mkdir(path.dirname(resolvedStatePath), { recursive: true });
  await context.storageState({ path: resolvedStatePath });
  await fs.chmod(resolvedStatePath, 0o600);
  record("storage state written with owner-only permissions", true);

  await context.close();
} catch (error) {
  failure = error;
  record("authentication bootstrap", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
  // The report deliberately carries no credential material.
  await fs.writeFile(
    path.join(outDir, "auth-setup-report.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: parsedBaseUrl.origin,
        smokeIdentity: email.replace(/^(.).*(@.*)$/, "$1***$2"),
        expectedOrganization: expectedOrg ?? null,
        steps,
        result: failure ? "FAIL" : "PASS",
      },
      null,
      2,
    )}\n`,
  );
}

if (failure) {
  console.error(`::error::[auth-setup] ${failure.message}`);
  process.exit(1);
}
console.log("Authentication bootstrap PASS");
