import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// This is intentionally a browser-only test. It uses the normal authenticated UI
// and never calls the TradeOS API directly or seeds records.
const baseUrl = process.env.ESTIMATE_BASE_URL;
const storageState = process.env.ESTIMATE_STORAGE_STATE_PATH;
const outDir = process.env.ESTIMATE_EVIDENCE_DIR || "../artifacts/estimate-deliverability";
const runs = Number(process.env.ESTIMATE_RELIABILITY_RUNS || 10);
const targetEnvironment = process.env.RC_TARGET_ENVIRONMENT;
const smokeTenantLabel = process.env.RC_SMOKE_TENANT_LABEL;
const allowMutations = process.env.RC_ALLOW_MUTATIONS === "true";

if (!baseUrl) throw new Error("ESTIMATE_BASE_URL is required.");
if (!storageState) throw new Error("ESTIMATE_STORAGE_STATE_PATH is required.");
if (!Number.isInteger(runs) || runs < 1) throw new Error("ESTIMATE_RELIABILITY_RUNS must be a positive integer.");
if (!["preview", "staging"].includes(targetEnvironment)) {
  throw new Error("RC_TARGET_ENVIRONMENT must be preview or staging for the mutating golden workflow.");
}
if (!smokeTenantLabel) throw new Error("RC_SMOKE_TENANT_LABEL is required for mutating smoke evidence.");
if (!allowMutations) throw new Error("RC_ALLOW_MUTATIONS=true is required for the mutating golden workflow.");

const parsedBaseUrl = new URL(baseUrl);
if (!/^https?:$/.test(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("ESTIMATE_BASE_URL must be an HTTP(S) URL without embedded credentials.");
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function fillAndSubmit(page, fields, submitName) {
  for (const [name, value] of Object.entries(fields)) await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole("button", { name: submitName }).click();
}

async function runWorkflow(page, runNumber) {
  const suffix = `${Date.now()}-${runNumber}`;
  const customerName = `${smokeTenantLabel} Estimate Deliverability Test Customer ${suffix}`;
  const projectName = `${smokeTenantLabel} Condo Remodel Deliverability Test ${suffix}`;
  const scope = "Demolition: remove carpet, glued-down linoleum, damaged bedroom ceiling, bathroom demolition, appliance removal, closet/shelving demolition, debris handling. Reconstruction / Finish: drywall repair/replacement, flooring, painting, trim, miscellaneous carpentry, cleanup.";

  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));

  await page.goto(new URL("/customers/new", baseUrl), { waitUntil: "networkidle" });
  await fillAndSubmit(page, { name: customerName, email: `estimate-${suffix}@example.invalid` }, "Create customer");
  await page.waitForURL(/\/customers(?:\?|$)/);

  await page.goto(new URL("/projects/new", baseUrl), { waitUntil: "networkidle" });
  await page.locator("select[name=customerId]").selectOption({ label: customerName });
  await fillAndSubmit(page, { name: projectName, jobType: "Residential condo remodel", siteAddress: "100 Deliverability Way", simpleScope: scope }, "Create project");
  await page.waitForURL(/\/projects(?:\?|$)/);
  await page.getByText(projectName, { exact: true }).first().click();
  await page.waitForLoadState("networkidle");
  const projectUrl = page.url();
  const projectId = projectUrl.match(/\/projects\/([^/?]+)/)?.[1];
  if (!projectId) throw new Error(`Could not resolve project URL: ${projectUrl}`);

  await page.goto(new URL(`/projects/${projectId}?tab=estimate-history`, baseUrl), { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /create first estimate|new estimate/i }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/estimates/[^/]+$`));
  const estimateUrl = page.url();
  const estimateId = estimateUrl.match(/\/estimates\/([^/?]+)/)?.[1];
  if (!estimateId) throw new Error(`Could not resolve estimate URL: ${estimateUrl}`);

  const custom = page.getByLabel("Custom line item");
  await custom.fill("Remove glued-down linoleum");
  await page.locator("#custom-quantity").fill("850");
  await page.locator("#custom-unit-cost").fill("1.25");
  await page.locator("#custom-unit").fill("SF");
  await page.locator("#custom-section").fill("Demolition");
  await page.locator("#custom-cost-type").selectOption("labor");
  await page.getByRole("button", { name: "Add custom" }).click();
  await page.getByText("Remove glued-down linoleum", { exact: true }).waitFor();

  await custom.fill("Flooring material allowance");
  await page.locator("#custom-quantity").fill("850");
  await page.locator("#custom-unit-cost").fill("4.75");
  await page.locator("#custom-unit").fill("SF");
  await page.locator("#custom-section").fill("Reconstruction / Finish");
  await page.locator("#custom-cost-type").selectOption("material");
  await page.getByLabel("Taxable", { exact: true }).check();
  await page.getByRole("button", { name: "Add custom" }).click();
  await page.getByText("Flooring material allowance", { exact: true }).waitFor();

  // Edit a persisted line after it has been rendered, then reload and assert it remains.
  const editableLine = page.locator("li").filter({ hasText: "Remove glued-down linoleum" });
  await editableLine.getByRole("button", { name: "Edit" }).click();
  await editableLine.getByLabel("Description").fill("Remove glued-down linoleum (revised)");
  await editableLine.getByRole("button", { name: "Save" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Remove glued-down linoleum (revised)", { exact: true }).waitFor();
  await page.getByText("Flooring material allowance", { exact: true }).waitFor();

  await page.getByLabel("Overhead %").fill("10");
  await page.getByLabel("Tax %").fill("7");
  await page.getByRole("button", { name: "Save overhead / tax" }).click();
  await page.reload({ waitUntil: "networkidle" });
  if (await page.getByLabel("Overhead %").inputValue() !== "10" || await page.getByLabel("Tax %").inputValue() !== "7") {
    throw new Error("Saved overhead/tax settings did not persist after reload.");
  }
  await page.getByText("$310.63", { exact: true }).waitFor();
  await page.getByText("$5,920.63", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Markup %" }).click();
  await page.getByLabel("Percentage").fill("20");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("$6,732.00", { exact: true }).waitFor();
  await page.getByText("$7,105.07", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Finalize estimate" }).click();
  await page.getByText("ready", { exact: true }).waitFor();

  await page.getByRole("link", { name: "Create proposal" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/new`));
  await page.locator("select[name=estimateId]").selectOption(estimateId);
  await page.getByRole("button", { name: "Create proposal" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/[^/]+$`));
  const proposalId = page.url().match(/\/proposals\/([^/?]+)$/)?.[1];
  if (!proposalId) throw new Error(`Could not resolve proposal URL: ${page.url()}`);
  await page.getByRole("button", { name: "Send to customer" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/${proposalId}$`));
  await page.getByRole("button", { name: "Mark accepted" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/proposals/${proposalId}$`));
  await page.getByRole("button", { name: "Create contract" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/contracts/[^/]+$`));
  const contractId = page.url().match(/\/contracts\/([^/?]+)/)?.[1];
  if (!contractId) throw new Error(`Could not resolve contract URL: ${page.url()}`);

  await page.goto(new URL(`/projects/${projectId}/invoices/new`, baseUrl), { waitUntil: "networkidle" });
  await page.locator("select[name=estimateId]").selectOption(estimateId);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}/invoices/[^/]+$`));
  const invoiceId = page.url().match(/\/invoices\/([^/?]+)/)?.[1];
  if (!invoiceId) throw new Error(`Could not resolve invoice URL: ${page.url()}`);
  await page.getByRole("link", { name: /preview pdf|download pdf/i }).first().waitFor();

  return { runNumber, projectId, estimateId, proposalId, contractId, invoiceId, consoleErrors, failedRequests, passed: consoleErrors.length === 0 && failedRequests.length === 0 };
}

let workflowError = null;
let context;
try {
  context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
    const page = await context.newPage();
    try {
      const result = await runWorkflow(page, runNumber);
      results.push(result);
      if (!result.passed) throw new Error(`Run ${runNumber} recorded browser errors or failed requests.`);
    } finally {
      await page.close();
    }
  }
} catch (error) {
  workflowError = error;
} finally {
  if (context) await context.close();
  await browser.close();
  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, targetEnvironment, smokeTenantLabel, runs, results, error: workflowError instanceof Error ? workflowError.message : workflowError }, null, 2));
}

if (workflowError) throw workflowError;
console.log(JSON.stringify({ runs, passed: results.length === runs && results.every((result) => result.passed), results }, null, 2));
