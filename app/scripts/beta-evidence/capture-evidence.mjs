// Phase 11/12/13/16/17/18/19/23 — drive the canonical contractor workflow at a
// single viewport, capturing a screenshot checkpoint at each meaningful product
// state and asserting business meaning rather than DOM presence.
//
// One viewport per invocation so a failure names the viewport that failed and
// so each viewport renders in a genuinely separate browser context. Desktop
// screenshots are never resized to fake a smaller viewport.

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { assertApprovedRcUrl } from "./lib/rc-target.mjs";
import {
  VIEWPORTS,
  assessResponsiveQuality,
  assessScreenshotTruth,
  screenshotFileName,
} from "./lib/evidence-artifacts.mjs";

const baseUrlInput = process.env.BETA_RC_BASE_URL_RESOLVED;
const storageState = process.env.BETA_STORAGE_STATE_PATH;
const viewportName = process.env.BETA_VIEWPORT;
const runId = process.env.BETA_RUN_ID;
const tenantLabel = process.env.BETA_SMOKE_TENANT_LABEL || "TradeOS Beta Smoke";
const allowMutations = process.env.BETA_ALLOW_MUTATIONS === "true";
const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";

function startupFailure(message) {
  console.error(`::error::[capture-evidence viewport=${viewportName ?? "unset"}] ${message}`);
  process.exit(1);
}

if (!baseUrlInput) startupFailure("BETA_RC_BASE_URL_RESOLVED is required. Run resolve-rc-target.mjs first.");
if (!storageState) startupFailure("BETA_STORAGE_STATE_PATH is required. Run auth-setup.mjs first.");
if (!runId) startupFailure("BETA_RUN_ID is required so synthetic records can be correlated with this run.");
if (!allowMutations) {
  startupFailure(
    "BETA_ALLOW_MUTATIONS=true is required. The canonical workflow creates records and must never run unintentionally.",
  );
}

const viewport = VIEWPORTS.find((entry) => entry.name === viewportName);
if (!viewport) {
  startupFailure(
    `BETA_VIEWPORT must be one of ${VIEWPORTS.map((entry) => entry.name).join(", ")}; received "${viewportName}".`,
  );
}

let parsedBaseUrl;
try {
  parsedBaseUrl = assertApprovedRcUrl(baseUrlInput);
} catch (error) {
  startupFailure(error.message);
}
const screenshotDir = path.join(outDir, viewport.name, "screenshots");
await fs.mkdir(screenshotDir, { recursive: true });

// Phase 13 — deterministic structure, run-scoped uniqueness. The viewport is
// part of the identity so parallel viewport runs cannot collide.
const scopeSuffix = `${runId}-${viewport.name}`;
const customerName = `Acme Test Customer ${scopeSuffix}`;
const projectName = `RC Evidence Remodel ${scopeSuffix}`;
const scope =
  "Demolition: remove carpet, glued-down linoleum, damaged bedroom ceiling, bathroom demolition, appliance removal, closet/shelving demolition, debris handling. Reconstruction / Finish: drywall repair/replacement, flooring, painting, trim, miscellaneous carpentry, cleanup.";

const checkpoints = [];
const assertions = [];
const consoleErrors = [];
const failedRequests = [];

function assertBusiness(name, condition, detail) {
  assertions.push({ name, passed: Boolean(condition), ...(detail ? { detail } : {}) });
  if (!condition) throw new Error(`Business assertion failed: ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
let failure = null;
let context;
let page;

async function checkpoint(sequence, name, { optional = false } = {}) {
  const file = screenshotFileName(viewport.name, sequence, name);
  const target = path.join(screenshotDir, file);

  const state = await page.evaluate(() => ({
    pathname: location.pathname,
    title: document.title,
    bodyText: document.body?.innerText ?? "",
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  // Phase 23 — a screenshot of a login page or an error screen is not evidence.
  const truth = assessScreenshotTruth({
    pathname: state.pathname,
    title: state.title,
    bodyText: state.bodyText,
    checkpoint: name,
  });
  // Phase 18/19 — responsive quality gate, applied at every viewport.
  const quality = assessResponsiveQuality({
    viewport: viewport.name,
    scrollWidth: state.scrollWidth,
    clientWidth: state.clientWidth,
  });

  // fullPage:false keeps the captured image exactly the viewport width, which
  // is what the artifact validator asserts against.
  await page.screenshot({ path: target, fullPage: false });

  checkpoints.push({
    sequence,
    name,
    file,
    optional,
    pathname: state.pathname,
    scrollWidth: state.scrollWidth,
    clientWidth: state.clientWidth,
    truth,
    quality,
  });

  if (!truth.ok) throw new Error(`Checkpoint ${sequence}-${name} is not valid evidence: ${truth.problems.join("; ")}`);
  if (!quality.ok) {
    throw new Error(`Checkpoint ${sequence}-${name} failed the ${viewport.name}px quality gate: ${quality.problems.join("; ")}`);
  }
}

try {
  context = await browser.newContext({
    storageState,
    viewport: { width: viewport.width, height: viewport.height },
  });
  page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));

  // ---- 01 authenticated shell -------------------------------------------
  await page.goto(new URL("/dashboard", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  assertBusiness(
    "authenticated shell is not the login screen",
    new URL(page.url()).pathname !== "/login",
    `landed on ${new URL(page.url()).pathname}`,
  );
  await checkpoint("01", "authenticated-shell");

  // ---- 02 customer + project --------------------------------------------
  await page.goto(new URL("/customers/new", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('[name="name"]').fill(customerName);
  await page.locator('[name="email"]').fill(`rc-evidence-${scopeSuffix}@example.invalid`);
  await page.getByRole("button", { name: "Create customer" }).click();
  await page.waitForURL(/\/customers(?:\?|$)/, { timeout: 60_000 });

  await page.goto(new URL("/projects/new", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  // The customer only appears in this select when it belongs to the signed-in
  // tenant, so selecting it by label is itself a tenant-scoping assertion.
  await page.locator("select[name=customerId]").selectOption({ label: customerName });
  await page.locator('[name="name"]').fill(projectName);
  await page.locator('[name="jobType"]').fill("Residential condo remodel");
  await page.locator('[name="siteAddress"]').fill("100 Evidence Way");
  await page.locator('[name="simpleScope"]').fill(scope);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects(?:\?|$)/, { timeout: 60_000 });

  await page.getByText(projectName, { exact: true }).first().click();
  await page.waitForLoadState("networkidle");
  const projectId = /\/projects\/([^/?]+)/.exec(page.url())?.[1];
  assertBusiness("project workspace resolves an id", Boolean(projectId), `url was ${page.url()}`);
  await checkpoint("02", "project-or-customer");

  // ---- 03 estimate line items -------------------------------------------
  await page.goto(new URL(`/projects/${projectId}?tab=estimate-history`, parsedBaseUrl).toString(), {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.getByRole("button", { name: /create first estimate|new estimate/i }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/estimates/[^/]+$`), { timeout: 60_000 });
  const estimateId = /\/estimates\/([^/?]+)/.exec(page.url())?.[1];
  assertBusiness("estimate resolves an id", Boolean(estimateId), `url was ${page.url()}`);

  const custom = page.getByLabel("Custom line item");
  await custom.fill("Remove glued-down linoleum");
  await page.locator("#custom-quantity").fill("850");
  await page.locator("#custom-unit-cost").fill("1.25");
  await page.locator("#custom-unit").fill("SF");
  await page.locator("#custom-section").fill("Demolition");
  await page.locator("#custom-cost-type").selectOption("labor");
  await page.getByRole("button", { name: "Add custom" }).click();
  await page.getByText("Remove glued-down linoleum", { exact: true }).waitFor({ timeout: 60_000 });

  await custom.fill("Flooring material allowance");
  await page.locator("#custom-quantity").fill("850");
  await page.locator("#custom-unit-cost").fill("4.75");
  await page.locator("#custom-unit").fill("SF");
  await page.locator("#custom-section").fill("Reconstruction / Finish");
  await page.locator("#custom-cost-type").selectOption("material");
  await page.getByLabel("Taxable", { exact: true }).check();
  await page.getByRole("button", { name: "Add custom" }).click();
  await page.getByText("Flooring material allowance", { exact: true }).waitFor({ timeout: 60_000 });
  await checkpoint("03", "estimate-edit");

  // ---- 04 pricing --------------------------------------------------------
  await page.getByLabel("Overhead %").fill("10");
  await page.getByLabel("Tax %").fill("7");
  await page.getByRole("button", { name: "Save overhead / tax" }).click();
  // Let the save settle so the checkpoint captures committed pricing rather
  // than a mid-submit frame.
  await page.waitForLoadState("networkidle");
  await checkpoint("04", "estimate-pricing");

  // ---- 05 save / reload persistence -------------------------------------
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText("Remove glued-down linoleum", { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText("Flooring material allowance", { exact: true }).waitFor({ timeout: 60_000 });

  const overheadAfterReload = await page.getByLabel("Overhead %").inputValue();
  const taxAfterReload = await page.getByLabel("Tax %").inputValue();
  assertBusiness("overhead persists across reload", overheadAfterReload === "10", `read "${overheadAfterReload}"`);
  assertBusiness("tax rate persists across reload", taxAfterReload === "7", `read "${taxAfterReload}"`);

  // Shipped formula: jobCost 5100 -> +10% overhead = 5610 pre-tax; taxable
  // share is 4037.50/5100, so tax = 5610 * 0.7916667 * 0.07 = 310.89 and the
  // customer-facing total is 5920.89. These are the numbers the estimate engine
  // must produce, not merely numbers that happen to be on screen.
  await page.getByText("$310.89", { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText("$5,920.89", { exact: true }).waitFor({ timeout: 60_000 });
  assertions.push({ name: "pre-markup tax and total match the shipped formula", passed: true });
  await checkpoint("05", "estimate-reloaded");

  // ---- 06 markup + finalize ---------------------------------------------
  await page.getByRole("button", { name: "Markup %" }).click();
  await page.getByLabel("Percentage").fill("20");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("$6,732.00", { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText("$7,105.07", { exact: true }).waitFor({ timeout: 60_000 });
  assertions.push({ name: "post-markup pricing matches the shipped formula", passed: true });

  await page.getByRole("button", { name: "Finalize estimate" }).click();
  await page.getByText("ready", { exact: true }).waitFor({ timeout: 60_000 });
  assertions.push({ name: "estimate reaches the finalized state", passed: true });
  await checkpoint("06", "estimate-finalized");

  // ---- 07 proposal value transfer ---------------------------------------
  await page.getByRole("link", { name: "Create proposal" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/new`), { timeout: 60_000 });
  await page.locator("select[name=estimateId]").selectOption(estimateId);
  await page.getByRole("button", { name: "Create proposal" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/[^/]+$`), { timeout: 60_000 });
  const proposalId = /\/proposals\/([^/?]+)$/.exec(page.url())?.[1];
  assertBusiness("proposal resolves an id", Boolean(proposalId), `url was ${page.url()}`);

  const proposalText = await page.locator("body").innerText();
  assertBusiness(
    "proposal carries the finalized estimate value",
    proposalText.includes("$7,105.07"),
    "expected the finalized total $7,105.07 on the proposal",
  );
  assertBusiness(
    "proposal does not show a placeholder price",
    !/pricing in progress/i.test(proposalText),
    "proposal rendered 'Pricing in progress' despite priced estimate",
  );
  await checkpoint("07", "proposal");

  // ---- 08 downstream: contract + invoice --------------------------------
  await page.getByRole("button", { name: "Send to customer" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/${proposalId}$`), { timeout: 60_000 });
  await page.getByRole("button", { name: "Mark accepted" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/${proposalId}$`), { timeout: 60_000 });
  await page.getByRole("button", { name: "Create contract" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/contracts/[^/]+$`), { timeout: 60_000 });
  const contractId = /\/contracts\/([^/?]+)/.exec(page.url())?.[1];
  assertBusiness("contract resolves an id", Boolean(contractId), `url was ${page.url()}`);

  await page.goto(new URL(`/projects/${projectId}/invoices/new`, parsedBaseUrl).toString(), {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.locator("select[name=estimateId]").selectOption(estimateId);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/invoices/[^/]+$`), { timeout: 60_000 });
  const invoiceId = /\/invoices\/([^/?]+)/.exec(page.url())?.[1];
  assertBusiness("invoice resolves an id", Boolean(invoiceId), `url was ${page.url()}`);

  // The invoice must bill the customer-facing sell price, not the direct cost.
  const invoiceText = await page.locator("body").innerText();
  assertBusiness(
    "invoice bills sell price rather than direct cost",
    invoiceText.includes("$7,105.07") && !invoiceText.includes("$5,100.00"),
    "expected the sell price $7,105.07 and not the raw direct cost $5,100.00",
  );
  await checkpoint("08", "downstream-state", { optional: true });

  assertBusiness("no browser console errors were recorded", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  assertBusiness("no network requests failed", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));

  await fs.writeFile(
    path.join(outDir, viewport.name, "workflow-records.json"),
    `${JSON.stringify({ runId, viewport: viewport.name, projectId, estimateId, proposalId, contractId, invoiceId }, null, 2)}\n`,
  );
} catch (error) {
  failure = error;
} finally {
  if (context) await context.close();
  await browser.close();
  await fs.writeFile(
    path.join(outDir, viewport.name, "capture-report.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: parsedBaseUrl.origin,
        runId,
        tenantLabel,
        viewport,
        checkpoints,
        assertions,
        consoleErrors,
        failedRequests,
        result: failure ? "FAIL" : "PASS",
        error: failure instanceof Error ? failure.message : null,
      },
      null,
      2,
    )}\n`,
  );
}

if (failure) {
  console.error(`::error::[capture-evidence viewport=${viewport.name}] ${failure.message}`);
  const lastCheckpoint = checkpoints.at(-1);
  console.error(
    `::error::last successful checkpoint: ${lastCheckpoint ? `${lastCheckpoint.sequence}-${lastCheckpoint.name}` : "none"}`,
  );
  process.exit(1);
}
console.log(`Viewport ${viewport.name}px PASS — ${checkpoints.length} checkpoints captured`);
