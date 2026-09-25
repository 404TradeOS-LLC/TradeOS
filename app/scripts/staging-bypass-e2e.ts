import { chromium } from "playwright";
import { STAGING_AUTH } from "../domain";

async function main(): Promise<void> {
  const webUrl = process.env.PLAYWRIGHT_BASE_URL;
  const apiUrl = process.env.PLAYWRIGHT_API_URL;
  if (!webUrl || !apiUrl) throw new Error("PLAYWRIGHT_BASE_URL and PLAYWRIGHT_API_URL are required");
  const web = new URL(webUrl);
  const api = new URL(apiUrl);
  const approvedPreview = (host: string) =>
    /^(?:tradeos-costbook|tradeos-costbook-web)-[a-z0-9-]+\.vercel\.app$/.test(host) &&
    !host.includes("-git-main-");
  if (web.protocol !== "https:" || api.protocol !== "https:" ||
      !approvedPreview(web.hostname) || !approvedPreview(api.hostname) || web.hostname === api.hostname) {
    throw new Error("Staging bypass E2E requires TradeOS Vercel Preview URLs");
  }

  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL === "chrome" ? { channel: "chrome" as const } : {}) });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => failures.push(`network: ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? "failed"}`));
    page.on("response", (response) => {
      if (response.status() >= 400 && !response.url().includes("/favicon")) {
        failures.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
      }
    });
    for (const path of ["/dashboard", `/projects/${STAGING_AUTH.projectId}/estimates/${STAGING_AUTH.estimateId}`]) {
      const response = await page.goto(new URL(path, web).toString(), { waitUntil: "domcontentloaded" });
      if (response?.status() !== 200 || new URL(page.url()).pathname === "/login") {
        throw new Error(`${path} did not load authenticated (HTTP ${response?.status() ?? "none"})`);
      }
      await page.getByText("STAGING · AUTH BYPASS", { exact: true }).waitFor();
      if (path === "/dashboard") await page.getByRole("heading", { name: "TradeOS Staging E2E Fixtures" }).waitFor();
      else await page.getByText("Estimate v1", { exact: true }).first().waitFor();
      process.stdout.write(`PASS ${path}\n`);
    }
    const protectedResponse = await context.request.get(new URL("/api/v1/settings", api).toString(), {
      headers: { Authorization: `Bearer ${STAGING_AUTH.marker}` },
    });
    if (!protectedResponse.ok()) throw new Error(`Protected API returned HTTP ${protectedResponse.status()}`);
    if (failures.length) throw new Error(`Browser failures: ${failures.join("; ")}`);
    process.stdout.write("PASS protected API and browser error checks\n");
  } finally {
    await browser.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
