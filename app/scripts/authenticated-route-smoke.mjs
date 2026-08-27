import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RC_BASE_URL;
const storageState = process.env.RC_STORAGE_STATE_PATH;
const outDir = process.env.RC_EVIDENCE_DIR || "../artifacts/rc-smoke";
const targetEnvironment = process.env.RC_TARGET_ENVIRONMENT;
const captureScreenshots = process.env.RC_CAPTURE_SCREENSHOTS === "true";
const sanitizedTenant = process.env.RC_SANITIZED_TENANT === "true";
const routes = (process.env.RC_ROUTES ||
  "/dashboard,/customers,/projects,/dispatch,/field,/costbook")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!baseUrl) throw new Error("RC_BASE_URL is required.");
if (!storageState) throw new Error("RC_STORAGE_STATE_PATH is required.");
if (!targetEnvironment) throw new Error("RC_TARGET_ENVIRONMENT is required.");
if (!["preview", "staging", "production"].includes(targetEnvironment)) {
  throw new Error("RC_TARGET_ENVIRONMENT must be preview, staging, or production.");
}
if (captureScreenshots && targetEnvironment === "production") {
  throw new Error("Screenshots are disabled for production smoke runs.");
}
if (captureScreenshots && !sanitizedTenant) {
  throw new Error("RC_SANITIZED_TENANT=true is required before screenshots are captured.");
}

const parsedBaseUrl = new URL(baseUrl);
if (!/^https?:$/.test(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("RC_BASE_URL must be an HTTP(S) URL without embedded credentials.");
}
for (const route of routes) {
  const parsedRoute = new URL(route, parsedBaseUrl);
  if (!route.startsWith("/") || parsedRoute.origin !== parsedBaseUrl.origin) {
    throw new Error(`RC_ROUTES must contain same-origin absolute paths: ${route}`);
  }
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let workflowError = null;

try {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  for (const route of routes) {
    const url = new URL(route, baseUrl).toString();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    const status = response?.status() ?? 0;
    const finalUrl = page.url();
    const bodyTextLength = await page.locator("body").innerText().then((text) => text.trim().length);
    const stayedAuthenticated = new URL(finalUrl).pathname !== "/login";
    const passed = status > 0 && status < 400 && bodyTextLength > 0 && stayedAuthenticated;
    const safeName = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
    let screenshot = null;
    if (captureScreenshots) {
      screenshot = path.join(outDir, `${safeName}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
    }
    results.push({ route, url, finalUrl, status, bodyTextLength, passed, screenshot });
    if (!passed) throw new Error(`${route} failed smoke check: status=${status}, body=${bodyTextLength}, finalUrl=${finalUrl}.`);
  }
  await context.close();
} catch (error) {
  workflowError = error;
} finally {
  await browser.close();
  await fs.writeFile(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        targetEnvironment,
        captureScreenshots,
        sanitizedTenant,
        results,
        error: workflowError instanceof Error ? workflowError.message : workflowError,
      },
      null,
      2,
    ),
  );
}

if (workflowError) throw workflowError;
console.log(JSON.stringify(results, null, 2));
