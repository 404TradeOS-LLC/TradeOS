// Phase 14 — prove the smoke identity cannot reach another tenant's resources.
//
// A 200 that renders a foreign resource is a release blocker. The application
// contract for a denied resource is a 404 (see app/tests/rls.integration.ts,
// which asserts 404 for cross-organization reads), so 403/404/redirect-to-login
// and sanitized not-found UI all count as correct denial; a 200 exposing the
// foreign record does not.

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { assertApprovedRcUrl } from "./lib/rc-target.mjs";

const baseUrlInput = process.env.BETA_RC_BASE_URL_RESOLVED;
const storageState = process.env.BETA_STORAGE_STATE_PATH;
const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";
const foreignCustomerId = process.env.BETA_FOREIGN_CUSTOMER_ID;
const foreignProjectId = process.env.BETA_FOREIGN_PROJECT_ID;
const foreignEstimateId = process.env.BETA_FOREIGN_ESTIMATE_ID;

if (!baseUrlInput) throw new Error("BETA_RC_BASE_URL_RESOLVED is required. Run resolve-rc-target.mjs first.");
if (!storageState) throw new Error("BETA_STORAGE_STATE_PATH is required. Run auth-setup.mjs first.");
if (!foreignProjectId && !foreignCustomerId && !foreignEstimateId) {
  throw new Error(
    "At least one of BETA_FOREIGN_CUSTOMER_ID, BETA_FOREIGN_PROJECT_ID, or BETA_FOREIGN_ESTIMATE_ID is required. " +
      "Tenant isolation cannot be proven without a known foreign resource identifier.",
  );
}

const parsedBaseUrl = assertApprovedRcUrl(baseUrlInput);
await fs.mkdir(outDir, { recursive: true });

const probes = [
  foreignCustomerId ? { name: "foreign customer", route: `/customers/${foreignCustomerId}` } : null,
  foreignProjectId ? { name: "foreign project", route: `/projects/${foreignProjectId}` } : null,
  foreignEstimateId && foreignProjectId
    ? { name: "foreign estimate", route: `/projects/${foreignProjectId}/estimates/${foreignEstimateId}` }
    : null,
].filter(Boolean);

const results = [];
const browser = await chromium.launch({ headless: true });
let failure = null;

try {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  for (const probe of probes) {
    const response = await page.goto(new URL(probe.route, parsedBaseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    const status = response?.status() ?? 0;
    const finalPath = new URL(page.url()).pathname;
    const bodyText = (await page.locator("body").innerText()).trim();

    const deniedByStatus = status === 403 || status === 404;
    const deniedByRedirect = finalPath === "/login";
    const deniedByNotFoundUi = /could not be found|not found|no access|unauthori[sz]ed/i.test(bodyText);
    const denied = deniedByStatus || deniedByRedirect || deniedByNotFoundUi;

    const result = {
      name: probe.name,
      route: probe.route,
      status,
      finalPath,
      deniedByStatus,
      deniedByRedirect,
      deniedByNotFoundUi,
      passed: denied,
    };
    results.push(result);

    if (!denied) {
      throw new Error(
        `RELEASE BLOCKER: ${probe.name} at ${probe.route} returned HTTP ${status} and rendered content ` +
          "instead of denying access. Cross-tenant data is reachable by the smoke identity.",
      );
    }
  }

  await context.close();
} catch (error) {
  failure = error;
} finally {
  await browser.close();
  await fs.writeFile(
    path.join(outDir, "tenant-isolation-report.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: parsedBaseUrl.origin,
        probes: results,
        result: failure ? "FAIL" : "PASS",
        error: failure instanceof Error ? failure.message : null,
      },
      null,
      2,
    )}\n`,
  );
}

if (failure) {
  console.error(`::error::[tenant-isolation] ${failure.message}`);
  process.exit(1);
}
console.log(`Tenant isolation PASS — ${results.length} foreign resources correctly denied`);
