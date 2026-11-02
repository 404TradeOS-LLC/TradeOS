import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateLedger, baselineMigration, reviewedStagingJobHandoff, reviewedStagingPayer } from "./verify-staging-prisma-ledger.mjs";

const main = { prior_migration: "a".repeat(64), [baselineMigration]: "b".repeat(64) };
const applied = (name, checksum) => ({ name, checksum, finished: true, rolled_back: false });
const historicalJob = applied(reviewedStagingJobHandoff.name, reviewedStagingJobHandoff.checksum);
const prior = applied("prior_migration", main.prior_migration);
const baseline = applied(baselineMigration, main[baselineMigration]);
const absent = { exists: false, rls: false, forced: false, policies: [], payerColumn: false };
const present = { exists: true, rls: true, forced: true, payerColumn: false,
  policies: ["job_expenses_select_policy","job_expenses_insert_policy","job_expenses_update_policy","job_expenses_delete_policy"] };

test("preflight allows only reviewed staging-only Job handoff and pending expense baseline", () => {
  const result = evaluateLedger(main, [prior, historicalJob], absent, "preflight");
  assert.deepEqual(result.pending, [baselineMigration]);
  assert.equal(result.applied, 2);
});
test("postflight verifies the ledger and forced expense RLS", () => {
  assert.deepEqual(evaluateLedger(main, [prior, historicalJob, baseline], present, "postflight").pending, []);
});
test("postflight requires the baseline to have applied", () =>
  assert.throws(() => evaluateLedger(main,[prior,historicalJob],absent,"postflight"),/pending/i));
test("unrelated pending migrations are refused", () =>
  assert.throws(() => evaluateLedger({...main, new_unreviewed:"c".repeat(64)},[prior,historicalJob],absent,"preflight"),/unrelated pending/i));
test("unrecognized staging-only migration is refused", () =>
  assert.throws(() => evaluateLedger(main,[prior,applied("extra","d".repeat(64))],absent,"preflight"),/unrecognized|untracked/i));
test("modified Job handoff checksum is refused", () =>
  assert.throws(() => evaluateLedger(main,[prior,applied(reviewedStagingJobHandoff.name,"e".repeat(64))],absent,"preflight"),/checksum/i));
test("modified tracked migration checksum is refused", () =>
  assert.throws(() => evaluateLedger(main,[applied("prior_migration","e".repeat(64)),historicalJob],absent,"preflight"),/checksum/i));
test("unfinished migration blocks deployment", () =>
  assert.throws(() => evaluateLedger(main,[{...prior,finished:false},historicalJob],absent,"preflight"),/unfinished/i));
test("duplicate successful migrations are rejected", () =>
  assert.throws(() => evaluateLedger(main,[prior,prior,historicalJob],absent,"preflight"),/duplicate/i));
test("historically rolled-back rows do not count as applied", () => {
  const result=evaluateLedger(main,[prior,historicalJob,{...prior,rolled_back:true,finished:false}],absent,"preflight");
  assert.equal(result.applied,2);
});
test("partial expense schema without tracked migration is rejected", () =>
  assert.throws(() => evaluateLedger(main,[prior,historicalJob],present,"preflight"),/schema|table/i));
test("ledger without physical expense table is rejected", () =>
  assert.throws(() => evaluateLedger(main,[prior,historicalJob,baseline],absent,"postflight"),/schema|table/i));
test("RLS must be forced", () =>
  assert.throws(() => evaluateLedger(main,[prior,historicalJob,baseline],{...present,forced:false},"postflight"),/RLS/i));
test("all four expense policies must exist", () =>
  assert.throws(() => evaluateLedger(main,[prior,historicalJob,baseline],{...present,policies:present.policies.slice(0,3)},"postflight"),/policy/i));
test("untracked payer column is rejected", () =>
  assert.throws(() => evaluateLedger(main,[prior,historicalJob,baseline],{...present,payerColumn:true},"postflight"),/untracked payer/i));
test("unknown phase rejected", () => assert.throws(() => evaluateLedger(main,[prior,historicalJob],absent,"whatever"),/phase/i));

test("separately reviewed staged payer migration requires matching checksum and CHECK", () => {
  const payer = applied(reviewedStagingPayer.name, reviewedStagingPayer.checksum);
  const result = evaluateLedger(main, [prior, historicalJob, baseline, payer],
    {...present, payerColumn:true, payerConstraint:"not_validated"}, "postflight");
  assert.equal(result.expensePayerApplied, true);
});
test("staged payer with missing CHECK is refused", () => {
  const payer = applied(reviewedStagingPayer.name, reviewedStagingPayer.checksum);
  assert.throws(() => evaluateLedger(main, [prior, historicalJob, baseline, payer],
    {...present, payerColumn:true, payerConstraint:"absent"}, "postflight"), /payer.*constraint/i);
});
test("pending payer tracked on main is not deployed by baseline-only procedure", () => {
  const inventory = {...main, [reviewedStagingPayer.name]:reviewedStagingPayer.checksum};
  assert.throws(() => evaluateLedger(inventory,[prior,historicalJob,baseline],
    present,"preflight"),/unrelated pending/i);
});
