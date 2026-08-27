import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RC_BASE_URL;
const storageState = process.env.RC_STORAGE_STATE_PATH;
const fixturePath = process.env.RC_GOLDEN_REPORT_PATH || "../artifacts/estimate-deliverability/report.json";
const outDir = process.env.RC_EVIDENCE_DIR || "../artifacts/rc-smoke";

if (!baseUrl) throw new Error("RC_BASE_URL is required.");
if (!storageState) throw new Error("RC_STORAGE_STATE_PATH is required.");

const parsedBaseUrl = new URL(baseUrl);
if (!/^https?:$/.test(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("RC_BASE_URL must be an HTTP(S) URL without embedded credentials.");
}

const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
const run = fixture.results?.at(-1);
if (!run?.projectId || !run.proposalId || !run.contractId || !run.invoiceId) {
  throw new Error("The golden workflow report is missing project, proposal, contract, or invoice identifiers.");
}

const checks = [
  ["project workspace", `/projects/${run.projectId}`, "Lifecycle status"],
  ["contract workspace", `/projects/${run.projectId}/contracts/${run.contractId}`, "Contract"],
  ["invoice workspace", `/projects/${run.projectId}/invoices/${run.invoiceId}`, "Invoice"],
  ["portal project", `/portal/projects/${run.projectId}`, "Customer portal"],
  ["portal proposal", `/portal/proposals/${run.proposalId}`, "Proposal review"],
  ["portal contract", `/portal/contracts/${run.contractId}`, "Contract review"],
  ["portal invoice", `/portal/invoices/${run.invoiceId}`, `Invoice #`],
  ["dispatch job workspace", "/dispatch", "Dispatch"],
  ["field job workspace", "/field", ["Field day", "Technician workspace"]],
];

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let workflowError = null;

try {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  for (const [name, route, expectedText] of checks) {
    const response = await page.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
    const status = response?.status() ?? 0;
    const finalUrl = page.url();
    const bodyText = await page.locator("body").innerText();
    const expectedTexts = Array.isArray(expectedText) ? expectedText : [expectedText];
    const passed = status > 0 && status < 400 && bodyText.trim().length > 0 && expectedTexts.some((text) => bodyText.includes(text)) && new URL(finalUrl).pathname !== "/login";
    results.push({ name, route, finalUrl, status, bodyTextLength: bodyText.trim().length, passed });
    if (!passed) throw new Error(`${name} failed smoke check: status=${status}, finalUrl=${finalUrl}.`);
  }
  await context.close();
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
