import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RC_BASE_URL;
const email = process.env.RC_FIELD_AUTH_EMAIL;
const password = process.env.RC_AUTH_PASSWORD;
const storageStatePath = process.env.RC_FIELD_STORAGE_STATE_PATH;
const targetEnvironment = process.env.RC_TARGET_ENVIRONMENT;
const outDir = process.env.RC_EVIDENCE_DIR || "../artifacts/rc-smoke";

if (!baseUrl) throw new Error("RC_BASE_URL is required.");
if (!email) throw new Error("RC_FIELD_AUTH_EMAIL is required.");
if (!password) throw new Error("RC_AUTH_PASSWORD is required for the field technician fixture.");
if (!storageStatePath) throw new Error("RC_FIELD_STORAGE_STATE_PATH is required.");
if (!targetEnvironment || !["preview", "staging"].includes(targetEnvironment)) {
  throw new Error("RC_TARGET_ENVIRONMENT must be preview or staging.");
}

const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("RC_BASE_URL must be an HTTPS URL without embedded credentials.");
}
if (!/^tradeos-costbook-web-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(parsedBaseUrl.hostname)) {
  throw new Error("Field session generation requires an approved tradeos-costbook-web Vercel Preview host.");
}

await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
let workflowError = null;
const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  targetEnvironment,
  email,
  roleSurface: "/field",
  passed: false,
};

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(new URL("/login", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60_000 });

  const fieldResponse = await page.goto(new URL("/field", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  const finalUrl = new URL(page.url());
  const bodyText = await page.locator("body").innerText();
  const fieldReady =
    (fieldResponse?.status() ?? 0) > 0 &&
    (fieldResponse?.status() ?? 0) < 400 &&
    finalUrl.origin === parsedBaseUrl.origin &&
    finalUrl.pathname === "/field" &&
    bodyText.includes("Field day") &&
    !bodyText.includes("Technician workspace") &&
    !bodyText.includes("Couldn't load your field day");

  if (!fieldReady) {
    throw new Error(`Field technician session did not reach a healthy /field workspace: status=${fieldResponse?.status() ?? 0}, finalUrl=${finalUrl.toString()}.`);
  }

  await context.storageState({ path: storageStatePath });
  await fs.chmod(storageStatePath, 0o600);
  result.passed = true;
  result.finalUrl = finalUrl.toString();
  result.status = fieldResponse?.status() ?? 0;
  await context.close();
} catch (error) {
  workflowError = error;
  result.error = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  await fs.writeFile(path.join(outDir, "field-session-report.json"), JSON.stringify(result, null, 2));
}

if (workflowError) throw workflowError;
console.log(JSON.stringify({ passed: result.passed, roleSurface: result.roleSurface }, null, 2));
