import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/playwright-agent-evidence.yml", "utf8");
const config = fs.readFileSync("playwright.config.ts", "utf8");
const launcher = fs.readFileSync("tests/playwright/mcp-server.mjs", "utf8");
const authenticated = fs.readFileSync("tests/playwright/authenticated.spec.ts", "utf8");

test("Playwright agent evidence workflow stays manual, read-only, and Chromium-only", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /playwright test --project=chromium/);
  assert.match(workflow, /TRADEOS_AGENT_EVIDENCE: "true"/);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
  assert.match(workflow, /authenticated_smoke:/);
  assert.match(workflow, /Require authenticated smoke prerequisites[\s\S]*?env:[\s\S]*?BETA_SMOKE_EMAIL: \$\{\{ secrets\.BETA_RC_SMOKE_EMAIL \}\}[\s\S]*?BETA_SMOKE_PASSWORD: \$\{\{ secrets\.BETA_RC_SMOKE_PASSWORD \}\}/);
  assert.match(workflow, /Authenticate sanitized smoke tenant[\s\S]*?env:[\s\S]*?BETA_SMOKE_EMAIL: \$\{\{ secrets\.BETA_RC_SMOKE_EMAIL \}\}[\s\S]*?BETA_SMOKE_PASSWORD: \$\{\{ secrets\.BETA_RC_SMOKE_PASSWORD \}\}/);
  const jobEnv = workflow.match(/    env:\n([\s\S]*?)\n\n    steps:/)?.[1] ?? "";
  assert.doesNotMatch(jobEnv, /BETA_SMOKE_(?:EMAIL|PASSWORD)/);
  assert.match(workflow, /node app\/scripts\/beta-evidence\/auth-setup\.mjs/);
  assert.match(workflow, /TRADEOS_AGENT_STORAGE_STATE=/);
  assert.match(workflow, /Remove runtime storage state/);
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

test("authenticated evidence stays read-only across contractor and document lifecycle workspaces", () => {
  assert.equal((authenticated.match(/\n  test\('/g) ?? []).length, 8);
  assert.match(authenticated, /TRADEOS_AGENT_AUTHENTICATED === 'true'/);
  assert.match(authenticated, /test\.use\(\{ storageState, trace: 'off' \}\)/);
  assert.match(authenticated, /page\.goto\('\/dashboard'/);
  assert.match(authenticated, /name: 'Today'/);
  assert.match(authenticated, /'Needs you'/);
  assert.match(authenticated, /page\.goto\('\/customers'/);
  assert.match(authenticated, /Customer workspace sections/);
  assert.match(authenticated, /page\.goto\('\/projects'/);
  assert.match(authenticated, /Lead workspace/);
  assert.match(authenticated, /page\.goto\('\/estimates'/);
  assert.match(authenticated, /name: 'Estimate from scope'/);
  assert.match(authenticated, /Athena review/);
  assert.match(authenticated, /tab=proposals/);
  assert.match(authenticated, /Proposal Review/);
  assert.match(authenticated, /tab=contracts/);
  assert.match(authenticated, /Contract overview/);
  assert.match(authenticated, /tab=invoices/);
  assert.match(authenticated, /Invoice financial summary/);
  assert.match(authenticated, /function firstDetailHref/);
  assert.match(authenticated, /detailId !== 'new'/);
  assert.doesNotMatch(authenticated, /\.click\(/);
  assert.doesNotMatch(authenticated, /\.fill\(/);
});
