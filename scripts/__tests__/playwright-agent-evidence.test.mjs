import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { firstDetailHref } from "../../tests/playwright/evidence-links.mjs";

const workflow = fs.readFileSync(".github/workflows/playwright-agent-evidence.yml", "utf8");
const config = fs.readFileSync("playwright.config.ts", "utf8");
const launcher = fs.readFileSync("tests/playwright/mcp-server.mjs", "utf8");
const mcpConfig = fs.readFileSync("playwright.mcp.config.ts", "utf8");
const repoMcpConfig = JSON.parse(fs.readFileSync(".mcp.json", "utf8"));
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

test("agent MCP starts using its unrestricted browser config, not the release target guard", () => {
  assert.match(launcher, /run-test-mcp-server/);
  assert.match(launcher, /playwright\.mcp\.config\.ts/);
  assert.match(launcher, /PLAYWRIGHT_MCP_ALLOWED_ORIGINS: _allowed/);
  assert.match(launcher, /PLAYWRIGHT_MCP_BLOCKED_ORIGINS: _blocked/);
  assert.doesNotMatch(launcher, /resolveAgentTarget/);
  assert.doesNotMatch(launcher, /PLAYWRIGHT_MCP_ALLOWED_ORIGINS: target/);
});

test("agent MCP accepts arbitrary browser origins while CI remains gated", () => {
  assert.match(mcpConfig, /TRADEOS_AGENT_BASE_URL/);
  assert.match(mcpConfig, /127\.0\.0\.1:3000/);
  assert.doesNotMatch(mcpConfig, /resolveAgentTarget|SANITIZED_TENANT|ALLOWED_ORIGINS/);
  assert.match(config, /resolveAgentTarget\(process\.env\)/);
  assert.equal(repoMcpConfig.mcpServers["playwright-test"].command, "node");
  assert.deepEqual(repoMcpConfig.mcpServers["playwright-test"].args, ["tests/playwright/mcp-server.mjs"]);
});

test("agent MCP project selects Firefox, not Chromium", () => {
  assert.match(mcpConfig, /name: 'firefox'/);
  assert.match(mcpConfig, /devices\['Desktop Firefox'\]/);
  assert.doesNotMatch(mcpConfig, /Desktop Chrome/);
});

test("Codex test agents can write the plans and specs they are assigned to create", () => {
  for (const role of ["planner", "generator", "healer"]) {
    const agent = fs.readFileSync(`.codex/agents/playwright_test_${role}.toml`, "utf8");
    assert.match(agent, /sandbox_mode = "workspace-write"/);
    assert.match(agent, /Browser navigation through the Playwright MCP may use any HTTP\(S\) origin/);
  }
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
  assert.match(authenticated, /firstProjectDocumentHref/);
  assert.match(authenticated, /'proposals'[\s\S]*?Customer-facing scope and pricing history\./);
  assert.match(authenticated, /Proposal Review/);
  assert.match(authenticated, /'contracts'[\s\S]*?Signed and pending project agreements\./);
  assert.match(authenticated, /Contract overview/);
  assert.match(authenticated, /'invoices'[\s\S]*?Billing history and outstanding balances\./);
  assert.match(authenticated, /Invoice financial summary/);
  assert.match(authenticated, /firstDetailHref/);
  assert.match(authenticated, /for \(const projectHref of projectHrefs\)/);
  assert.match(authenticated, /data-slot="card-title"/);
  assert.doesNotMatch(authenticated, /\.click\(/);
  assert.doesNotMatch(authenticated, /\.fill\(/);
});

test("document detail href selection rejects action and nested routes", () => {
  const prefix = "/projects/project-1/proposals/";
  assert.equal(
    firstDetailHref(
      [
        `${prefix}new`,
        `${prefix}proposal-1/preview`,
        `${prefix}proposal-1`,
      ],
      prefix,
    ),
    `${prefix}proposal-1`,
  );
  assert.equal(
    firstDetailHref(
      [
        `${prefix}new`,
        `${prefix}proposal-1/preview`,
      ],
      prefix,
    ),
    undefined,
  );
});

test("estimate stage state is exported only for authenticated runs, spec input stays out of the shell, and tenant verification can use the read-only endpoint", () => {
  // A nonexistent state file makes Playwright fail before creating a page,
  // so the estimate-stage variable is exported only when the authenticated
  // bootstrap runs (a failed bootstrap aborts the job first).
  assert.match(
    workflow,
    /TRADEOS_AGENT_AUTHENTICATED === "true"[\s\S]*?TRADEOS_ESTIMATE_STAGE_STATE=/,
  );
  // Both outcomes of the export condition: the authenticated branch
  // exports the state path, and the unauthenticated branch exports
  // nothing. An unconditional export would fail the second assertion,
  // and a second export site would fail the count below.
  assert.match(
    workflow,
    /process\.env\.TRADEOS_AGENT_AUTHENTICATED === "true"\s*\n\s*\? \[`TRADEOS_ESTIMATE_STAGE_STATE=\$\{storageStatePath\}`\]\s*\n\s*: \[\]/,
  );
  assert.equal(workflow.match(/TRADEOS_ESTIMATE_STAGE_STATE=/g)?.length, 1);
  // spec_file must reach the shell through the environment only: direct
  // ${{ inputs.* }} interpolation into a run script is template injection.
  // (The env assignment itself is the sanctioned passthrough.)
  assert.doesNotMatch(workflow, /if \[ -n "\$\{\{ inputs\.spec_file \}\}" \]/);
  assert.doesNotMatch(workflow, /playwright test --project=chromium "\$\{\{ inputs\.spec_file \}\}"/);
  assert.match(workflow, /SPEC_FILE: \$\{\{ inputs\.spec_file \}\}/);
  assert.match(workflow, /if \[ -n "\$\{SPEC_FILE\}" \]/);
  // Supplying the canonical org UUID switches tenant verification to the
  // read-only Costbook workspace endpoint instead of loading Settings,
  // which may persist a BrandProfile for legacy-branding tenants.
  assert.match(workflow, /smoke_org_id:/);
  assert.match(workflow, /BETA_SMOKE_TENANT_VERIFY_MODE=costbook_read_only/);
  assert.match(workflow, /BETA_SMOKE_ORG_ID: \$\{\{ inputs\.smoke_org_id \}\}/);
  assert.match(workflow, /BETA_SMOKE_EXPECTED_COSTBOOK_WRITE=true/);
});

test("evidence workflow validates spec_file to one exact spec and rejects targeted estimate runs without a draft route", () => {
  // A substring spec_file would silently match several specs (or none)
  // while Playwright still exits green; require one checked-in file.
  assert.match(workflow, /Validate spec_file resolves to one exact spec/);
  assert.match(workflow, /if \[ ! -f "\$\{SPEC_FILE\}" \]; then/);
  assert.match(workflow, /spec_file must name one checked-in Playwright spec file/);
  assert.match(workflow, /tests\/playwright\/\*\.spec\.ts\)/);
  // The estimate specs skip every test when the draft route is blank, so
  // a targeted run without one would report green while proving nothing.
  assert.match(workflow, /Reject targeted estimate runs without a draft route/);
  assert.match(workflow, /\*estimate-stage-navigation\.spec\.ts\|\*estimate-mapping-resolve\.spec\.ts\)/);
  assert.match(workflow, /if \[ -z "\$\{ESTIMATE_STAGE_PATH\}" \]; then/);
  assert.match(workflow, /targeted estimate evidence requires a draft estimate route/);
  // The positional argument is exact only because the validation step ran
  // first; the run step records that.
  assert.match(workflow, /The "Validate spec_file" step already proved this is one exact/);
});

test("evidence workflow rejects unauthenticated estimate runs and CLI-option spec files", () => {
  // An estimate path without a session would run the estimate specs
  // against the login page and report a misleading navigation failure.
  // The guard fails fast before any install or target resolution.
  assert.match(workflow, /Reject unauthenticated estimate evidence/);
  assert.match(
    workflow,
    /if \[ "\$\{TRADEOS_AGENT_AUTHENTICATED\}" != "true" \] && \[ -n "\$\{TRADEOS_ESTIMATE_STAGE_PATH\}" \]; then/,
  );
  assert.match(workflow, /estimate_stage_path requires authenticated_smoke/);
  // A hyphen-leading spec_file would be parsed as a Playwright CLI
  // option instead of a spec path. Valid spec paths never start with one.
  assert.match(workflow, /case "\$\{SPEC_FILE\}" in/);
  assert.match(workflow, /spec_file must be a spec file path, not a Playwright CLI option/);
});
