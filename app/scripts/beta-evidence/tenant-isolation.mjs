// Phase 14 — prove the smoke identity cannot reach another tenant's resources.
//
// The canonical security assertion is made at the authenticated same-origin API
// proxy, which forwards the smoke session to the backend. This avoids treating
// a Next.js error boundary's outer HTTP 200 as data exposure when the underlying
// backend correctly denied the resource with 403/404. The browser page remains
// a secondary UX signal, but API denial is required for PASS.

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

function startupFailure(message) {
  console.error(`::error::[tenant-isolation] ${message}`);
  process.exit(1);
}

if (!baseUrlInput) startupFailure("BETA_RC_BASE_URL_RESOLVED is required. Run resolve-rc-target.mjs first.");
if (!storageState) startupFailure("BETA_STORAGE_STATE_PATH is required. Run auth-setup.mjs first.");
if (!foreignProjectId && !foreignCustomerId && !foreignEstimateId) {
  startupFailure(
    "At least one of BETA_FOREIGN_CUSTOMER_ID, BETA_FOREIGN_PROJECT_ID, or BETA_FOREIGN_ESTIMATE_ID is required. " +
      "Tenant isolation cannot be proven without a known foreign resource identifier.",
  );
}

let parsedBaseUrl;
try {
  parsedBaseUrl = assertApprovedRcUrl(baseUrlInput);
} catch (error) {
  startupFailure(error.message);
}
await fs.mkdir(outDir, { recursive: true });

const probes = [
  foreignCustomerId
    ? {
        name: "foreign customer",
        route: `/customers/${foreignCustomerId}`,
        apiRoute: `/api/proxy/customers/${foreignCustomerId}`,
      }
    : null,
  foreignProjectId
    ? {
        name: "foreign project",
        route: `/projects/${foreignProjectId}`,
        apiRoute: `/api/proxy/projects/${foreignProjectId}`,
      }
    : null,
  // The browser estimate route is nested under a project, while the API detail
  // endpoint is keyed directly by estimate id.
  foreignEstimateId && foreignProjectId
    ? {
        name: "foreign estimate",
        route: `/projects/${foreignProjectId}/estimates/${foreignEstimateId}`,
        apiRoute: `/api/proxy/estimates/${foreignEstimateId}`,
      }
    : null,
].filter(Boolean);

// A configuration that supplies only BETA_FOREIGN_ESTIMATE_ID satisfies the
// check above but yields no probeable browser route. Reporting PASS there would
// claim tenant isolation without exercising the real resource path.
if (probes.length === 0) {
  startupFailure(
    "No tenant-isolation probe could be constructed. BETA_FOREIGN_ESTIMATE_ID requires BETA_FOREIGN_PROJECT_ID " +
      "because the estimate browser route is nested under a project. Supply a foreign customer or project id.",
  );
}

const results = [];
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
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  for (const probe of probes) {
    // Primary security assertion: the authenticated proxy/backend must deny the
    // foreign resource. A successful 2xx here is an actual cross-tenant leak.
    const apiResponse = await context.request.get(new URL(probe.apiRoute, parsedBaseUrl).toString(), {
      timeout: 60_000,
    });
    const apiStatus = apiResponse.status();
    const deniedByApi = apiStatus === 403 || apiStatus === 404;

    // Secondary browser/UX observation. Next.js may return an outer 200 while a
    // server component renders an error boundary after the backend returned 404,
    // so browser status alone is not the security verdict.
    const response = await page.goto(new URL(probe.route, parsedBaseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    const pageStatus = response?.status() ?? 0;
    const finalPath = new URL(page.url()).pathname;
    const bodyText = (await page.locator("body").innerText()).trim();
    const deniedByPageStatus = pageStatus === 403 || pageStatus === 404;
    const deniedByRedirect = finalPath === "/login";
    const deniedByNotFoundUi = /could not be found|not found|no access|unauthori[sz]ed|request failed|internal server error|something went wrong/i.test(
      bodyText,
    );

    const result = {
      name: probe.name,
      route: probe.route,
      apiRoute: probe.apiRoute,
      apiStatus,
      pageStatus,
      finalPath,
      deniedByApi,
      deniedByPageStatus,
      deniedByRedirect,
      deniedByNotFoundUi,
      passed: deniedByApi,
    };
    results.push(result);

    if (!deniedByApi) {
      throw new Error(
        `RELEASE BLOCKER: ${probe.name} at ${probe.apiRoute} returned HTTP ${apiStatus} instead of 403/404. ` +
          "Cross-tenant data is reachable through the authenticated API boundary.",
      );
    }
  }

  if (results.length === 0) {
    throw new Error("Tenant isolation executed no probes; refusing to report PASS.");
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
console.log(`Tenant isolation PASS — ${results.length} foreign resources correctly denied at the authenticated API boundary`);
