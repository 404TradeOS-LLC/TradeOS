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

// All reads execute in one repeatable-read, read-only transaction. No row data,
// auth secrets or arbitrary client-supplied SQL are emitted to the build log.
export const evidenceSql = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
 'ledger', (SELECT coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum,
   'finished',finished_at IS NOT NULL,'rolled_back',rolled_back_at IS NOT NULL)), '[]'::json)
   FROM public._prisma_migrations),
 'handoff', json_build_object(
   'columns', (SELECT coalesce(json_agg(json_build_object('name',column_name,'type',data_type,
     'nullable',is_nullable='YES','default',column_default)), '[]'::json)
     FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs'
       AND column_name IN ('source_proposal_id','accepted_baseline_json')),
   'indexes', (SELECT coalesce(json_agg(json_build_object('unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,
     'keys',pg_get_indexdef(i.indexrelid,1,true),'predicate',pg_get_expr(i.indpred,i.indrelid),
     'expressions',pg_get_expr(i.indexprs,i.indrelid),'keyCount',i.indnkeyatts,'totalCount',i.indnatts,
     'nullsNotDistinct',i.indnullsnotdistinct)), '[]'::json)
     FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
     WHERE i.indrelid='public.jobs'::regclass AND c.relname='jobs_source_proposal_id_key'),
   'rls', (SELECT relrowsecurity FROM pg_class WHERE oid='public.jobs'::regclass),
   'forced', (SELECT relforcerowsecurity FROM pg_class WHERE oid='public.jobs'::regclass)),
 'receiptBucketPrivate', (SELECT count(*)=1 AND bool_and(NOT public) FROM storage.buckets WHERE id='project-files'),
 'expense', json_build_object(
   'table', to_regclass('public.job_expenses') IS NOT NULL,
   'eventsTable', to_regclass('public.job_expense_events') IS NOT NULL,
   'rls', (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.job_expenses')),
   'forced', (SELECT relforcerowsecurity FROM pg_class WHERE oid=to_regclass('public.job_expenses')),
   'eventRls', (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.job_expense_events')),
   'eventForced', (SELECT relforcerowsecurity FROM pg_class WHERE oid=to_regclass('public.job_expense_events')),
   'columns', (SELECT coalesce(json_agg(column_name), '[]'::json) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='job_expenses'),
   'indexes', (SELECT coalesce(json_agg(c.relname), '[]'::json)
     FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
     WHERE i.indrelid IN (to_regclass('public.job_expenses'),to_regclass('public.job_expense_events'))
       AND i.indisvalid AND i.indisready),
   'indexMetadata', (SELECT coalesce(json_agg(json_build_object('name',c.relname,'unique',i.indisunique,
      'valid',i.indisvalid,'ready',i.indisready)), '[]'::json)
     FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
     WHERE i.indrelid IN (to_regclass('public.job_expenses'),to_regclass('public.job_expense_events'))),
   'constraints', (SELECT coalesce(json_agg(conname), '[]'::json)
     FROM pg_constraint WHERE conrelid IN (to_regclass('public.job_expenses'),to_regclass('public.job_expense_events'))),
   'policies', (SELECT coalesce(json_agg(json_build_object('table',tablename,'name',policyname,'command',cmd)), '[]'::json)
     FROM pg_policies WHERE schemaname='public' AND tablename IN ('job_expenses','job_expense_events'))
  )
);
COMMIT;`;

function run(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024, ...options });
  // Subprocess output may carry credential-bearing URLs; never print it.
  if (result.error || result.status !== 0) throw Error(`Protected staging tool failed: ${path.basename(program)}`);
  return result.stdout;
}

export function main(env = process.env) {
  validateRequest({ sourceSha: env.SOURCE_SHA, approvedSha: env.APPROVED_SOURCE_SHA,
    mode: env.MIGRATION_MODE, confirmation: env.CONFIRMATION, ref: env.GITHUB_REF });
  const url = stagingConnection(env.STAGING_DATABASE_ADMIN_URL);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const trustedEnv = { PATH: env.PATH, HOME: env.HOME, CI: 'true', GIT_CONFIG_NOSYSTEM: '1' };
  const migrationRoot = path.join(root, 'app/prisma/migrations');
  const inventory = {};
  for (const entry of readdirSync(migrationRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) inventory[entry.name] = hash(readFileSync(path.join(migrationRoot, entry.name, 'migration.sql')));
  }
  if (inventory[handoffMigration.name] && inventory[handoffMigration.name] !== handoffMigration.hash) {
    throw Error('Trusted main already has incompatible Job handoff migration');
  }
  if (inventory[migrationNames[0]] !== reviewedMigrations[migrationNames[0]]) {
    throw Error('Trusted baseline migration is not the reviewed SQL');
  }
  inventory[handoffMigration.name] = handoffMigration.hash;
  // Do not accept a locally modified source path or execute source PR code.
  const sourced = {};
  const alreadyInMain = new Set(Object.keys(inventory));
  for (const name of migrationNames.slice(1)) {
    const sql = run('git', ['show', `${env.SOURCE_SHA}:app/prisma/migrations/${name}/migration.sql`],
      { cwd: root, env: trustedEnv });
    sourced[name] = verifySourceSql(name, sql);
    if (inventory[name] && inventory[name] !== reviewedMigrations[name]) {
      throw Error('Trusted main contains a changed Expense migration');
    }
    inventory[name] = reviewedMigrations[name];
  }
  const pgEnv = { ...trustedEnv,
    PGHOST: url.hostname, PGPORT: url.port, PGDATABASE: 'postgres',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15',
  };
  const capture = () => JSON.parse(run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
    { env: pgEnv, input: evidenceSql }));
  const capturedBefore = capture();
  const before = validateEvidence(inventory, capturedBefore);
  console.log(JSON.stringify({ mode: env.MIGRATION_MODE, projectRef, sourceSha: env.SOURCE_SHA,
    reviewedSqlHashes: reviewedMigrations, ...before }));
  const after = performMigration(env.MIGRATION_MODE, inventory, capturedBefore, () => {
    for (const [name, sql] of Object.entries(sourced)) {
      if (!alreadyInMain.has(name)) {
        const folder = path.join(migrationRoot, name);
        mkdirSync(folder, { recursive: true });
        writeFileSync(path.join(folder, 'migration.sql'), sql, { flag: 'wx' });
      }
    }
    run(path.join(root, 'app/node_modules/.bin/prisma'), ['migrate', 'deploy', '--schema', 'app/prisma/schema.prisma'],
      { cwd: root, env: { ...trustedEnv, DATABASE_URL: url.toString(), DATABASE_ADMIN_URL: url.toString() } });
  }, capture);
  console.log(JSON.stringify({ mode: env.MIGRATION_MODE, projectRef, sourceSha: env.SOURCE_SHA,
    reviewedSqlHashes: reviewedMigrations, ...after }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
