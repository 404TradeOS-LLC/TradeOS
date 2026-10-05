import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/playwright-agent-evidence.yml", "utf8");
const config = fs.readFileSync("playwright.config.ts", "utf8");
const launcher = fs.readFileSync("tests/playwright/mcp-server.mjs", "utf8");

test("Playwright agent evidence workflow stays manual, read-only, and Chromium-only", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /playwright test --project=chromium/);
  assert.match(workflow, /TRADEOS_AGENT_EVIDENCE: "true"/);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
});

test("evidence mode produces reviewable Playwright artifacts", () => {
  assert.match(config, /TRADEOS_AGENT_EVIDENCE/);
  assert.match(config, /\['html', \{ outputFolder: 'playwright-report', open: 'never' \}\]/);
  assert.match(config, /screenshot: evidenceMode \? 'on' : 'off'/);
  assert.match(config, /trace: evidenceMode \? 'retain-on-failure' : 'off'/);
  assert.match(config, /video: evidenceMode \? 'retain-on-failure' : 'off'/);
});

test("agent MCP startup constrains browser requests to the validated target", () => {
  assert.match(launcher, /resolveAgentTarget\(process\.env\)/);
  assert.match(launcher, /PLAYWRIGHT_MCP_ALLOWED_ORIGINS: target/);
  assert.match(launcher, /run-test-mcp-server/);
});
