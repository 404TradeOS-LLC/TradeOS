import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyProductionMigrationTarget } from '../verify-production-migration-target.mjs';

const REF = 'kssaceuetdjwfqnbzhly';
const direct = `postgresql://postgres:secret@db.${REF}.supabase.co:5432/postgres?schema=public`;
const session = `postgresql://postgres.${REF}:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres?schema=public`;
const env = (url, branch='refs/heads/main') => ({ GITHUB_REF: branch, DATABASE_ADMIN_URL: url });

test('accepts exact production direct host or project-bound west-2 session pooler', () => {
  assert.deepEqual(verifyProductionMigrationTarget(env(direct)), { projectRef: REF, connectionMode: 'direct' });
  assert.deepEqual(verifyProductionMigrationTarget(env(session)), { projectRef: REF, connectionMode: 'session-pooler' });
});
test('rejects wrong branch even when the database host is valid', () => {
  assert.throws(() => verifyProductionMigrationTarget(env(session, 'refs/heads/staging')), /main/);
  assert.throws(() => verifyProductionMigrationTarget(env(session, 'refs/pull/977/merge')), /main/);
});
test('rejects staging direct host and cross-project pooler username', () => {
  assert.throws(() => verifyProductionMigrationTarget(env(direct.replace(REF, 'qfbgdkbamfaasmtjfyru'))), /identity/);
  assert.throws(() => verifyProductionMigrationTarget(env(session.replace(`postgres.${REF}`, 'postgres.qfbgdkbamfaasmtjfyru'))), /identity/);
});
test('rejects wrong AWS region and malicious pooler lookalike', () => {
  assert.throws(() => verifyProductionMigrationTarget(env(session.replace('us-west-2','us-east-2'))), /identity/);
  assert.throws(() => verifyProductionMigrationTarget(env(session.replace('pooler.supabase.com','pooler.supabase.com.evil.example'))), /identity/);
});
test('rejects transaction pooler, non-Postgres path, non-Postgres scheme, no password', () => {
  for (const url of [session.replace(':5432/', ':6543/'), direct.replace('/postgres?', '/wrong?'), direct.replace('postgresql:', 'https:'), direct.replace('postgres:secret@', 'postgres@')]) {
    assert.throws(() => verifyProductionMigrationTarget(env(url)), /identity|connection|credentials/);
  }
});
test('fails closed with missing, malformed or untrusted project identity', () => {
  for (const url of ['', 'not-url', 'postgresql://postgres:password@127.0.0.1:5432/postgres']) {
    assert.throws(() => verifyProductionMigrationTarget(env(url)), /identity|connection|credentials/);
  }
});

test('workflow runs identity guard before privileged migration apply and only scopes admin secret to preflight', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const workflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/deploy-migrations.yml'), 'utf8');
  const preflight = workflow.indexOf('node scripts/verify-production-migration-target.mjs');
  const migrate = workflow.indexOf('bash scripts/deploy-migrations.sh');
  assert.ok(preflight > -1 && migrate > preflight, 'target guard must precede migration SQL');
  assert.match(workflow, /name: Verify production migration target[\s\S]*?DATABASE_ADMIN_URL: \$\{\{ secrets\.DATABASE_ADMIN_URL \}\}[\s\S]*?node scripts\/verify-production-migration-target\.mjs/);
});


test('rejects decoded host overrides without leaking query credentials', () => {
  for (const authority of [direct, session]) {
    for (const key of ['host', '%68ost', 'h%6fst', '%68%6f%73%74']) {
      const url = `${authority}&${key}=db.qfbgdkbamfaasmtjfyru.supabase.co`;
      assert.throws(() => verifyProductionMigrationTarget(env(url)), /identity/);
    }
  }
});
