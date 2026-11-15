import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exportJourney } from '../invited-beta-journey-export.mjs';

const ids = Object.fromEntries(['orgId', 'userId', 'customerId', 'projectId', 'estimateId', 'proposalId'].map((key, index) => [key, `00000000-0000-4000-8000-00000000000${index}`]));
const sha = 'a'.repeat(40);
function responses() {
  return {
    '/health': { status: 'ok', commitSha: sha },
    '/ready': { status: 'ready', checks: { database: { status: 'ok', projectRef: 'qfbgdkbamfaasmtjfyru' } } },
    '/api/v1/settings': { orgId: ids.orgId, currentUserId: ids.userId, currentRole: 'owner' },
    [`/api/v1/customers/${ids.customerId}`]: { id: ids.customerId, orgId: ids.orgId, name: 'Synthetic Customer', projects: [{ unwanted: true }] },
    [`/api/v1/projects/${ids.projectId}`]: { id: ids.projectId, orgId: ids.orgId, customerId: ids.customerId, estimates: [{ id: ids.estimateId, version: 2 }], invoices: [{ unwanted: true }] },
    [`/api/v1/estimates/${ids.estimateId}`]: { id: ids.estimateId, orgId: ids.orgId, projectId: ids.projectId, version: 2, totalPrice: 2.1, lineItems: [{ quantity: 3, unitCost: 0.7 }] },
    [`/api/v1/proposals/${ids.proposalId}`]: { id: ids.proposalId, projectId: ids.projectId, estimateId: ids.estimateId, finalPrice: 2.1, pdfUrl: 'https://evil.invalid/private?token=secret', deliveries: [{ unwanted: true }] },
    [`/api/v1/proposals/${ids.proposalId}/pdf`]: Buffer.from('%PDF-1.7\nsynthetic test document'),
  };
}
async function setup(t, amend = () => {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'journey-export-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = { ...ids, baseUrl: 'https://tradeos-costbook-git-staging-billykshowalters.vercel.app', expectedSha: sha, estimateVersion: 2, syntheticOnly: true, token: 'secret-bearer', outputDir: path.join(root, 'export') };
  const data = responses(); amend(data);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const record = data[new URL(url).pathname];
    if (record instanceof Response) return record;
    if (Buffer.isBuffer(record)) return new Response(record, { headers: { 'Content-Type': 'application/pdf' } });
    assert.notEqual(record, undefined, 'no unexpected endpoint or record-provided URL may be fetched');
    return Response.json(record);
  };
  return { config, calls, fetchImpl, root };
}

test('exports only selected bound records and PDF with verifiable hashes and private permissions', async t => {
  const { config, fetchImpl, calls } = await setup(t);
  const manifest = await exportJourney(config, { fetchImpl });
  assert.equal(manifest.files.length, 5);
  for (const file of manifest.files) {
    const bytes = await fs.readFile(path.join(config.outputDir, file.name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.equal(bytes.length, file.bytes);
    assert.equal((await fs.stat(path.join(config.outputDir, file.name))).mode & 0o777, 0o600);
  }
  assert.equal((await fs.stat(config.outputDir)).mode & 0o777, 0o700);
  const customer = JSON.parse(await fs.readFile(path.join(config.outputDir, 'customer.json')));
  assert.equal(customer.projects, undefined);
  const proposal = JSON.parse(await fs.readFile(path.join(config.outputDir, 'proposal.json')));
  assert.equal(proposal.pdfUrl, undefined); assert.equal(proposal.deliveries, undefined);
  assert.ok(calls.every(({ url, options }) => new URL(url).origin === config.baseUrl && options.method === 'GET' && options.redirect === 'error'));
  assert.ok(!JSON.stringify(manifest).includes(config.token));
});

for (const [name, amend, code] of [
  ['foreign existing Customer returns denial', data => { data[`/api/v1/customers/${ids.customerId}`] = new Response('foreign secret', { status: 404 }); }, 'API_READ_DENIED_OR_FAILED'],
  ['foreign org unexpectedly returned', data => { data[`/api/v1/customers/${ids.customerId}`].orgId = ids.userId; }, 'CUSTOMER_BINDING_MISMATCH'],
  ['wrong actor', data => { data['/api/v1/settings'].currentUserId = ids.proposalId; }, 'OWNER_ADMIN_BINDING_REQUIRED'],
  ['technician role', data => { data['/api/v1/settings'].currentRole = 'technician'; }, 'OWNER_ADMIN_BINDING_REQUIRED'],
  ['wrong saved Estimate version', data => { data[`/api/v1/estimates/${ids.estimateId}`].version = 3; }, 'ESTIMATE_BINDING_MISMATCH'],
  ['Proposal refers to another Estimate', data => { data[`/api/v1/proposals/${ids.proposalId}`].estimateId = ids.customerId; }, 'PROPOSAL_BINDING_MISMATCH'],
  ['PDF redirects', data => { data[`/api/v1/proposals/${ids.proposalId}/pdf`] = new Response(null, { status: 302, headers: { location: 'https://evil.invalid' } }); }, 'API_READ_DENIED_OR_FAILED'],
  ['PDF is HTML error', data => { data[`/api/v1/proposals/${ids.proposalId}/pdf`] = new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }); }, 'INVALID_PDF_RESPONSE'],
]) {
  test(`${name} fails without publishing partial output`, async t => {
    const { config, fetchImpl, root } = await setup(t, amend);
    await assert.rejects(exportJourney(config, { fetchImpl }), error => error.message === code && !error.message.includes('secret'));
    assert.deepEqual(await fs.readdir(root), []);
  });
}

test('rejects production target, implicit IDs, existing output and paths inside repositories', async t => {
  const { config, fetchImpl } = await setup(t);
  await assert.rejects(exportJourney({ ...config, baseUrl: 'https://production.invalid' }, { fetchImpl }), /STAGING_TARGET_REQUIRED/);
  await assert.rejects(exportJourney({ ...config, proposalId: '../other' }, { fetchImpl }), /EXPLICIT_UUIDS_REQUIRED/);
  await fs.mkdir(config.outputDir);
  await assert.rejects(exportJourney(config, { fetchImpl }), /OUTPUT_ALREADY_EXISTS/);
  await assert.rejects(exportJourney({ ...config, outputDir: path.resolve('export-test') }, { fetchImpl }), /OUTPUT_INSIDE_REPOSITORY/);
});
