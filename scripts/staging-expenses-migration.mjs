import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// These exact SQL bytes were reviewed on PR #891 at source commit 86149a58...
// Source PR scripts and dependencies are never executed under staging secrets.
export const reviewedMigrations = Object.freeze({
  '20261102020000_add_job_expenses': 'c6599040d635a5aa69ae8b5b01a2f29014617a751b822ea015395ea9231743a1',
  '20261102074000_add_job_expense_payment_responsibility': 'e8e2d8cd36b9d09d662cdc71f9441ec970b1ea6bd0e755e88474a47f9674a1a3',
  '20261102081500_complete_job_expenses': '13b40ce24b6ade9a7b1af2deccc10688350096668419e4d3aeedda3e38e8a510',
});
export const handoffMigration = Object.freeze({
  name: '20261028151000_accepted_proposal_job_handoff',
  hash: '3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293',
});
export const projectRef = 'qfbgdkbamfaasmtjfyru';
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const migrationNames = Object.keys(reviewedMigrations);

export function verifySourceSql(name, sql) {
  if (!Object.hasOwn(reviewedMigrations, name)) throw Error('Unexpected source migration');
  if (hash(sql) !== reviewedMigrations[name]) throw Error(`Source migration checksum mismatch: ${name}`);
  return sql;
}

export function validateRequest({ sourceSha, approvedSha, mode, confirmation, ref }) {
  if (ref !== 'refs/heads/main') throw Error('Protected runner must run from main');
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '')) throw Error('Full source SHA required');
  if (!['preflight', 'apply'].includes(mode)) throw Error('Unknown mode');
  if (mode === 'apply' && (approvedSha !== sourceSha || confirmation !== 'APPLY_STAGING_EXPENSES')) {
    throw Error('Apply requires exact protected approved source SHA and confirmation');
  }
}

export function stagingConnection(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Invalid staging identity'); }
  let user;
  try { user = decodeURIComponent(url.username); } catch { throw Error('Invalid staging identity'); }
  const direct = url.hostname === `db.${projectRef}.supabase.co` && (url.port === '' || url.port === '5432');
  const pooler = url.hostname === 'aws-0-us-east-2.pooler.supabase.com' &&
    ['5432', '6543'].includes(url.port) &&
    /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-z0-9]{20}$/.test(user) && user.endsWith(`.${projectRef}`);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/postgres' ||
      url.hash || !url.password || !user || !(direct || pooler)) throw Error('Staging identity refused');
  for (const [key, val] of url.searchParams) {
    if (!((key === 'schema' && val === 'public') || (key === 'sslmode' && val === 'require')) ||
        url.searchParams.getAll(key).length !== 1) throw Error('Unapproved connection parameter');
  }
  url.port = '5432'; // Prisma migration requires session-mode connection.
  url.searchParams.set('sslmode', 'require');
  return url;
}

function requireSet(values, expected, description) {
  for (const value of expected) if (!values.includes(value)) throw Error(`Missing ${description}: ${value}`);
}

function verifyHandoff(e) {
  if (!e || !Array.isArray(e.columns) || !Array.isArray(e.indexes) || e.rls !== true || e.forced !== true) {
    throw Error('Applied Job handoff RLS/schema not verified');
  }
  if (e.columns.length !== 2 || !e.columns.some(c => c.name === 'source_proposal_id' && c.type === 'text' && c.nullable === true && c.default === null) ||
      !e.columns.some(c => c.name === 'accepted_baseline_json' && c.type === 'jsonb' && c.nullable === true && c.default === null)) {
    throw Error('Applied Job handoff columns differ from expected');
  }
  const [idx] = e.indexes;
  if (e.indexes.length !== 1 || idx.unique !== true || idx.valid !== true || idx.ready !== true ||
      idx.keys !== 'source_proposal_id' || idx.predicate !== null || idx.expressions !== null ||
      idx.keyCount !== 1 || idx.totalCount !== 1 || idx.nullsNotDistinct !== false) {
    throw Error('Applied Job handoff unique index mismatch');
  }
}

function verifyCompleteExpenseSchema(x) {
  if (!x || !x.table || !x.eventsTable || !x.rls || !x.forced || !x.eventRls || !x.eventForced) {
    throw Error('Expense tables must both have enabled and forced RLS');
  }
  if (![x.columns, x.indexes, x.indexMetadata, x.constraints, x.policies].every(Array.isArray)) {
    throw Error('Incomplete expense schema evidence');
  }
  requireSet(x.columns, ['payment_responsibility', 'currency', 'description', 'receipt_storage_path',
    'idempotency_key', 'voided_at', 'voided_by_id', 'void_reason'], 'expense column');
  requireSet(x.indexes, ['job_expenses_org_job_idx', 'job_expenses_job_incurred_idx',
    'job_expenses_org_job_idempotency_key_idx', 'job_expenses_org_job_voided_idx',
    'job_expense_events_org_job_expense_created_idx'], 'expense index');
  const idempotencyIndex = x.indexMetadata.find(index => index.name === 'job_expenses_org_job_idempotency_key_idx');
  if (!idempotencyIndex || !idempotencyIndex.unique || !idempotencyIndex.ready || !idempotencyIndex.valid) {
    throw Error('Atomic idempotency requires a valid unique index');
  }
  requireSet(x.constraints, ['job_expenses_amount_cents_check', 'job_expenses_payment_responsibility_check',
    'job_expenses_currency_check', 'job_expenses_receipt_metadata_check', 'job_expenses_void_consistency_check',
    'job_expense_events_expense_id_fkey', 'job_expense_events_actor_user_id_fkey',
    'job_expense_events_org_id_fkey', 'job_expense_events_job_id_fkey',
    'job_expenses_voided_by_id_fkey'], 'expense constraint');
  const policyKey = p => `${p.table}:${p.command}:${p.name}`;
  requireSet(x.policies.map(policyKey), [
    'job_expenses:SELECT:job_expenses_select_policy',
    'job_expenses:INSERT:job_expenses_insert_policy',
    'job_expenses:UPDATE:job_expenses_update_policy',
    'job_expenses:DELETE:job_expenses_delete_policy',
    'job_expense_events:SELECT:job_expense_events_select_policy',
    'job_expense_events:INSERT:job_expense_events_insert_policy',
  ], 'expense RLS policy');
  if (x.policies.some(p => p.table === 'job_expense_events' && ['DELETE', 'UPDATE', 'ALL'].includes(p.command))) {
    throw Error('Expense events must remain append-only');
  }
}

/** Fail closed on any drift, partial state, unrelated pending migration or unreviewed SQL. */
export function validateEvidence(inventory, evidence, { requireApplied = false } = {}) {
  if (!evidence || !Array.isArray(evidence.ledger)) throw Error('Missing staging ledger');
  if (evidence.receiptBucketPrivate !== true) throw Error('Receipt bucket must exist and be private');
  verifyHandoff(evidence.handoff);
  const applied = new Map();
  for (const row of evidence.ledger) {
    if (row.rolled_back) continue;
    if (!row.finished) throw Error('Unfinished Prisma migration');
    if (applied.has(row.name)) throw Error('Duplicate successful migration');
    if (!Object.hasOwn(inventory, row.name) || inventory[row.name] !== row.checksum) {
      throw Error('Unexpected migration or checksum drift');
    }
    applied.set(row.name, row.checksum);
  }
  if (!applied.has(handoffMigration.name)) throw Error('Previously approved Job handoff must be applied');
  const missing = Object.keys(inventory).filter(name => !applied.has(name));
  if (missing.some(name => !Object.hasOwn(reviewedMigrations, name))) throw Error('Unrelated pending migration');
  const allMissing = missing.length === migrationNames.length && migrationNames.every(n => missing.includes(n));
  const allApplied = missing.length === 0;
  if (!allMissing && !allApplied) throw Error('Partial expense migration ledger needs manual reconciliation');
  if (requireApplied && !allApplied) throw Error('Expected complete Expense migration ledger');
  if (allMissing) {
    if (!evidence.expense || evidence.expense.table || evidence.expense.eventsTable ||
        evidence.expense.columns?.length || evidence.expense.indexes?.length ||
        evidence.expense.constraints?.length || evidence.expense.policies?.length) {
      throw Error('Partial or untracked Expense schema');
    }
  } else verifyCompleteExpenseSchema(evidence.expense);
  return { state: allApplied ? 'applied' : 'pending', applied: applied.size, missing };
}

export function performMigration(mode, inventory, evidence, deploy, captureAfter) {
  if (!['preflight', 'apply'].includes(mode)) throw Error('Unknown mode');
  const before = validateEvidence(inventory, evidence);
  if (mode === 'preflight' || before.state === 'applied') return before;
  deploy();
  return validateEvidence(inventory, captureAfter(), { requireApplied: true });
}

