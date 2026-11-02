import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { expenseName, expenseHash, handoffName, handoffHash, validateRequest, validateProof, validateSourceInventory, performMigration, verifySourceSql } from "../staging-job-expenses-migration.mjs";

const sourceSha = "a".repeat(40);
const baseName = "20260623143000_init_schema";
const hashes = { [baseName]: "b".repeat(64), [handoffName]: handoffHash, [expenseName]: expenseHash };
const ledger = (name) => ({ name, checksum: hashes[name], finished: true, rolled_back: false });
const handoffIndex = { unique: true, valid: true, ready: true, keys: "source_proposal_id",
  predicate: null, expressions: null, keyCount: 1, totalCount: 1, nullsNotDistinct: false };
const before = () => ({
  ledger: [ledger(baseName), ledger(handoffName)],
  columns: [{ name: "source_proposal_id", type: "text", nullable: true, default: null },
    { name: "accepted_baseline_json", type: "jsonb", nullable: true, default: null }],
  indexes: [handoffIndex], rls: true, forced: true, helpers: 4, roleExists: true,
  expenses: { exists: false, columns: [], indexes: [], policies: [], rls: null, forced: null, grants: 0, appRoleGrants: [] },
});
const after = () => ({
  ...before(), ledger: [...before().ledger, ledger(expenseName)],
  expenses: { exists: true, rls: true, forced: true, grants: 0,
    columns: ["id","org_id","job_id","amount_cents","category","vendor","receipt_note",
      "incurred_on","created_by_id","created_at","updated_at"],
    indexes: ["job_expenses_pkey","job_expenses_org_job_idx","job_expenses_job_incurred_idx"],
    policies: ["job_expenses_select_policy","job_expenses_insert_policy","job_expenses_update_policy","job_expenses_delete_policy"],
    constraints: ["job_expenses_pkey","job_expenses_amount_cents_check","job_expenses_category_check","job_expenses_vendor_check","job_expenses_receipt_note_check"],
    appRoleGrants: ["SELECT","INSERT","UPDATE","DELETE"] },
});
const request = { ref: "refs/heads/main", sourceSha, mode: "apply",
  approvedSha: sourceSha, confirmation: "APPLY_STAGING_JOB_EXPENSES" };

test("trusted main and exact approved source SHA required for apply", () => {
  validateRequest(request);
  validateRequest({ ...request, mode: "preflight", approvedSha: "", confirmation: "" });
  for (const patch of [{ ref: "refs/heads/staging" }, { sourceSha: "main" }, { mode: "force" },
    { approvedSha: "b".repeat(40) }, { confirmation: "YES" }]) {
    assert.throws(() => validateRequest({ ...request, ...patch }));
  }
});

test("reviewed migration identities and source hashes are pinned", () => {
  assert.equal(expenseHash, "c6599040d635a5aa69ae8b5b01a2f29014617a751b822ea015395ea9231743a1");
  assert.equal(handoffHash, "3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293");
  assert.throws(() => verifySourceSql("ALTER TABLE public.jobs DROP COLUMN id;", "DROP TABLE public.job_expenses;"));
});


test("refuses unapproved staging migration inventory changes before touching DB", () => {
  const source = { ...hashes };
  assert.deepEqual(validateSourceInventory(hashes, source), { count: 3 });
  assert.throws(() => validateSourceInventory(hashes, { ...source, "20990101000000_unreviewed": "a".repeat(64) }), /inventory/i);
  assert.throws(() => validateSourceInventory(hashes, { ...source, [baseName]: "d".repeat(64) }), /inventory/i);
  const missing = { ...source }; delete missing[handoffName];
  assert.throws(() => validateSourceInventory(hashes, missing), /inventory/i);
});

test("only missing expense is accepted, and prior handoff must remain fully verified", () => {
  assert.deepEqual(validateProof(hashes, before()), { targetApplied: false, completed: 2, missing: [expenseName] });
  assert.deepEqual(validateProof(hashes, after(), { requireApplied: true }),
    { targetApplied: true, completed: 3, missing: [] });
  const noHandoff = before(); noHandoff.ledger.pop();
  assert.throws(() => validateProof(hashes, noHandoff), /handoff|migration/i);
});

test("fail closed on unfinished, wrong checksum, duplicate, unexpected and partial schema", () => {
  for (const row of [
    { ...ledger(baseName), finished: false }, { ...ledger(baseName), checksum: "c".repeat(64) },
    { ...ledger(baseName), name: "unknown" }
  ]) assert.throws(() => validateProof(hashes, { ...before(), ledger: [row, ledger(handoffName)] }));
  assert.throws(() => validateProof(hashes, { ...before(), ledger: [ledger(baseName), ledger(baseName), ledger(handoffName)] }));
  assert.throws(() => validateProof(hashes, { ...before(), expenses: { ...before().expenses, exists: true } }));
});

test("postflight requires FORCE RLS, four policies, indexes, no public grants and app role grants", () => {
  for (const patch of [{ forced: false }, { rls: false }, { grants: 1 },
    { indexes: ["job_expenses_pkey"] }, { policies: [] }, { appRoleGrants: ["SELECT"] }]) {
    const result = after(); result.expenses = { ...result.expenses, ...patch };
    assert.throws(() => validateProof(hashes, result, { requireApplied: true }));
  }
  const result = after(); result.helpers = 3;
  assert.throws(() => validateProof(hashes, result));
  const missingRole = after(); missingRole.roleExists = false;
  assert.throws(() => validateProof(hashes, missingRole));
});

test("preflight never writes; already-applied apply is a no-op; apply verifies postflight", () => {
  const noWrite = () => assert.fail("unexpected database write");
  performMigration("preflight", hashes, before(), noWrite, noWrite);
  performMigration("apply", hashes, after(), noWrite, noWrite);
  let calls = 0;
  const result = performMigration("apply", hashes, before(), () => { calls++; }, after);
  assert.equal(calls, 1);
  assert.equal(result.targetApplied, true);
  assert.throws(() => performMigration("apply", hashes, before(), () => {}, before));
});

test("protected workflow executes trusted main only, serializes migrations and scopes secrets to final step", () => {
  const src = fs.readFileSync(new URL("../../.github/workflows/staging-job-expenses-migration.yml", import.meta.url), "utf8");
  assert.match(src, /workflow_dispatch:/);
  assert.match(src, /environment: staging/);
  assert.match(src, /group: deploy-migrations-staging/);
  assert.match(src, /refs\/heads\/main/);
  assert.match(src, /persist-credentials: false/);
  assert.match(src, /STAGING_JOB_EXPENSES_APPROVED_SHA/);
  assert.match(src, /APPLY_STAGING_JOB_EXPENSES/);
  assert.match(src, /node scripts\/staging-job-expenses-migration\.mjs/);
  assert.ok(!src.includes("--prod"));
  assert.ok(!src.includes("environment: production"));
  assert.equal((src.match(/secrets\.STAGING_DATABASE_ADMIN_URL/g) || []).length, 1);
  assert.ok(!src.includes("APP_DB_ROLE_PASSWORD"));
  const runner = fs.readFileSync(new URL("../staging-job-expenses-migration.mjs", import.meta.url), "utf8");
  assert.ok(runner.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_expenses"));
  assert.ok(!runner.includes("provision-app-role.sh"));
  assert.ok(!runner.includes("APP_DB_ROLE_PASSWORD"));
});
