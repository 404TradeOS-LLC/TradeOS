import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import yaml from "js-yaml";
import { validateRequest, stagingConnection, validateEvidence, migrationName, migrationHash, hash, verifySourceSql, performMigration } from "../staging-job-handoff-migration.mjs";

const sha = "a".repeat(40);
const request = { sourceSha: sha, approvedSha: sha, mode: "apply", confirmation: "APPLY_STAGING_JOB_HANDOFF", ref: "refs/heads/main" };
const baseName = "20260623143000_init_schema";
const inventory = { [baseName]: "b".repeat(64), [migrationName]: migrationHash };
const ledgerRow = (name = baseName) => ({ name, checksum: inventory[name], finished: true, rolled_back: false });
const pending = () => ({ ledger: [ledgerRow()], columns: [], indexes: [], rls: true, forced: true });
const applied = () => ({ ...pending(), ledger: [ledgerRow(), ledgerRow(migrationName)],
  columns: [{ name: "source_proposal_id", type: "text", nullable: true, default: null },
    { name: "accepted_baseline_json", type: "jsonb", nullable: true, default: null }],
  indexes: [{ unique: true, valid: true, ready: true, keys: "source_proposal_id", predicate: null,
    expressions: null, keyCount: 1, totalCount: 1 }] });

test("requires full SHA, trusted main, known mode and exact apply approval", () => {
  validateRequest(request);
  validateRequest({ ...request, mode: "preflight", approvedSha: undefined, confirmation: undefined });
  for (const patch of [{ sourceSha: "main" }, { sourceSha: `${sha};echo nope` }, { ref: "refs/heads/staging" },
    { mode: "deploy" }, { approvedSha: "b".repeat(40) }, { confirmation: "yes" }]) {
    assert.throws(() => validateRequest({ ...request, ...patch }));
  }
});

test("normalizes only verified staging identity to TLS session port", () => {
  for (const connection of [
    "postgresql://postgres:secret@db.qfbgdkbamfaasmtjfyru.supabase.co/postgres?schema=public",
    "postgres://postgres.qfbgdkbamfaasmtjfyru:secret@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
  ]) {
    const url = stagingConnection(connection);
    assert.equal(url.port, "5432");
    assert.equal(url.searchParams.get("sslmode"), "require");
  }
});

test("rejects foreign hosts, wrong project usernames and routing/query overrides without leaking secrets", () => {
  const prefix = "postgresql://postgres:DO_NOT_LOG@db.qfbgdkbamfaasmtjfyru.supabase.co/postgres";
  const invalid = [
    "postgresql://postgres:DO_NOT_LOG@db.production.supabase.co/postgres",
    "postgresql://postgres.wrongproject:DO_NOT_LOG@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
    ...["host=production", "hostaddr=127.0.0.1", "options=-csearch_path=evil", "sslmode=disable", "schema=evil",
      "schema=public&schema=public", "pgbouncer=true"].map(q => `${prefix}?${q}`),
    `${prefix}#bad`, `${prefix.slice(0, prefix.lastIndexOf("/"))}/other`, prefix.replace(":DO_NOT_LOG", ""),
  ];
  for (const connection of invalid) {
    assert.throws(() => stagingConnection(connection), error => !error.message.includes("DO_NOT_LOG"));
  }
});

test("accepts exactly the pending Job migration or verified already-applied schema", () => {
  assert.deepEqual(validateEvidence(inventory, pending()), { targetApplied: false, completed: 1, missing: [migrationName] });
  assert.equal(validateEvidence(inventory, applied(), { requireApplied: true }).targetApplied, true);
  assert.throws(() => validateEvidence(inventory, pending(), { requireApplied: true }));
});

test("rejects equal-count wrong ledger, checksum drift, duplicate success and unfinished rows", () => {
  for (const row of [
    { ...ledgerRow(), name: "unexpected" }, { ...ledgerRow(), checksum: "c".repeat(64) },
    { ...ledgerRow(), finished: false },
  ]) assert.throws(() => validateEvidence(inventory, { ...pending(), ledger: [row] }));
  assert.throws(() => validateEvidence(inventory, { ...pending(), ledger: [ledgerRow(), ledgerRow()] }));
  assert.throws(() => validateEvidence({ ...inventory, another: "c".repeat(64) }, pending()));
  assert.equal(validateEvidence(inventory, { ...pending(), ledger: [{ ...ledgerRow(), finished: false, rolled_back: true }, ledgerRow()] }).completed, 1);
});

test("refuses partial schema, weakened RLS, wrong types/defaults and invalid or partial unique indexes", () => {
  assert.throws(() => validateEvidence(inventory, { ...pending(), columns: applied().columns }));
  for (const flag of ["rls", "forced"]) assert.throws(() => validateEvidence(inventory, { ...pending(), [flag]: false }));
  for (const patch of [{ type: "uuid" }, { nullable: false }, { default: "now()" }]) {
    const evidence = applied(); evidence.columns[0] = { ...evidence.columns[0], ...patch };
    assert.throws(() => validateEvidence(inventory, evidence));
  }
  for (const patch of [{ unique: false }, { valid: false }, { ready: false }, { keys: "other" },
    { predicate: "source_proposal_id IS NOT NULL" }, { expressions: "lower(source_proposal_id)" }, { keyCount: 2 }, { totalCount: 2 }]) {
    const evidence = applied(); evidence.indexes[0] = { ...evidence.indexes[0], ...patch };
    assert.throws(() => validateEvidence(inventory, evidence));
  }
});

test("workflow is manual, main-only, reviewer-gated, staging-scoped and serial with ordinary migration deploy", () => {
  const workflow = yaml.load(fs.readFileSync(new URL("../../.github/workflows/staging-job-handoff-migration.yml", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.equal(workflow.on.workflow_dispatch.inputs.mode.default, "preflight");
  assert.equal(workflow.jobs["job-handoff"].environment, "staging");
  assert.equal(workflow.concurrency.group, "deploy-migrations-staging");
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  const steps = workflow.jobs["job-handoff"].steps;
  assert.match(steps[0].run, /refs\/heads\/main/);
  assert.equal(steps.find(s => s.uses?.startsWith("actions/checkout")).with.ref, "${{ github.sha }}");
  const privileged = steps.filter(s => JSON.stringify(s).includes("secrets."));
  assert.equal(privileged.length, 1);
  assert.equal(privileged[0].env.STAGING_DATABASE_ADMIN_URL, "${{ secrets.STAGING_DATABASE_ADMIN_URL }}");
  assert.equal(privileged[0].run, "node scripts/staging-job-handoff-migration.mjs");
  assert.ok(!JSON.stringify(workflow).includes("production"));
});

test("reviewed SQL checksum is independently pinned and only trusted tooling is executed", () => {
  const source = fs.readFileSync(new URL("../staging-job-handoff-migration.mjs", import.meta.url), "utf8");
  assert.equal(migrationHash, "3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293");
  assert.notEqual(hash("ALTER TABLE jobs DROP COLUMN id;"), migrationHash);
  assert.throws(() => verifySourceSql("ALTER TABLE jobs DROP COLUMN id;"));
  assert.ok(source.includes('git", ["show"'));
  assert.ok(source.includes("READ ONLY"));
});


test("preflight and verified retries cannot invoke deploy; drift fails before writes", () => {
  const neverDeploy = () => assert.fail("unexpected database mutation");
  performMigration("preflight", inventory, pending(), neverDeploy, neverDeploy);
  performMigration("apply", inventory, applied(), neverDeploy, neverDeploy);
  assert.throws(() => performMigration("apply", inventory, { ...pending(), forced: false }, neverDeploy, neverDeploy));
  assert.throws(() => performMigration("unknown", inventory, pending(), neverDeploy, neverDeploy));
});

test("apply deploys once and requires a verified postflight; failure is never retried automatically", () => {
  let calls = 0;
  assert.equal(performMigration("apply", inventory, pending(), () => calls++, applied).targetApplied, true);
  assert.equal(calls, 1);
  assert.throws(() => performMigration("apply", inventory, pending(), () => { throw Error("database interrupted"); }, applied), /interrupted/);
  assert.throws(() => performMigration("apply", inventory, pending(), () => {}, pending), /not applied/);
});
