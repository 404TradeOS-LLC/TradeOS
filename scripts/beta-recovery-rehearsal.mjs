#!/usr/bin/env node
// Synthetic local recovery only. No connection string or remote endpoint is accepted.
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseArgs(args) {
  const options = { image: 'rustfs/rustfs:1.0.5', output: resolve('artifacts/beta-recovery', new Date().toISOString().replaceAll(':', '-')) };
  for (const arg of args) {
    if (arg === '--help') return { help: true };
    if (arg.startsWith('--rustfs-binary=')) options.binary = resolve(arg.slice(16));
    else if (arg.startsWith('--output=')) options.output = resolve(arg.slice(9));
    else throw new Error('Only --output=<directory> and --rustfs-binary=<local-path> are supported; remote targets are never accepted.');
  }
  return options;
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const dockerEnv = { ...process.env };
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key];
function docker(args, input) {
  const result = spawnSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env: dockerEnv, input, maxBuffer: 16 * 1024 * 1024, timeout: 120_000 });
  if (result.error || result.status !== 0) throw new Error(`Local Docker operation failed (${args[0]}); inspect the local runtime.`);
  return result.stdout;
}
async function waitFor(probe) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if (await probe()) return; } catch { /* service startup only */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error('Disposable service did not become ready within 30 seconds.');
}
function s3Client(endpoint, accessKey, secretKey) {
  return async (method, path, bytes = Buffer.alloc(0)) => {
    const url = new URL(path, endpoint);
    assert.equal(url.hostname, '127.0.0.1');
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const day = date.slice(0, 8);
    const hash = sha256(bytes);
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${hash}\nx-amz-date:${date}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const request = [method, url.pathname, '', canonicalHeaders, signedHeaders, hash].join('\n');
    const scope = `${day}/us-east-1/s3/aws4_request`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), 'us-east-1'), 's3'), 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha256(request)}`).digest('hex');
    const response = await fetch(url, { method, headers: { 'x-amz-date': date, 'x-amz-content-sha256': hash, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` }, body: ['PUT', 'POST'].includes(method) ? bytes : undefined, signal: AbortSignal.timeout(10_000) });
    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
  };
}
export function verifyRestoredEvidence({ expectedHash, restoredHash, expectedRows, restoredRows, missingSource, privateStatus, rlsEnabled, rlsForced, foreignKeyCount }) {
  assert.equal(restoredHash, expectedHash, 'restored object bytes differ from backup');
  assert.deepEqual(restoredRows, expectedRows, 'restored database rows differ from snapshot');
  assert.equal(missingSource, true, 'source was not removed before recovery');
  assert.equal(privateStatus, 403, 'restored private object permits anonymous access');
  assert.equal(rlsEnabled, true, 'restored table lost RLS');
  assert.equal(rlsForced, true, 'restored table lost FORCE RLS');
  assert.equal(foreignKeyCount, 1, 'restored relationship constraint is missing');
}
export async function run(options) {
  const started = new Date();
  const id = randomUUID();
  const created = [];
  const report = { schemaVersion: 1, runId: id, startedAt: started.toISOString(), status: 'FAIL', scope: 'synthetic local PostgreSQL and S3-compatible private object recovery; no Supabase production/PITR certification', sourceSha: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), runnerSha256: sha256(readFileSync(fileURLToPath(import.meta.url))), sourceDirty: Boolean(spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()), checks: [] };
  mkdirSync(options.output, { recursive: true, mode: 0o700 });
  let phase = 'service startup';
  let localObjects;
  let localData;
  try {
    const password = randomBytes(24).toString('hex');
    const accessKey = `test${randomBytes(8).toString('hex')}`;
    const secretKey = randomBytes(32).toString('hex');
    const pg = docker(['run', '-d', '--name', `tradeos-recovery-pg-${id}`, '--label', `tradeos.recovery=${id}`, '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine']).toString().trim(); created.push(pg);
    let endpoint;
    if (options.binary) {
      const port = await new Promise((done, reject) => {
        const server = createServer(); server.on('error', reject);
        server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => done(port)); });
      });
      localData = mkdtempSync(resolve(tmpdir(), 'tradeos-recovery-'));
      localObjects = spawn(options.binary, ['server', '--address', `127.0.0.1:${port}`, localData], { env: { PATH: process.env.PATH, HOME: localData, RUSTFS_ACCESS_KEY: accessKey, RUSTFS_SECRET_KEY: secretKey, RUSTFS_CONSOLE_ENABLE: 'false', RUSTFS_OBS_LOG_DIRECTORY: localData }, stdio: 'ignore' });
      localObjects.on('error', () => {});
      endpoint = `http://127.0.0.1:${port}`;
      report.objectRuntime = { adapter: 'RustFS local binary', binarySha256: sha256(readFileSync(options.binary)) };
    } else {
      const objects = docker(['run', '-d', '--name', `tradeos-recovery-objects-${id}`, '--label', `tradeos.recovery=${id}`, '-e', `RUSTFS_ACCESS_KEY=${accessKey}`, '-e', `RUSTFS_SECRET_KEY=${secretKey}`, '-p', '127.0.0.1::9000', options.image, '/data']).toString().trim(); created.push(objects);
      const binding = docker(['port', objects, '9000/tcp']).toString().trim();
      assert.match(binding, /^127\.0\.0\.1:\d+$/);
      endpoint = `http://${binding}`;
    }
    const sql = (db, command) => docker(['exec', '-i', pg, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '-Atq'], command).toString().trim();
    await waitFor(() => { sql('postgres', 'SELECT 1;'); return true; });
    const s3 = s3Client(endpoint, accessKey, secretKey);
    await waitFor(async () => (await s3('GET', '/')).status === 200);
    phase = 'synthetic fixture';
    sql('postgres', 'CREATE DATABASE recovery_source; CREATE DATABASE recovery_restored;');
    sql('recovery_source', `CREATE TABLE organizations(id text PRIMARY KEY); INSERT INTO organizations VALUES ('synthetic-org'); CREATE TABLE documents(id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id), object_key text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>=0)); INSERT INTO documents VALUES ('synthetic-doc','synthetic-org','proposal.pdf',12345); ALTER TABLE documents ENABLE ROW LEVEL SECURITY; ALTER TABLE documents FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_policy ON documents USING (organization_id = current_setting('app.org_id', true));`);
    const sourceRows = sql('recovery_source', 'SELECT row_to_json(d)::text FROM documents d ORDER BY id;');
    const object = Buffer.concat([Buffer.from('%PDF-1.4\nSynthetic recovery fixture\n'), randomBytes(2048)]);
    assert.equal((await s3('PUT', '/recovery-source')).status, 200);
    assert.equal((await s3('PUT', '/recovery-source/proposal.pdf', object)).status, 200);
    assert.equal((await fetch(`${endpoint}/recovery-source/proposal.pdf`)).status, 403);
    phase = 'backup';
    report.snapshotAt = new Date().toISOString();
    const backupStart = performance.now();
    const dump = docker(['exec', pg, 'pg_dump', '-U', 'postgres', '-Fc', 'recovery_source']);
    const storedObject = await s3('GET', '/recovery-source/proposal.pdf'); assert.equal(storedObject.status, 200);
    writeFileSync(resolve(options.output, 'synthetic-db.dump'), dump, { mode: 0o600 });
    writeFileSync(resolve(options.output, 'synthetic-private-object.bin'), storedObject.bytes, { mode: 0o600 });
    report.backupMs = Math.round(performance.now() - backupStart);
    // Conservative snapshot age starts before pg_dump acquires its snapshot.
    const snapshotTime = backupStart;
    // Prove the restore point excludes later writes; never operate on any external DB.
    sql('recovery_source', "INSERT INTO documents VALUES ('after-backup','synthetic-org','later.pdf',999);");
    report.simulatedDataLossWindowMs = Math.round(performance.now() - snapshotTime);
    report.incidentAt = new Date().toISOString();
    const incidentTime = performance.now();
    sql('postgres', 'DROP DATABASE recovery_source;');
    assert.equal((await s3('DELETE', '/recovery-source/proposal.pdf')).status, 204);
    const sourceAbsent = (await s3('GET', '/recovery-source/proposal.pdf')).status === 404 && sql('postgres', "SELECT count(*) FROM pg_database WHERE datname='recovery_source';") === '0';
    phase = 'restore';
    const restoreStart = performance.now();
    docker(['exec', '-i', pg, 'pg_restore', '-U', 'postgres', '--exit-on-error', '-d', 'recovery_restored'], readFileSync(resolve(options.output, 'synthetic-db.dump')));
    assert.equal((await s3('PUT', '/recovery-restored')).status, 200);
    assert.equal((await s3('PUT', '/recovery-restored/proposal.pdf', readFileSync(resolve(options.output, 'synthetic-private-object.bin')))).status, 200);
    const restored = await s3('GET', '/recovery-restored/proposal.pdf'); assert.equal(restored.status, 200);
    const restoredRows = sql('recovery_restored', 'SELECT row_to_json(d)::text FROM documents d ORDER BY id;');
    const catalog = JSON.parse(sql('recovery_restored', "SELECT json_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity,'fk',(SELECT count(*) FROM pg_constraint WHERE conrelid='documents'::regclass AND contype='f')) FROM pg_class WHERE oid='documents'::regclass;"));
    const privateStatus = (await fetch(`${endpoint}/recovery-restored/proposal.pdf`)).status;
    verifyRestoredEvidence({ expectedHash: sha256(object), restoredHash: sha256(restored.bytes), expectedRows: sourceRows, restoredRows, missingSource: sourceAbsent, privateStatus, rlsEnabled: catalog.enabled, rlsForced: catalog.forced, foreignKeyCount: catalog.fk });
    // pg_dump preserves policies, but roles are cluster-global. Provision a fresh
    // restricted role explicitly, as a real recovery must provision its grants.
    sql('postgres', 'CREATE ROLE recovery_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;');
    sql('recovery_restored', 'GRANT USAGE ON SCHEMA public TO recovery_reader; GRANT SELECT ON documents TO recovery_reader;');
    const tenantCount = (org) => sql('recovery_restored', `SET ROLE recovery_reader; SET app.org_id='${org}'; SELECT count(*) FROM documents;`);
    assert.equal(tenantCount('synthetic-org'), '1', 'restored own-tenant RLS visibility failed');
    assert.equal(tenantCount('foreign-org'), '0', 'restored RLS exposed foreign-tenant rows');
    assert.equal(sql('recovery_restored', 'SET ROLE recovery_reader; SELECT count(*) FROM documents;'), '0', 'unscoped restored RLS exposed rows');
    assert.equal(sql('recovery_restored', `DO $$ BEGIN INSERT INTO documents VALUES ('invalid','missing-org','none',1); RAISE EXCEPTION 'FK accepted invalid reference'; EXCEPTION WHEN foreign_key_violation THEN NULL; END $$; SELECT 'fk-enforced';`), 'fk-enforced');
    report.restoreMs = Math.round(performance.now() - restoreStart);
    report.incidentToVerifiedRecoveryMs = Math.round(performance.now() - incidentTime);
    report.objectSha256 = sha256(restored.bytes);
    report.dumpSha256 = sha256(dump);
    report.objectBytes = restored.bytes.length;
    report.syntheticRowsAtSnapshot = 1;
    report.postSnapshotWritesExcluded = 1;
    report.checks = ['database removed before recovery', 'source object removed before recovery', 'database rows equal snapshot', 'post-snapshot write excluded', 'foreign-key restored', 'RLS enabled and forced restored', 'restricted-role same-tenant read passes', 'restricted-role foreign and unscoped reads return zero', 'foreign-key rejects invalid reference', 'object bytes SHA-256 equal', 'private object anonymous read denied'];
    report.images = created.map((container) => JSON.parse(docker(['inspect', container, '--format', '{{json .Image}}']).toString()));
    report.status = 'PASS';
  } catch (error) {
    report.failedPhase = phase;
    report.error = error instanceof assert.AssertionError ? error.message : `Rehearsal failed during ${phase}; inspect local disposable runtime.`;
  } finally {
    if (localObjects && localObjects.exitCode === null) {
      localObjects.kill('SIGTERM');
      await new Promise((done) => { localObjects.once('exit', done); setTimeout(() => { localObjects.kill('SIGKILL'); done(); }, 2000).unref(); });
    }
    if (localData) rmSync(localData, { recursive: true, force: true });
    for (const container of created.reverse()) { try { docker(['rm', '-f', '-v', container]); } catch { report.cleanupFailed = true; report.status = 'FAIL'; } }
    report.finishedAt = new Date().toISOString();
    writeFileSync(resolve(options.output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log('Usage: node scripts/beta-recovery-rehearsal.mjs [--output=<directory>] [--rustfs-binary=<local-path>]\nCreates and destroys only uniquely named local Docker synthetic fixtures.');
    else { const report = await run(options); console.log(JSON.stringify(report, null, 2)); if (report.status !== 'PASS') process.exitCode = 1; }
  } catch { console.error('Refused invalid rehearsal arguments. No remote targets are supported.'); process.exitCode = 1; }
}
