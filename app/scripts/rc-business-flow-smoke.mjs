import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RC_BASE_URL;
const storageState = process.env.RC_STORAGE_STATE_PATH;
const targetEnvironment = process.env.RC_TARGET_ENVIRONMENT;
const fixturePath = process.env.RC_GOLDEN_REPORT_PATH || "../artifacts/estimate-deliverability/report.json";
const outDir = process.env.RC_EVIDENCE_DIR || "../artifacts/rc-smoke";
const fieldEmail = process.env.RC_FIELD_AUTH_EMAIL;
const fieldPassword = process.env.RC_AUTH_PASSWORD;
const fieldUserId = process.env.RC_FIELD_USER_ID;

if (!baseUrl) throw new Error("RC_BASE_URL is required.");
if (!storageState) throw new Error("RC_STORAGE_STATE_PATH is required.");
if (!fieldEmail) throw new Error("RC_FIELD_AUTH_EMAIL is required for the dedicated field technician login.");
if (!fieldPassword) throw new Error("RC_AUTH_PASSWORD is required for the dedicated field technician login.");
if (!fieldUserId) throw new Error("RC_FIELD_USER_ID is required for technician assignment evidence.");
if (!targetEnvironment || !["preview", "staging"].includes(targetEnvironment)) throw new Error("RC_TARGET_ENVIRONMENT must be preview or staging.");

const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("RC_BASE_URL must be an HTTPS URL without embedded credentials.");
}
if (!/^tradeos-costbook-web-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(parsedBaseUrl.hostname)) {
  throw new Error("RC_TARGET_ENVIRONMENT must use an approved tradeos-costbook-web Vercel Preview host.");
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
  ["portal invoice", `/portal/invoices/${run.invoiceId}`, "Invoice #"],
  ["dispatch job workspace", "/dispatch", ["Active Jobs", "Work queue"]],
];

async function proxyJson(page, pathName, init = {}) {
  const result = await page.evaluate(async ({ pathName, init }) => {
    const response = await fetch(`/api/proxy${pathName}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    return { ok: response.ok, status: response.status, body };
  }, { pathName, init });
  if (!result.ok) {
    const detail = typeof result.body === "object" && result.body && "error" in result.body ? result.body.error : JSON.stringify(result.body);
    throw new Error(`${init.method || "GET"} ${pathName} failed with HTTP ${result.status}: ${detail}`);
  }
  return result.body;
}

async function waitForResource(page, pathName, predicate, description, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await proxyJson(page, pathName);
    if (predicate(latest)) return latest;
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for ${description}. Last resource state: ${JSON.stringify(latest)}.`);
}

async function loginFieldTechnician(page) {
  await page.goto(new URL("/login", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('[name="email"]').fill(fieldEmail);
  await page.locator('[name="password"]').fill(fieldPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60_000 });
  const finalUrl = new URL(page.url());
  if (finalUrl.origin !== parsedBaseUrl.origin) throw new Error("Field technician login left the approved Preview origin.");
}

async function recordFullPayment(page) {
  const route = `/projects/${run.projectId}/invoices/${run.invoiceId}`;
  await page.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  const send = page.getByRole("button", { name: "Send invoice" });
  if (await send.isVisible().catch(() => false)) {
    await send.click();
    await waitForResource(page, `/invoices/${run.invoiceId}`, (invoice) => invoice?.status === "sent", `invoice ${run.invoiceId} to become sent`);
    await page.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  }

  const invoiceBefore = await proxyJson(page, `/invoices/${run.invoiceId}`);
  const balanceDue = Number(invoiceBefore?.balanceDue);
  if (!Number.isFinite(balanceDue) || balanceDue <= 0) {
    throw new Error(`Expected a positive invoice balance before payment; received ${invoiceBefore?.balanceDue}.`);
  }

  await page.locator('[name="amount"]').fill(balanceDue.toFixed(2));
  await page.locator('[name="method"]').selectOption("check");
  await page.locator('[name="reference"]').fill("RC full-lifecycle evidence");
  await page.locator('[name="notes"]').fill("Automated sanitized RC lifecycle payment.");
  await page.getByRole("button", { name: "Record payment" }).click();
  const invoiceAfter = await waitForResource(
    page,
    `/invoices/${run.invoiceId}`,
    (invoice) => invoice?.status === "paid" && Math.abs(Number(invoice?.balanceDue || 0)) < 0.005,
    `invoice ${run.invoiceId} payment reconciliation`,
  );

  const paid = invoiceAfter?.status === "paid" && Math.abs(Number(invoiceAfter?.balanceDue || 0)) < 0.005;
  results.push({ name: "record full invoice payment", route, invoiceId: run.invoiceId, amount: balanceDue, status: invoiceAfter?.status, balanceDue: invoiceAfter?.balanceDue, passed: paid });
  if (!paid) throw new Error(`Recorded payment did not reconcile invoice ${run.invoiceId} to paid with zero balance.`);
}

async function createFieldJob(page) {
  const route = `/projects/${run.projectId}/jobs/new`;
  await page.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText("Create field job", { exact: true }).waitFor({ timeout: 30_000 });
  if (await page.getByRole("button", { name: "Retry address load" }).isVisible().catch(() => false)) {
    throw new Error("Service-address loading failed on the Create job UI.");
  }

  await page.locator('[name="jobType"]').fill("RC lifecycle verification");
  await page.locator('[name="description"]').fill("Sanitized RC lifecycle job used to verify scheduling, dispatch, technician travel, arrival, and completion.");
  await page.locator('[name="estimatedDurationMinutes"]').fill("120");
  const city = page.locator('[name="city"]');
  if (await city.isVisible().catch(() => false)) {
    await city.fill("Terre Haute");
    await page.locator('[name="state"]').fill("IN");
    await page.locator('[name="postalCode"]').fill("47802");
  }

  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/proxy/jobs", { timeout: 60_000 });
  await page.getByRole("button", { name: "Create job and open Dispatch" }).click();
  const response = await responsePromise;
  const responseText = await response.text();
  if (!response.ok()) throw new Error(`Create job UI returned HTTP ${response.status()}: ${responseText}`);
  const job = JSON.parse(responseText);
  if (!job?.id) throw new Error("Create job UI response did not include a job id.");
  await page.waitForURL(/\/dispatch(?:\?|$)/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  results.push({ name: "create field job through project UI", route, jobId: job.id, jobNumber: job.jobNumber, passed: true });
  return job;
}

async function assignScheduleAndDispatch(page, job) {
  const assignment = await proxyJson(page, `/jobs/${job.id}/assignments`, {
    method: "POST",
    body: JSON.stringify({ userId: fieldUserId, assignmentRole: "technician", isLead: true }),
  });

  const scheduledStart = new Date(Date.now() + 10 * 60_000);
  const scheduledEnd = new Date(scheduledStart.getTime() + 2 * 60 * 60_000);
  await proxyJson(page, `/jobs/${job.id}/schedule`, {
    method: "PUT",
    body: JSON.stringify({ scheduledStart: scheduledStart.toISOString(), scheduledEnd: scheduledEnd.toISOString(), estimatedDurationMinutes: 120 }),
  });
  const dispatched = await proxyJson(page, `/jobs/${job.id}/dispatch`, { method: "POST", body: JSON.stringify({ reason: "RC full-lifecycle evidence" }) });
  const passed = dispatched?.status === "dispatched";
  results.push({ name: "assign schedule and dispatch job", jobId: job.id, assignmentId: assignment?.id, scheduledStart: scheduledStart.toISOString(), scheduledEnd: scheduledEnd.toISOString(), status: dispatched?.status, passed });
  if (!passed) throw new Error(`Job ${job.id} did not reach dispatched after assignment and scheduling.`);
}

async function executeFieldLifecycle(page, job) {
  await loginFieldTechnician(page);
  const route = `/field?job=${encodeURIComponent(job.id)}`;
  await page.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  const initialBody = await page.locator("body").innerText();
  if (!initialBody.includes("Field day") || !initialBody.includes(job.title) || initialBody.includes("Technician workspace") || initialBody.includes("Couldn't load your field day")) {
    throw new Error(`Dedicated technician could not load assigned job ${job.id} in /field.`);
  }

  for (const [buttonName, expectedStatus] of [["Start travel", "traveling"], ["Arrived on site", "on_site"], ["Complete job", "completed"]]) {
    await page.getByRole("button", { name: buttonName }).click();
    const current = await waitForResource(page, `/jobs/${job.id}`, (resource) => resource?.status === expectedStatus, `job ${job.id} to reach ${expectedStatus}`);
    const passed = current?.status === expectedStatus;
    results.push({ name: `field transition ${buttonName}`, jobId: job.id, status: current?.status, expectedStatus, passed });
    if (!passed) throw new Error(`Field transition ${buttonName} left job ${job.id} in ${current?.status}, expected ${expectedStatus}.`);
    await page.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  }
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let workflowError = null;
let job = null;

try {
  const dispatchContext = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const dispatchPage = await dispatchContext.newPage();
  for (const [name, route, expectedText] of dispatchChecks) {
    const response = await dispatchPage.goto(new URL(route, parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
    const status = response?.status() ?? 0;
    const finalUrl = dispatchPage.url();
    const finalOrigin = new URL(finalUrl);
    const bodyText = await dispatchPage.locator("body").innerText();
    const expectedTexts = Array.isArray(expectedText) ? expectedText : [expectedText];
    const passed = status > 0 && status < 400 && bodyText.trim().length > 0 && expectedTexts.every((text) => bodyText.includes(text)) && !bodyText.includes("Couldn't load dispatch data") && finalOrigin.protocol === "https:" && finalOrigin.origin === parsedBaseUrl.origin && finalOrigin.pathname !== "/login";
    results.push({ name, route, finalUrl, status, bodyTextLength: bodyText.trim().length, passed });
    if (!passed) throw new Error(`${name} failed smoke check: status=${status}, finalUrl=${finalUrl}.`);
  }

  await recordFullPayment(dispatchPage);
  job = await createFieldJob(dispatchPage);
  await assignScheduleAndDispatch(dispatchPage, job);

  const fieldContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const fieldPage = await fieldContext.newPage();
  await executeFieldLifecycle(fieldPage, job);

  const finalOwnerJob = await proxyJson(dispatchPage, `/jobs/${job.id}`);
  const finalInvoice = await proxyJson(dispatchPage, `/invoices/${run.invoiceId}`);
  const lifecyclePassed = finalOwnerJob?.status === "completed" && finalInvoice?.status === "paid" && Math.abs(Number(finalInvoice?.balanceDue || 0)) < 0.005;
  results.push({ name: "full contractor lifecycle reconciliation", projectId: run.projectId, invoiceId: run.invoiceId, jobId: job.id, invoiceStatus: finalInvoice?.status, invoiceBalanceDue: finalInvoice?.balanceDue, jobStatus: finalOwnerJob?.status, passed: lifecyclePassed });
  if (!lifecyclePassed) throw new Error("Final lifecycle reconciliation did not preserve paid invoice and completed job state.");

  await Promise.all([dispatchContext.close(), fieldContext.close()]);
} catch (error) {
  workflowError = error;
} finally {
  await browser.close();
  await fs.writeFile(
    path.join(outDir, "business-flow-report.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, fixturePath, fixture: { projectId: run.projectId, proposalId: run.proposalId, contractId: run.contractId, invoiceId: run.invoiceId }, fieldFixture: { email: fieldEmail, userId: fieldUserId }, job: job ? { id: job.id, jobNumber: job.jobNumber, title: job.title } : null, results, error: workflowError instanceof Error ? workflowError.message : workflowError }, null, 2),
  );
}

if (workflowError) throw workflowError;
console.log(JSON.stringify({ passed: results.length > 0 && results.every((result) => result.passed), jobId: job?.id, results }, null, 2));
