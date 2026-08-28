import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RC_BASE_URL;
const storageState = process.env.RC_STORAGE_STATE_PATH;
const fieldStorageState = process.env.RC_FIELD_STORAGE_STATE_PATH;
const fixturePath = process.env.RC_GOLDEN_REPORT_PATH || "../artifacts/estimate-deliverability/report.json";
const outDir = process.env.RC_EVIDENCE_DIR || "../artifacts/rc-smoke";

if (!baseUrl) throw new Error("RC_BASE_URL is required.");
if (!storageState) throw new Error("RC_STORAGE_STATE_PATH is required.");
if (!fieldStorageState) throw new Error("RC_FIELD_STORAGE_STATE_PATH is required for resource-backed Field smoke evidence.");

const parsedBaseUrl = new URL(baseUrl);
if (!/^https?:$/.test(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("RC_BASE_URL must be an HTTP(S) URL without embedded credentials.");
}

const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
const run = fixture.results?.at(-1);
if (!run?.projectId || !run.proposalId || !run.contractId || !run.invoiceId) {
  throw new Error("The golden workflow report is missing project, proposal, contract, or invoice identifiers.");
}

const dispatchChecks = [
  ["project workspace", `/projects/${run.projectId}`, "Lifecycle status"],
  ["contract workspace", `/projects/${run.projectId}/contracts/${run.contractId}`, "Contract"],
  ["invoice workspace", `/projects/${run.projectId}/invoices/${run.invoiceId}`, "Invoice"],
  ["portal project", `/portal/projects/${run.projectId}`, "Customer portal"],
  ["portal proposal", `/portal/proposals/${run.proposalId}`, "Proposal review"],
  ["portal contract", `/portal/contracts/${run.contractId}`, "Contract review"],
  ["portal invoice", `/portal/invoices/${run.invoiceId}`, `Invoice #`],
  ["dispatch job workspace", "/dispatch", ["Active Jobs", "Work queue"]],
];

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let workflowError = null;

try {
  const dispatchContext = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const dispatchPage = await dispatchContext.newPage();
  for (const [name, route, expectedText] of dispatchChecks) {
    const response = await dispatchPage.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
    const status = response?.status() ?? 0;
    const finalUrl = dispatchPage.url();
    const bodyText = await dispatchPage.locator("body").innerText();
    const expectedTexts = Array.isArray(expectedText) ? expectedText : [expectedText];
    const passed = status > 0 && status < 400 && bodyText.trim().length > 0 && expectedTexts.every((text) => bodyText.includes(text)) && !bodyText.includes("Couldn't load dispatch data") && new URL(finalUrl).pathname !== "/login";
    results.push({ name, route, finalUrl, status, bodyTextLength: bodyText.trim().length, passed });
    if (!passed) throw new Error(`${name} failed smoke check: status=${status}, finalUrl=${finalUrl}.`);
  }

  const fieldContext = await browser.newContext({ storageState: fieldStorageState, viewport: { width: 1440, height: 1000 } });
  const fieldPage = await fieldContext.newPage();
  const fieldResponse = await fieldPage.goto(new URL("/field", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  const fieldStatus = fieldResponse?.status() ?? 0;
  const fieldFinalUrl = fieldPage.url();
  const fieldBodyText = await fieldPage.locator("body").innerText();
  const fieldHasResourceState = fieldBodyText.includes("No assigned jobs today") || (fieldBodyText.includes("Job notes") && !fieldBodyText.includes("Couldn't load this job"));
  const fieldPassed = fieldStatus > 0 && fieldStatus < 400 && fieldBodyText.includes("Field day") && fieldHasResourceState && !fieldBodyText.includes("Technician workspace") && !fieldBodyText.includes("Couldn't load your field day") && new URL(fieldFinalUrl).pathname !== "/login";
  results.push({ name: "field job workspace", route: "/field", finalUrl: fieldFinalUrl, status: fieldStatus, bodyTextLength: fieldBodyText.trim().length, passed: fieldPassed });
  if (!fieldPassed) throw new Error(`field job workspace failed smoke check: status=${fieldStatus}, finalUrl=${fieldFinalUrl}.`);
  await Promise.all([dispatchContext.close(), fieldContext.close()]);
} catch (error) {
  workflowError = error;
} finally {
  await browser.close();
  await fs.writeFile(
    path.join(outDir, "business-flow-report.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, fixturePath, fixture: { projectId: run.projectId, proposalId: run.proposalId, contractId: run.contractId, invoiceId: run.invoiceId }, results, error: workflowError instanceof Error ? workflowError.message : workflowError }, null, 2),
  );
}

if (workflowError) throw workflowError;
console.log(JSON.stringify(results, null, 2));
