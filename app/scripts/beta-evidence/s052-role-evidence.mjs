// S052 — certify admin Customer → Project continuity and inactive-membership denial
// using dedicated synthetic identities. This script never persists storage state
// and never logs credentials.

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
const adminEmail = process.env.BETA_S052_ADMIN_EMAIL;
const adminPassword = process.env.BETA_S052_ADMIN_PASSWORD;
const inactiveEmail = process.env.BETA_S052_INACTIVE_EMAIL;
const inactivePassword = process.env.BETA_S052_INACTIVE_PASSWORD;
const expectedOrg = process.env.BETA_SMOKE_ORG_LABEL;
const runId = process.env.BETA_RUN_ID;
const allowMutations = process.env.BETA_ALLOW_MUTATIONS === "true";
const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";
const requestedViewportNames = (process.env.BETA_S052_ROLE_VIEWPORTS || "1440,768,390")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const roleViewports = VIEWPORTS.filter((viewport) => requestedViewportNames.includes(viewport.name));

function fail(message) {
  console.error(`::error::[s052-role-evidence] ${message}`);
  process.exit(1);
}

for (const [name, value] of Object.entries({
  BETA_RC_BASE_URL_RESOLVED: baseUrlInput,
  BETA_S052_ADMIN_EMAIL: adminEmail,
  BETA_S052_ADMIN_PASSWORD: adminPassword,
  BETA_S052_INACTIVE_EMAIL: inactiveEmail,
  BETA_S052_INACTIVE_PASSWORD: inactivePassword,
  BETA_SMOKE_ORG_LABEL: expectedOrg,
  BETA_RUN_ID: runId,
})) {
  if (!value) fail(`${name} is required for S052 role evidence.`);
}
if (!allowMutations) fail("BETA_ALLOW_MUTATIONS=true is required for S052 admin evidence.");
if (roleViewports.length === 0) fail("BETA_S052_ROLE_VIEWPORTS did not select a known viewport.");

let parsedBaseUrl;
try {
  parsedBaseUrl = assertApprovedRcUrl(baseUrlInput);
} catch (error) {
  fail(error.message);
}

await fs.mkdir(outDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  runId,
  baseUrl: parsedBaseUrl.origin,
  expectedOrganization: expectedOrg,
  admin: [],
  inactiveMembership: null,
  result: "FAIL",
};

function masked(email) {
  return String(email).replace(/^(.).*(@.*)$/, "$1***$2");
}

async function signIn(page, email, password) {
  await page.goto(new URL("/login", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  fail(`Could not launch Chromium: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
}

let failure = null;
try {
  for (const viewport of roleViewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const suffix = `${runId}-admin-${viewport.name}`;
    const customerName = `S052 Admin Customer ${suffix}`;
    const projectName = `S052 Admin Project ${suffix}`;
    const scope = `S052 admin certification scope ${suffix}`;

    try {
      await signIn(page, adminEmail, adminPassword);
      await page.waitForURL(/\/(dashboard|finish-setup)(?:\?|$)/, { timeout: 60_000 });
      if (new URL(page.url()).pathname !== "/dashboard") {
        throw new Error(`admin identity did not reach dashboard; landed on ${new URL(page.url()).pathname}`);
      }

      const settingsResponse = await context.request.get(new URL("/api/proxy/settings", parsedBaseUrl).toString());
      const settings = settingsResponse.status() === 200 ? await settingsResponse.json() : null;
      if (settingsResponse.status() !== 200 || settings?.currentRole !== "admin") {
        throw new Error(`admin settings assertion failed: HTTP ${settingsResponse.status()}, role=${settings?.currentRole ?? "missing"}`);
      }

      await page.goto(new URL("/settings", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
      const companyName = await page.locator('input[id$="-companyName-input"]').first().inputValue().catch(() => "");
      if (companyName !== expectedOrg) {
        throw new Error(`admin identity resolved to unexpected organization "${companyName}"`);
      }

      await page.goto(new URL("/customers/new", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
      await page.locator('[name="name"]').fill(customerName);
      await page.locator('[name="email"]').fill(`s052-admin-${suffix}@example.invalid`);
      await page.getByRole("button", { name: "Create customer" }).click();
      await page.waitForURL(/\/customers\/[^/?]+(?:\?|$)/, { timeout: 60_000 });
      const customerId = /\/customers\/([^/?]+)/.exec(page.url())?.[1];
      if (!customerId) throw new Error("admin-created Customer id was not present in the destination URL");

      await page.goto(new URL("/projects/new", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
      await page.locator("select[name=customerId]").selectOption({ label: customerName });
      await page.locator('[name="name"]').fill(projectName);
      await page.locator('[name="jobType"]').fill("S052 certification");
      await page.locator('[name="siteAddress"]').fill("300 Admin Evidence Way");
      await page.locator('[name="simpleScope"]').fill(scope);
      await page.getByRole("button", { name: "Create project" }).click();
      await page.waitForURL(/\/projects(?:\?|$)/, { timeout: 60_000 });
      const projectLink = page.locator('a[href^="/projects/"]').filter({ hasText: projectName }).first();
      const projectHref = await projectLink.getAttribute("href");
      const projectId = projectHref ? /\/projects\/([^/?]+)/.exec(projectHref)?.[1] : null;
      if (!projectId) throw new Error(`admin-created Project id was not found; href=${projectHref ?? "missing"}`);
      await projectLink.click();
      await page.waitForURL(new RegExp(`/projects/${projectId}(?:$|[/?])`), { timeout: 60_000 });
      await page.waitForLoadState("networkidle");

      const projectResponse = await context.request.get(new URL(`/api/proxy/projects/${projectId}`, parsedBaseUrl).toString());
      const project = projectResponse.status() === 200 ? await projectResponse.json() : null;
      if (
        projectResponse.status() !== 200 ||
        project?.customerId !== customerId ||
        project?.siteAddress !== "300 Admin Evidence Way" ||
        project?.simpleScope !== scope
      ) {
        throw new Error(`admin Project persistence assertion failed: HTTP ${projectResponse.status()}`);
      }

      const bodyText = (await page.locator("body").innerText()).trim();
      const truth = assessScreenshotTruth({
        pathname: new URL(page.url()).pathname,
        title: await page.title(),
        bodyText,
        checkpoint: "s052-admin",
      });
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const quality = assessResponsiveQuality({ viewport: viewport.name, ...dimensions });
      if (!truth.ok) throw new Error(`admin screenshot truth failed: ${truth.problems.join("; ")}`);
      if (!quality.ok) throw new Error(`admin responsive gate failed: ${quality.problems.join("; ")}`);

      const screenshotDir = path.join(outDir, viewport.name, "screenshots");
      await fs.mkdir(screenshotDir, { recursive: true });
      const file = screenshotFileName(viewport.name, "02d", "s052-admin");
      await page.screenshot({ path: path.join(screenshotDir, file), fullPage: false });

      report.admin.push({
        viewport: viewport.name,
        identity: masked(adminEmail),
        role: settings.currentRole,
        customerId,
        projectId,
        screenshot: file,
        passed: true,
      });
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    try {
      await signIn(page, inactiveEmail, inactivePassword);
      const inactiveAlert = page.getByRole("alert");
      await inactiveAlert.waitFor({ timeout: 60_000 });
      const inactiveMessage = (await inactiveAlert.innerText()).trim();
      const finalPath = new URL(page.url()).pathname;
      const settingsResponse = await context.request.get(new URL("/api/proxy/settings", parsedBaseUrl).toString());
      const denied = settingsResponse.status() === 401 || settingsResponse.status() === 403;
      const bootstrapDenied = inactiveMessage === "Authenticated user is not provisioned in this organization";
      if (!bootstrapDenied || !denied || finalPath === "/dashboard") {
        throw new Error(
          `inactive membership was not proven: bootstrapDenied=${bootstrapDenied}, path=${finalPath}, settings HTTP ${settingsResponse.status()}`,
        );
      }
      report.inactiveMembership = {
        identity: masked(inactiveEmail),
        finalPath,
        settingsStatus: settingsResponse.status(),
        bootstrapDenied: true,
        passed: true,
      };
    } finally {
      await context.close();
    }
  }

  if (!["1440", "768", "390"].every((name) => report.admin.some((entry) => entry.viewport === name && entry.passed))) {
    throw new Error("admin evidence did not pass all required 1440/768/390 viewports");
  }
  if (!report.inactiveMembership?.passed) {
    throw new Error("inactive-membership denial was not proven");
  }

  report.result = "PASS";
} catch (error) {
  failure = error;
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  await fs.writeFile(path.join(outDir, "s052-role-report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

if (failure) {
  console.error(`::error::[s052-role-evidence] ${failure.message}`);
  process.exit(1);
}
console.log("S052 role evidence PASS — admin 1440/768/390 and inactive-membership denial verified");
