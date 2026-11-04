import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  reviewedMigrations, handoffMigration, projectRef,
  validateRequest, stagingConnection, verifySourceSql,
  validateEvidence, performMigration, evidenceSql,
} from './staging-expenses-migration.mjs';

const sourceSha = '86149a58d23a2248f483c650c9193d7b8f7ff22a';
const inventory = Object.fromEntries([
  ['20261030010000_force_team_time_rls', 'a'.repeat(64)],
  ...Object.entries(reviewedMigrations).map(([name, sha]) => [name, sha]),
  [handoffMigration.name, handoffMigration.hash],
]);
const names = Object.keys(reviewedMigrations);
const base = {
  ledger: [
    { name: '20261030010000_force_team_time_rls', checksum: 'a'.repeat(64), finished: true, rolled_back: false },
    { name: handoffMigration.name, checksum: handoffMigration.hash, finished: true, rolled_back: false },
  ],
  handoff: {
    columns: [
      { name: 'source_proposal_id', type: 'text', nullable: true, default: null },
      { name: 'accepted_baseline_json', type: 'jsonb', nullable: true, default: null },
    ],
    indexes: [{ unique: true, valid: true, ready: true, keys: 'source_proposal_id', predicate: null,
      expressions: null, keyCount: 1, totalCount: 1, nullsNotDistinct: false }],
    rls: true, forced: true,
  },
  receiptBucketPrivate: true,
  expense: { table: false, eventsTable: false, rls: false, forced: false, eventRls: false, eventForced: false,
    indexes: [], indexMetadata: [], constraints: [], policies: [], columns: [] },
};
const clone = (obj) => JSON.parse(JSON.stringify(obj));
const afterEvidence = () => {
  const x = clone(base);
  for (const [name, checksum] of Object.entries(reviewedMigrations)) {
    x.ledger.push({ name, checksum, finished: true, rolled_back: false });
  }
  Object.assign(x.expense, {
    table: true, eventsTable: true, rls: true, forced: true, eventRls: true, eventForced: true,
    columns: ['payment_responsibility', 'currency', 'description', 'receipt_storage_path',
      'idempotency_key', 'voided_at', 'voided_by_id', 'void_reason'],
    indexes: ['job_expenses_org_job_idx', 'job_expenses_job_incurred_idx',
      'job_expenses_org_job_idempotency_key_idx', 'job_expenses_org_job_voided_idx',
      'job_expense_events_org_job_expense_created_idx'],
    indexMetadata: [{ name: 'job_expenses_org_job_idempotency_key_idx', unique: true, valid: true, ready: true }],
    constraints: ['job_expenses_amount_cents_check', 'job_expenses_payment_responsibility_check',
      'job_expenses_currency_check', 'job_expenses_receipt_metadata_check', 'job_expenses_void_consistency_check',
      'job_expense_events_expense_id_fkey', 'job_expense_events_actor_user_id_fkey',
      'job_expense_events_org_id_fkey', 'job_expense_events_job_id_fkey',
      'job_expenses_voided_by_id_fkey'],
    policies: [
      { table: 'job_expenses', name: 'job_expenses_select_policy', command: 'SELECT' },
      { table: 'job_expenses', name: 'job_expenses_insert_policy', command: 'INSERT' },
      { table: 'job_expenses', name: 'job_expenses_update_policy', command: 'UPDATE' },
      { table: 'job_expenses', name: 'job_expenses_delete_policy', command: 'DELETE' },
      { table: 'job_expense_events', name: 'job_expense_events_select_policy', command: 'SELECT' },
      { table: 'job_expense_events', name: 'job_expense_events_insert_policy', command: 'INSERT' },
    ],
  });
  return x;
};

test('requires an exact reviewed source and protected staging approval before applying', () => {
  assert.doesNotThrow(() => validateRequest({ sourceSha, mode: 'preflight', ref: 'refs/heads/main' }));
  assert.throws(() => validateRequest({ sourceSha, mode: 'apply', ref: 'refs/heads/main', approvedSha: null, confirmation: 'APPLY_STAGING_EXPENSES' }), /protected/);
  assert.throws(() => validateRequest({ sourceSha, mode: 'apply', ref: 'refs/heads/main', approvedSha: sourceSha, confirmation: 'bad' }), /protected/);
  assert.throws(() => validateRequest({ sourceSha, mode: 'preflight', ref: 'refs/heads/staging' }), /main/);
  assert.throws(() => validateRequest({ sourceSha: 'bad', mode: 'preflight', ref: 'refs/heads/main' }), /SHA/);
  assert.doesNotThrow(() => validateRequest({ sourceSha, mode: 'apply', ref: 'refs/heads/main', approvedSha: sourceSha, confirmation: 'APPLY_STAGING_EXPENSES' }));
});

test('only accepts the pinned staging Supabase identity with no routing override', () => {
  const good = `postgresql://postgres:secret@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
  const result = stagingConnection(good);
  assert.equal(result.hostname, `db.${projectRef}.supabase.co`);
  assert.equal(result.port, '5432');
  assert.throws(() => stagingConnection(good.replace(projectRef, 'production-project-id')), /identity/i);
  assert.throws(() => stagingConnection(good + '&options=-c%20search_path%3Dother'), /parameter/i);
  assert.throws(() => stagingConnection(good.replace(':5432/', ':6543/')), /identity/i);
  assert.throws(() => stagingConnection(good.replace('postgresql:', 'https:')), /identity/i);
});

test('rejects changed SQL instead of relying on source SHA alone', () => {
  const name = Object.keys(reviewedMigrations)[0];
  assert.throws(() => verifySourceSql(name, 'SELECT 1;'), /checksum/i);
  assert.throws(() => verifySourceSql('unexpected_migration', 'SELECT 1;'), /migration/i);
});

test('preflight accepts exactly 66 trusted + applied Job handoff and three outstanding expense SQL files', () => {
  const x = validateEvidence(inventory, clone(base));
  assert.deepEqual(x.missing, names);
  assert.equal(x.applied, 2);
  assert.equal(x.state, 'pending');
});

test('rejects unexpected or altered migration, unfinished and duplicate ledger rows', () => {
  for (const mutation of [
    x => x.ledger.push({ name: 'unknown', checksum: '1'.repeat(64), finished: true, rolled_back: false }),
    x => { x.ledger[1].checksum = 'x'.repeat(64); },
    x => x.ledger.push({ name: names[0], checksum: reviewedMigrations[names[0]], finished: false, rolled_back: false }),
    x => x.ledger.push({ ...x.ledger[0] }),
    x => { x.ledger = x.ledger.filter(v => v.name !== handoffMigration.name); },
  ]) {
    const x = clone(base);
    mutation(x);
    assert.throws(() => validateEvidence(inventory, x));
  }
});

test('fails closed on partial expense schema, unrelated pending migration, or unsafe job RLS', () => {
  for (const mutation of [
    x => { x.expense.table = true; },
    x => { x.receiptBucketPrivate = false; },
    x => { x.handoff.forced = false; },
    x => { x.handoff.columns[0].type = 'uuid'; },
  ]) {
    const x = clone(base); mutation(x); assert.throws(() => validateEvidence(inventory, x));
  }
  assert.throws(() => validateEvidence({ ...inventory, unrelated: 'b'.repeat(64) }, clone(base)), /unrelated/i);
});

test('postflight checks all migration names, forced RLS, policies, constraints and indexes', () => {
  const full = afterEvidence();
  const result = validateEvidence(inventory, full, { requireApplied: true });
  assert.equal(result.state, 'applied');
  for (const mutation of [
    x => { x.expense.rls = false; },
    x => { x.expense.eventForced = false; },
    x => { x.expense.policies.push({ table: 'job_expense_events', name: 'overbroad_update', command: 'UPDATE' }); },
    x => { x.expense.indexes.splice(2, 1); },
    x => { x.expense.indexMetadata[0].unique = false; },
    x => { x.expense.constraints.splice(2, 1); },
    x => { x.expense.columns.splice(2, 1); },
  ]) { const x = clone(full); mutation(x); assert.throws(() => validateEvidence(inventory, x)); }
});

test('preflight is always read only and apply executes reviewed migrations once', () => {
  let deployed = 0;
  let capture = 0;
  const read = () => {capture++;return afterEvidence()};
  assert.equal(performMigration('preflight', inventory, clone(base), () => deployed++, read).state, 'pending');
  assert.equal(deployed, 0);
  assert.equal(capture, 0);
  assert.equal(performMigration('apply', inventory, clone(base), () => deployed++, read).state, 'applied');
  assert.equal(deployed, 1);
  assert.equal(capture, 1);
  assert.equal(performMigration('apply', inventory, afterEvidence(), () => deployed++, read).state, 'applied');
  assert.equal(deployed, 1);
});


test('evidence capture explicitly uses a read-only transaction and no DDL', () => {
  assert.match(evidenceSql, /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.match(evidenceSql, /\nCOMMIT;$/);
  assert.match(evidenceSql, /pg_policies/);
  assert.match(evidenceSql, /indexMetadata/);
  assert.doesNotMatch(evidenceSql, /\b(?:ALTER|CREATE|DROP|UPDATE|DELETE|INSERT)\s+(?:TABLE|INDEX|POLICY|INTO|SET|FROM)\b/i);
});

test('protected workflow cannot run on push or in production', () => {
  const text = readFileSync(new URL('../.github/workflows/staging-expenses-migration.yml', import.meta.url), 'utf8');
  assert.match(text, /workflow_dispatch:/);
  assert.doesNotMatch(text, /\n\s+push:/);
  assert.match(text, /environment: staging/);
  assert.match(text, /group: deploy-migrations-staging/);
  assert.match(text, /APPROVED_SOURCE_SHA: \$\{\{ vars\.STAGING_EXPENSES_APPROVED_SHA \}\}/);
  assert.match(text, /STAGING_DATABASE_ADMIN_URL: \$\{\{ secrets\.STAGING_DATABASE_ADMIN_URL \}\}/);
  assert.match(text, /permissions:\n  contents: read/);
});
