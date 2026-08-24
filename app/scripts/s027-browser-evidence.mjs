import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.S027_BASE_URL;
const targetPath = process.env.S027_TARGET_PATH || "/costbook";
const storageState = process.env.S027_STORAGE_STATE_PATH;
const outDir = process.env.S027_EVIDENCE_DIR || "../artifacts/s027-browser-evidence";

if (!baseUrl) throw new Error("S027_BASE_URL is required.");
if (!storageState) throw new Error("S027_STORAGE_STATE_PATH is required.");

const viewports = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "1024", width: 1024, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

await fs.mkdir(outDir, { recursive: true });
const report = [];
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      storageState,
    });
    const page = await context.newPage();
    const url = new URL(targetPath, baseUrl).toString();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    const status = response?.status() ?? 0;
    if (status >= 400 || status === 0) {
      throw new Error(`${viewport.name}px navigation returned HTTP ${status}.`);
    }

    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => ({
      title: document.title,
      href: location.href,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyTextLength: document.body?.innerText?.trim().length ?? 0,
    }));

    if (metrics.bodyTextLength === 0) {
      throw new Error(`${viewport.name}px rendered an empty body.`);
    }
    if (metrics.scrollWidth > metrics.clientWidth + 2) {
      throw new Error(
        `${viewport.name}px has horizontal overflow: ${metrics.scrollWidth} > ${metrics.clientWidth}.`,
      );
    }

    const screenshot = path.join(outDir, `costbook-${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    report.push({ viewport, status, screenshot, ...metrics });
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outDir, "report.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, targetPath, report }, null, 2),
);
console.log(JSON.stringify(report, null, 2));
