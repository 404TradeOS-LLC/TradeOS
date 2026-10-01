import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export function resolveBrowserImage(lock) {
  const version = lock.packages?.["node_modules/playwright"]?.version;
  assert.match(version ?? "", /^\d+\.\d+\.\d+$/, "A stable locked Playwright version is required");
  assert.equal(lock.packages?.["node_modules/playwright-core"]?.version, version,
    "playwright and playwright-core must use the same locked version");
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}

export async function verifyBrowserRuntime({ image, lock, installedVersion, chromium }) {
  assert.equal(image, resolveBrowserImage(lock), "Docker image must match the checked-out lockfile");
  assert.equal(installedVersion, lock.packages["node_modules/playwright"].version,
    "Installed Playwright must match the Docker image");
  const executable = chromium.executablePath();
  assert.ok(executable.startsWith("/ms-playwright/"), "Use the container's preinstalled Chromium");
  await fs.access(executable, fs.constants.X_OK);
  const browser = await chromium.launch({ headless: true });
  try {
    return { image, playwrightVersion: installedVersion, chromiumVersion: browser.version() };
  } finally {
    await browser.close();
  }
}

async function main() {
  const lock = JSON.parse(await fs.readFile(path.join(repoRoot, "app/package-lock.json"), "utf8"));
  const image = resolveBrowserImage(lock);
  if (process.argv[2] === "resolve") {
    assert.ok(process.env.GITHUB_OUTPUT, "GITHUB_OUTPUT is required");
    await fs.appendFile(process.env.GITHUB_OUTPUT, `image=${image}\n`);
    console.log(`Selected ${image} from app/package-lock.json`);
  } else if (process.argv[2] === "verify") {
    const require = createRequire(path.join(repoRoot, "app/package.json"));
    const { chromium } = require("playwright");
    const runtime = await verifyBrowserRuntime({
      image: process.env.PLAYWRIGHT_DOCKER_IMAGE,
      lock,
      installedVersion: require("playwright/package.json").version,
      chromium,
    });
    const evidenceDir = process.env.BETA_EVIDENCE_DIR;
    assert.ok(evidenceDir, "BETA_EVIDENCE_DIR is required for runner evidence");
    await fs.mkdir(evidenceDir, { recursive: true });
    await fs.writeFile(path.join(evidenceDir, "browser-runtime.json"),
      JSON.stringify({ ...runtime, sourceSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT }, null, 2) + "\n");
    console.log(`Chromium ${runtime.chromiumVersion} launched successfully inside ${image}`);
  } else {
    throw new Error("Usage: node scripts/browser-container.mjs resolve|verify");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::Browser container: ${error.message}`);
    process.exitCode = 1;
  });
}
