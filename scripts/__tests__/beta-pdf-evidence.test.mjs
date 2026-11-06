import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import yaml from "js-yaml";
import { CHECKPOINTS, VIEWPORTS, screenshotFileName } from "../../app/scripts/beta-evidence/lib/evidence-artifacts.mjs";

const runId = "synthetic-validator-test";
const proposalId = "1643d999-509c-4742-8d68-46c6a9129d55";
const pdf = Buffer.from("%PDF-1.3\ntransport fixture only\n%%EOF\n");
const assertions = [
  "unmapped Athena scope fails safe as setup required",
  "setup-required Athena draft does not write estimate lines",
  "setup-required Athena draft cannot be applied",
  "Athena generation and local acceptance do not silently write estimate lines",
  "explicit Athena apply persists at least one reviewed estimate line",
  "pricing refreshes after the reviewed Athena apply",
  "reviewed Athena saved-line IDs survive an authenticated hard reload",
  "saved direct line costs match the authoritative Estimate Engine snapshots",
  "Estimate Engine persists finalized status and customer total",
  "proposal snapshots selected finalized Estimate identity and exact fixed total",
  "no browser console errors were recorded",
  "no network requests failed",
  "proposal PDF downloads through authenticated document route",
  "proposal financial snapshot survives reload",
];
const extra = [["03a", "s053-setup-required"], ["03b", "s053-athena-review"], ["03c", "s053-athena-applied"]];
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tradeos-beta-pdf-"));
  const write = (name, value) => fs.writeFile(path.join(dir, name), JSON.stringify(value));
  await write("rc-target.json", { runId, shaCorrelated: true });
  await write("auth-setup-report.json", { runId, result: "PASS" });
  await write("tenant-isolation-report.json", { runId, result: "PASS", probes: ["foreign customer", "foreign project", "foreign estimate", "foreign proposal PDF", "foreign S053 Athena draft", "foreign S053 Athena apply"].map(name => ({ name, passed: true, ...(name === "foreign proposal PDF" ? { fixtureProof: { fixtureVerified: true, passed: true, proposalId, smokeOrgId: "11111111-1111-4111-8111-111111111111", ownerOrgId: "22222222-2222-4222-8222-222222222222", apiStatus: 404 } } : {}) })) });
  for (const viewport of VIEWPORTS) {
    await fs.mkdir(path.join(dir, viewport.name, "screenshots"), { recursive: true });
    const checkpoints = [...CHECKPOINTS.filter(c => c.required), ...extra.map(([sequence, name]) => ({ sequence, name }))];
    for (const c of checkpoints) {
      // The existing artifact validator checks signature/IHDR width. This is
      // a validator fixture, not a screenshot or a real browser PASS.
      const png = Buffer.alloc(24);
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
      png.write("IHDR", 12); png.writeUInt32BE(viewport.width, 16); png.writeUInt32BE(viewport.height, 20);
      await fs.writeFile(path.join(dir, viewport.name, "screenshots", screenshotFileName(viewport.name, c.sequence, c.name)), png);
    }
    await write(`${viewport.name}/capture-report.json`, { runId, scenario: "beta_pdf", result: "PASS", checkpoints, assertions: assertions.map(name => ({ name, passed: true })) });
    await write(`${viewport.name}/workflow-records.json`, { runId, proposalId, contractId: null, invoiceId: null });
    await write(`${viewport.name}/proposal-pdf.json`, { runId, proposalId, bytes: pdf.length, sha256: createHash("sha256").update(pdf).digest("hex") });
    await fs.writeFile(path.join(dir, viewport.name, "proposal.pdf"), pdf);
  }
  return { dir, write };
}
function validate(dir, overrides = {}) {
  return spawnSync(process.execPath, ["app/scripts/beta-evidence/validate-artifacts.mjs"], {
    encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "", BETA_VALIDATE_VIEWPORTS: "", BETA_RUN_ID: runId, BETA_SCENARIO: "beta_pdf", BETA_EVIDENCE_DIR: dir, ...overrides },
  });
}
for (const [name, mutate, expected] of [
  ["complete current-run PDF journey", async () => {}, 0],
  ["missing PDF", async ({ dir }) => fs.rm(path.join(dir, "390/proposal.pdf")), 1],
  ["stale PDF receipt", async ({ write }) => write("390/proposal-pdf.json", { runId: "old" }), 1],
  ["tampered PDF bytes", async ({ dir }) => fs.appendFile(path.join(dir, "390/proposal.pdf"), "changed"), 1],
  ["foreign PDF denial missing", async ({ write }) => write("tenant-isolation-report.json", { runId, result: "PASS", probes: [] }), 1],
  ["foreign PDF denial without fixture ownership proof", async ({ dir, write }) => {
    const report = JSON.parse(await fs.readFile(path.join(dir, "tenant-isolation-report.json")));
    delete report.probes.find(p => p.name === "foreign proposal PDF").fixtureProof;
    await write("tenant-isolation-report.json", report);
  }, 1],
  ["wrong scenario report", async ({ write }) => write("390/capture-report.json", { result: "PASS", runId, scenario: "canonical" }), 1],
  ["missing financial continuity assertion", async ({ write }) => write("390/capture-report.json", { runId, scenario: "beta_pdf", result: "PASS", assertions: assertions.filter(name => !name.startsWith("proposal snapshots")).map(name => ({ name, passed: true })) }), 1],
  ["downstream mutation", async ({ write }) => write("390/workflow-records.json", { runId, proposalId, contractId: "unexpected" }), 1],
  ["stale authentication", async ({ write }) => write("auth-setup-report.json", { runId: "old", result: "PASS" }), 1],
  ["stale isolation", async ({ write }) => write("tenant-isolation-report.json", { runId: "old", result: "PASS" }), 1],
  ["uncorrelated deployment", async ({ write }) => write("rc-target.json", { shaCorrelated: false }), 1],
]) {
  test(`PDF evidence validator: ${name}`, async () => {
    const f = await fixture();
    try { await mutate(f); const result = validate(f.dir); assert.equal(result.status, expected, result.stdout + result.stderr);
      if (expected === 0) {
        const metadata = JSON.parse(await fs.readFile(path.join(f.dir, "metadata.json")));
        assert.equal(metadata.result, "PASS");
        assert.equal(metadata.evidenceScope, "customer-project-ai-estimate-proposal-pdf");
        assert.equal(metadata.releaseApproval, "NOT_GRANTED");
        assert.equal(metadata.evidenceRunId, runId);
      } }
    finally { await fs.rm(f.dir, { recursive: true, force: true }); }
  });
}
for (const [name, mutate, expected] of [
  ["matching denial route and status", probe => { probe.apiRoute = `/api/documents/proposals/${proposalId}/pdf`; probe.apiStatus = 404; }, 0],
  ["mismatched denial route", probe => { probe.apiRoute = "/api/documents/proposals/22222222-2222-4222-8222-222222222222/pdf"; }, 1],
  ["mismatched denial status", probe => { probe.apiStatus = 403; }, 1],
  ["proof and PASS split between probes", (probe, probes) => { probe.passed = false; probes.push({ name: probe.name, passed: true }); }, 1],
]) {
  test(`PDF fixture proof binding: ${name}`, async () => {
    const f = await fixture();
    try {
      const report = JSON.parse(await fs.readFile(path.join(f.dir, "tenant-isolation-report.json")));
      mutate(report.probes.find(probe => probe.name === "foreign proposal PDF"), report.probes);
      await f.write("tenant-isolation-report.json", report);
      const result = validate(f.dir);
      assert.equal(result.status, expected, result.stdout + result.stderr);
    } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
  });
}
test("one viewport is PARTIAL, never release PASS", async () => {
  const f = await fixture();
  try {
    const result = validate(f.dir, { BETA_VALIDATE_VIEWPORTS: "390" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const metadata = JSON.parse(await fs.readFile(path.join(f.dir, "metadata.json")));
    assert.equal(metadata.result, "PARTIAL");
  } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
});

// Exercise the real shell gates without credentials, browser access or writes
// to any service. Every independent foreign fixture is required before capture.
test("workflow preflight and full gates reject each missing beta_pdf fixture", async () => {
  const workflow = yaml.load(await fs.readFile(".github/workflows/beta-evidence.yml", "utf8"));
  const steps = Object.values(workflow.jobs)[0].steps;
  const preflight = steps.find(step => step.name === "Report beta evidence readiness");
  const full = steps.find(step => step.name === "Require a provisioned RC smoke identity");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tradeos-beta-gates-"));
  try {
    const flags = Object.fromEntries(Object.keys(preflight.env).map(key => [key, "true"]));
    for (const missing of [null, "BETA_FOREIGN_CUSTOMER_ID", "BETA_FOREIGN_PROJECT_ID", "BETA_FOREIGN_ESTIMATE_ID", "BETA_FOREIGN_PROPOSAL_ID", "BETA_FOREIGN_OWNER_EMAIL", "BETA_FOREIGN_OWNER_PASSWORD", "BETA_FOREIGN_OWNER_ORG_ID"]) {
      const flagsByFixture = { BETA_FOREIGN_CUSTOMER_ID: "HAS_FOREIGN_CUSTOMER", BETA_FOREIGN_PROJECT_ID: "HAS_FOREIGN_PROJECT_S052", BETA_FOREIGN_ESTIMATE_ID: "HAS_FOREIGN_ESTIMATE", BETA_FOREIGN_PROPOSAL_ID: "HAS_FOREIGN_PROPOSAL", BETA_FOREIGN_OWNER_EMAIL: "HAS_FOREIGN_OWNER_EMAIL", BETA_FOREIGN_OWNER_PASSWORD: "HAS_FOREIGN_OWNER_PASSWORD", BETA_FOREIGN_OWNER_ORG_ID: "HAS_FOREIGN_OWNER_ORG" };
      const summary = path.join(dir, "summary.md");
      await fs.writeFile(summary, "");
      const env = { ...process.env, ...flags, BETA_SCENARIO: "beta_pdf", GITHUB_STEP_SUMMARY: summary,
        BETA_RC_BASE_URL_RESOLVED: "https://tradeos-costbook-web-fixture.vercel.app", BETA_SMOKE_EMAIL: "synthetic@example.invalid", BETA_SMOKE_PASSWORD: "synthetic", BETA_RC_SUPABASE_PROJECT_REF: "synthetic",
        BETA_FOREIGN_CUSTOMER_ID: proposalId, BETA_FOREIGN_PROJECT_ID: proposalId, BETA_FOREIGN_ESTIMATE_ID: proposalId, BETA_FOREIGN_PROPOSAL_ID: proposalId, BETA_FOREIGN_OWNER_EMAIL: "foreign@example.invalid", BETA_FOREIGN_OWNER_PASSWORD: "synthetic", BETA_FOREIGN_OWNER_ORG_ID: proposalId };
      if (missing) { env[missing] = ""; env[flagsByFixture[missing]] = "false"; }
      const readiness = spawnSync("bash", ["-c", preflight.run], { env, encoding: "utf8" });
      assert.equal(readiness.status, 0, readiness.stderr);
      assert.match(await fs.readFile(summary, "utf8"), missing ? /Readiness: NOT READY/ : /Readiness: READY/);
      const provisioned = spawnSync("bash", ["-c", full.run], { env, encoding: "utf8" });
      assert.equal(provisioned.status, missing ? 1 : 0, provisioned.stdout + provisioned.stderr);
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
