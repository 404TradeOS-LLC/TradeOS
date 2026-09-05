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
import { assertStorageStatePathOutsideRepo } from "./lib/storage-state-path.mjs";

const baseUrlInput = process.env.BETA_RC_BASE_URL_RESOLVED;
const email = process.env.BETA_SMOKE_EMAIL;
const password = process.env.BETA_SMOKE_PASSWORD;
const storageStatePath = process.env.BETA_STORAGE_STATE_PATH;
const expectedOrg = process.env.BETA_SMOKE_ORG_LABEL;
const expectedOrgId = process.env.BETA_SMOKE_ORG_ID;
const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";

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
requireEnv(
  expectedOrg,
  "BETA_SMOKE_ORG_LABEL",
  "Name the smoke organization the session must belong to; the tenant assertion cannot be skipped.",
);
requireEnv(
  expectedOrgId,
  "BETA_SMOKE_ORG_ID",
  "Provide the canonical staging smoke organization id so tenant identity is asserted independently of editable company settings.",
);

let parsedBaseUrl;
try {
  parsedBaseUrl = assertApprovedRcUrl(baseUrlInput);
} catch (error) {
  startupFailure(error.message);
}

const resolvedStatePath = path.resolve(storageStatePath);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
try {
  await assertStorageStatePathOutsideRepo(resolvedStatePath, repoRoot);
} catch (error) {
  startupFailure(error.message);
}

await fs.mkdir(outDir, { recursive: true });

const steps = [];
function record(name, passed, detail) {
  steps.push({ name, passed, ...(detail ? { detail } : {}) });
}

async function assertResponsiveOperatorShell(page) {
  const signOutButton = page.getByRole("button", { name: "Sign out" }).first();
  if (await signOutButton.isVisible().catch(() => false)) return;

  const moreButton = page.getByRole("button", { name: "Open more menu" }).first();
  if (!(await moreButton.isVisible().catch(() => false))) {
    throw new Error("Authenticated shell exposed neither a visible Sign out control nor the responsive More menu.");
  }

  await moreButton.click();
  await signOutButton.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {
    throw new Error("Responsive operator menu opened but did not render a Sign out control.");
  });
}

async function assertCanonicalTenant(page) {
  const result = await page.evaluate(async () => {
    // The browser proxy prepends /api/v1/ to its catch-all segments, so the
    // settings client path /api/v1/settings maps to /api/proxy/settings here.
    const response = await fetch("/api/proxy/settings", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Keep malformed payloads diagnosable without echoing arbitrary body text.
    }
    return { status: response.status, orgId: body?.orgId ?? null };
  });

  if (result.status >= 400) {
    throw new Error(`Authenticated settings API returned HTTP ${result.status} while asserting tenant identity.`);
  }
  if (result.orgId !== expectedOrgId) {
    throw new Error(
      `Authenticated session resolved to unexpected organization id ${result.orgId ?? "<missing>"}; ` +
        `expected the dedicated smoke tenant "${expectedOrg}". Refusing to capture cross-tenant evidence.`,
    );
  }
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  startupFailure(
    `Could not launch Chromium: ${error instanceof Error ? error.message.split("\n")[0] : error}. ` +
      "Run `npx playwright install --with-deps chromium` first.",
  );
}
let failure = null;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(new URL("/login", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  if (new URL(page.url()).origin !== parsedBaseUrl.origin) {
    throw new Error("Login navigation left the approved RC origin before credentials were entered.");
  }
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

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

  await assertResponsiveOperatorShell(page);
  record("authenticated operator shell exposes sign-out control", true);

  await assertCanonicalTenant(page);
  record("session is scoped to the expected smoke tenant", true);

  const settingsResponse = await page.goto(new URL("/settings", parsedBaseUrl).toString(), {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  const status = settingsResponse?.status() ?? 0;
  if (status >= 400) {
    throw new Error(`Settings route returned HTTP ${status} after canonical tenant assertion.`);
  }
  record("settings route renders for the authenticated smoke tenant", true);

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
  await fs.writeFile(
    path.join(outDir, "auth-setup-report.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: parsedBaseUrl.origin,
        smokeIdentity: email.replace(/^(.).*(@.*)$/, "$1***$2"),
        expectedOrganization: expectedOrg,
        expectedOrganizationId: expectedOrgId,
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
