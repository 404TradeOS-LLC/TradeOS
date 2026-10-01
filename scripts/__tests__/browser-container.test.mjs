import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import { resolveBrowserImage, verifyBrowserRuntime } from "../browser-container.mjs";

const locked = (version = "1.63.0", core = version) => ({
  packages: {
    "node_modules/playwright": { version },
    "node_modules/playwright-core": { version: core },
  },
});

test("the official image follows a locked upgrade without a workflow edit", () => {
  assert.equal(resolveBrowserImage(locked()), "mcr.microsoft.com/playwright:v1.63.0-noble");
  assert.equal(resolveBrowserImage(locked("1.64.1")), "mcr.microsoft.com/playwright:v1.64.1-noble");
});

test("missing, mismatched, prerelease, and injected versions fail closed", () => {
  assert.throws(() => resolveBrowserImage({}), /stable locked/);
  assert.throws(() => resolveBrowserImage(locked("1.63.0", "1.62.0")), /same locked/);
  for (const version of ["latest", "1.63.0-beta", "1.63.0\nimage=evil", "../../other"]) {
    assert.throws(() => resolveBrowserImage(locked(version)), /stable locked/);
  }
});

test("a wrong container or installed package is refused before browser launch", async () => {
  for (const runtime of [
    { image: "mcr.microsoft.com/playwright:v1.62.0-noble", installedVersion: "1.63.0" },
    { image: "mcr.microsoft.com/playwright:v1.63.0-noble", installedVersion: "1.62.0" },
  ]) {
    await assert.rejects(verifyBrowserRuntime({ ...runtime, lock: locked(), chromium: null }),
      /must match/);
  }
});

test("a browser from the host cache cannot masquerade as the container browser", async () => {
  await assert.rejects(verifyBrowserRuntime({
    image: resolveBrowserImage(locked()),
    installedVersion: "1.63.0",
    lock: locked(),
    chromium: { executablePath: () => "/home/runner/.cache/chromium" },
  }), /preinstalled Chromium/);
});

for (const file of ["beta-evidence.yml", "s027-browser-evidence.yml"]) {
  test(`${file} uses a lock-derived container and preserves evidence safeguards`, () => {
    const workflow = yaml.load(readFileSync(`.github/workflows/${file}`, "utf8"));
    assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
    assert.deepEqual(workflow.permissions, { contents: "read" });
    assert.equal(workflow.concurrency.group, "tradeos-beta-evidence");
    assert.equal(workflow.concurrency["cancel-in-progress"], false);
    assert.equal(workflow.jobs.evidence.needs, "runtime");
    assert.equal(workflow.jobs.evidence.container.image, "${{ needs.runtime.outputs.image }}");
    assert.match(workflow.jobs.evidence.container.options, /--ipc=host/);
    assert.equal(workflow.jobs.evidence.env.PLAYWRIGHT_BROWSERS_PATH, "/ms-playwright");
    assert.equal(workflow.jobs.evidence.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, "1");
    assert.ok(workflow.jobs.evidence["timeout-minutes"] > 0);
    const steps = workflow.jobs.evidence.steps;
    const verification = steps.findIndex((step) => step.run?.includes("browser-container.mjs verify"));
    const authentication = steps.findIndex((step) => step.run?.includes("auth-setup.mjs"));
    assert.ok(verification >= 0 && authentication > verification);
    assert.ok(!steps.some((step) => step.run?.includes("playwright install")));
    assert.ok(!steps.some((step) => step["continue-on-error"]));
    assert.equal(steps.find((step) => step.name === "Remove runtime storage state").if, "always()");
    const upload = steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    assert.match(upload.if, /steps\.credential_scan\.outcome == 'success'/);
    assert.match(upload.uses, /@[a-f0-9]{40}$/);
  });
}
