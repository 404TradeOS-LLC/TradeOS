import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const STAGING_API = 'https://tradeos-costbook-git-staging-billykshowalters.vercel.app';
const STAGING_REF = 'qfbgdkbamfaasmtjfyru';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/i;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const pick = (record, fields) => Object.fromEntries(fields.filter(key => key in record).map(key => [key, record[key]]));

class ExportError extends Error { constructor(code) { super(code); this.code = code; } }
function requireValue(condition, code) { if (!condition) throw new ExportError(code); }

async function requireOutsideRepository(outputDir) {
  requireValue(path.isAbsolute(outputDir), 'OUTPUT_MUST_BE_ABSOLUTE');
  let parent = path.dirname(outputDir);
  // Resolve existing parents so a symlink cannot place exports inside a worktree.
  parent = await fs.realpath(parent);
  for (let cursor = parent;; cursor = path.dirname(cursor)) {
    try { await fs.lstat(path.join(cursor, '.git')); throw new ExportError('OUTPUT_INSIDE_REPOSITORY'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(cursor) === cursor) break;
  }
  const destination = path.join(parent, path.basename(outputDir));
  try { await fs.lstat(destination); throw new ExportError('OUTPUT_ALREADY_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return destination;
}

/** Export one explicitly selected synthetic staging journey through existing GET APIs only. */
export async function exportJourney(config, { fetchImpl = fetch } = {}) {
  requireValue(config.baseUrl === STAGING_API, 'STAGING_TARGET_REQUIRED');
  requireValue(SHA.test(config.expectedSha ?? ''), 'EXPECTED_SHA_REQUIRED');
  for (const name of ['orgId', 'userId', 'customerId', 'projectId', 'estimateId', 'proposalId']) {
    requireValue(UUID.test(config[name] ?? ''), 'EXPLICIT_UUIDS_REQUIRED');
  }
  requireValue(Number.isSafeInteger(config.estimateVersion) && config.estimateVersion > 0, 'ESTIMATE_VERSION_REQUIRED');
  requireValue(typeof config.token === 'string' && config.token.length > 0 && !/[\r\n]/.test(config.token), 'TOKEN_REQUIRED');
  requireValue(config.syntheticOnly === true, 'SYNTHETIC_REHEARSAL_ONLY');
  const destination = await requireOutsideRepository(config.outputDir);
  async function get(route, { pdf = false, anonymous = false } = {}) {
    let response;
    try {
      response = await fetchImpl(STAGING_API + route, {
        method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000),
        headers: anonymous ? {} : { Authorization: `Bearer ${config.token}` },
      });
    } catch { throw new ExportError('API_TRANSPORT_FAILED'); }
    requireValue(response.status === 200, 'API_READ_DENIED_OR_FAILED');
    const max = pdf ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
    requireValue(Number(response.headers.get('content-length') ?? 0) <= max, 'RESPONSE_TOO_LARGE');
    const chunks = []; let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > max) throw new ExportError('RESPONSE_TOO_LARGE');
        chunks.push(Buffer.from(chunk));
      }
    } catch (error) { if (error instanceof ExportError) throw error; throw new ExportError('API_BODY_FAILED'); }
    const bytes = Buffer.concat(chunks);
    if (pdf) {
      requireValue(response.headers.get('content-type')?.split(';')[0] === 'application/pdf' && bytes.subarray(0, 5).toString() === '%PDF-', 'INVALID_PDF_RESPONSE');
      return bytes;
    }
    try { return JSON.parse(bytes.toString('utf8')); } catch { throw new ExportError('INVALID_JSON_RESPONSE'); }
  }
  async function identity() {
    const health = await get('/health', { anonymous: true });
    const ready = await get('/ready', { anonymous: true });
    requireValue(health.status === 'ok' && health.commitSha === config.expectedSha, 'RUNTIME_SHA_MISMATCH');
    requireValue(ready.status === 'ready' && ready.checks?.database?.status === 'ok' && ready.checks?.database?.projectRef === STAGING_REF, 'STAGING_DATABASE_NOT_READY');
  }
  await identity();
  const settings = await get('/api/v1/settings');
  requireValue(settings.orgId === config.orgId && settings.currentUserId === config.userId && ['owner', 'admin'].includes(settings.currentRole), 'OWNER_ADMIN_BINDING_REQUIRED');
  const customer = await get(`/api/v1/customers/${config.customerId}`);
  requireValue(customer.id === config.customerId && customer.orgId === config.orgId, 'CUSTOMER_BINDING_MISMATCH');
  const project = await get(`/api/v1/projects/${config.projectId}`);
  requireValue(project.id === config.projectId && project.orgId === config.orgId && project.customerId === customer.id, 'PROJECT_BINDING_MISMATCH');
  const estimate = await get(`/api/v1/estimates/${config.estimateId}`);
  requireValue(estimate.id === config.estimateId && estimate.orgId === config.orgId && estimate.projectId === project.id && estimate.version === config.estimateVersion, 'ESTIMATE_BINDING_MISMATCH');
  requireValue(Array.isArray(estimate.lineItems) && project.estimates?.some(row => row.id === estimate.id && row.version === estimate.version), 'ESTIMATE_VERSION_NOT_IN_PROJECT');
  const proposal = await get(`/api/v1/proposals/${config.proposalId}`);
  requireValue(proposal.id === config.proposalId && proposal.projectId === project.id && proposal.estimateId === estimate.id, 'PROPOSAL_BINDING_MISMATCH');
  const pdf = await get(`/api/v1/proposals/${config.proposalId}/pdf`, { pdf: true });
  await identity();
  // Deliberately omit related Jobs/invoices, deliveries and record-provided URLs.
  const files = {
    'customer.json': pick(customer, ['id', 'orgId', 'name', 'email', 'phone', 'address', 'billingAddress', 'notes', 'createdAt', 'updatedAt', 'serviceAddresses', 'equipmentAssets']),
    'project.json': pick(project, ['id', 'orgId', 'customerId', 'name', 'jobType', 'siteAddress', 'simpleScope', 'regionId', 'status', 'createdAt', 'updatedAt']),
    'estimate.json': estimate,
    'proposal.json': pick(proposal, ['id', 'projectId', 'estimateId', 'status', 'companyName', 'showLineItemDetail', 'scopeOfWork', 'assumptions', 'exclusions', 'timeline', 'priceLow', 'priceHigh', 'finalPrice', 'paymentScheduleJson', 'termsAndConditions', 'sentAt', 'viewedAt', 'respondedAt', 'createdAt']),
  };
  const buffers = Object.fromEntries(Object.entries(files).map(([name, body]) => [name, Buffer.from(JSON.stringify(body, null, 2) + '\n')]));
  buffers['proposal.pdf'] = pdf;
  const manifest = {
    format: 'tradeos-selected-beta-journey-v1', capturedAt: new Date().toISOString(), environment: 'staging',
    sourceSha: config.expectedSha, databaseProject: STAGING_REF, syntheticOnly: true,
    selection: pick(config, ['orgId', 'userId', 'customerId', 'projectId', 'estimateId', 'estimateVersion', 'proposalId']),
    files: Object.entries(buffers).map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: sha256(bytes) })),
    limitations: ['Selected journey only; not a full tenant, Storage, audit or GDPR export', 'Point-in-time API reads, not a transactional database snapshot', 'No restoration/import/deletion or email delivery performed', 'Existing API representations; related Jobs/invoices and delivery histories excluded', 'Synthetic staging rehearsal only; real cohort exports require an explicitly approved data-handling procedure'],
  };
  const temporary = await fs.mkdtemp(path.join(path.dirname(destination), '.tradeos-export-'));
  let reserved = false; let published = false;
  try {
    await fs.chmod(temporary, 0o700);
    for (const [name, bytes] of Object.entries(buffers)) await fs.writeFile(path.join(temporary, name), bytes, { mode: 0o600, flag: 'wx' });
    await fs.writeFile(path.join(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    // Reserve the new name exclusively; never replace an existing operator directory.
    await fs.mkdir(destination, { mode: 0o700 }); reserved = true;
    await fs.rename(temporary, destination); published = true;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
    if (reserved && !published) await fs.rmdir(destination);
  }
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    // Selection files contain IDs only. Authentication is supplied in-memory via the environment.
    const selection = JSON.parse(await fs.readFile(process.env.BETA_EXPORT_SELECTION, 'utf8'));
    const manifest = await exportJourney({ ...selection, token: process.env.BETA_EXPORT_TOKEN, outputDir: process.env.BETA_EXPORT_OUTPUT });
    console.log(JSON.stringify({ status: 'passed', scope: manifest.format, fileCount: manifest.files.length, sourceSha: manifest.sourceSha }));
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', code: error instanceof ExportError ? error.code : 'EXPORT_FAILED' }));
    process.exitCode = 1;
  }
}
