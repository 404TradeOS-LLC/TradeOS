import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RC_BASE_URL;
const email = process.env.RC_AUTH_EMAIL;
const password = process.env.RC_AUTH_PASSWORD;
const rejectedPassword = process.env.RC_AUTH_REJECTED_PASSWORD;
const targetEnvironment = process.env.RC_TARGET_ENVIRONMENT;
const outDir = process.env.RC_EVIDENCE_DIR || "../artifacts/rc-smoke";

if (!baseUrl) throw new Error("RC_BASE_URL is required.");
if (!email || !password || !rejectedPassword) {
  throw new Error("RC_AUTH_EMAIL, RC_AUTH_PASSWORD, and RC_AUTH_REJECTED_PASSWORD are required.");
}
if (password === rejectedPassword) throw new Error("The rejected-password fixture must differ from the valid password.");
if (!["preview", "staging"].includes(targetEnvironment)) {
  throw new Error("Authentication smoke requires an explicitly selected preview or staging environment.");
}

const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("RC_BASE_URL must be an HTTPS URL without embedded credentials.");
}
if (!/^tradeos-costbook-web-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(parsedBaseUrl.hostname)) {
  throw new Error("RC_TARGET_ENVIRONMENT must use an approved tradeos-costbook-web Vercel Preview host.");
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const steps = [];
let workflowError = null;

async function recordStep(name, action) {
  try {
    await action();
    steps.push({ name, passed: true });
  } catch (error) {
    steps.push({ name, passed: false, error: error instanceof Error ? error.name : "UnknownError" });
    throw error;
  }
}

async function openLoginPage(page) {
  await page.goto(new URL("/login", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  const finalUrl = new URL(page.url());
  if (finalUrl.protocol !== "https:" || finalUrl.origin !== parsedBaseUrl.origin) {
    throw new Error("Login navigation left the approved HTTPS smoke origin before credentials were entered.");
  }
}

try {
  await recordStep("rejected credentials stay on login with an error", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await openLoginPage(page);
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="password"]').fill(rejectedPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("alert").waitFor({ state: "visible", timeout: 60_000 });
    if (new URL(page.url()).pathname !== "/login") throw new Error("Rejected credentials left the login route.");
    await context.close();
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  await recordStep("successful login reaches the authenticated workspace", async () => {
    await openLoginPage(page);
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await Promise.race([
      page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60_000 }),
      page.getByRole("alert").waitFor({ state: "visible", timeout: 60_000 }).then(() => {
        throw new Error("RC smoke owner login returned an alert before reaching the authenticated workspace.");
      }),
    ]);
  });

  await recordStep("authenticated session survives a page refresh", async () => {
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
    if (new URL(page.url()).pathname !== "/dashboard") throw new Error("Session was not retained after refresh.");
  });

  await recordStep("logout clears the authenticated session", async () => {
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 60_000 });
  });

  await recordStep("expired or logged-out session redirects from a protected route", async () => {
    await page.goto(new URL("/dashboard", parsedBaseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
    if (new URL(page.url()).pathname !== "/login") throw new Error("Protected route remained accessible after logout.");
  });
  await context.close();
} catch (error) {
  workflowError = error;
} finally {
  await browser.close();
  await fs.writeFile(
    path.join(outDir, "auth-report.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), baseUrl, targetEnvironment, steps, error: workflowError instanceof Error ? workflowError.name : workflowError },
      null,
      2,
    ),
  );
}

if (workflowError) throw workflowError;
console.log(JSON.stringify(steps, null, 2));
