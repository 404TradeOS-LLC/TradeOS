import test from 'node:test';
import assert from 'node:assert/strict';
import { correlateStagingRuntime, STAGING_WEB_ORIGIN, STAGING_API_ORIGIN, STAGING_PROJECT_REF } from './staging-runtime-correlation.mjs';
const sha = 'a'.repeat(40);
const input = () => ({ baseUrl: STAGING_WEB_ORIGIN, expectedSha: sha, projectRef: STAGING_PROJECT_REF });
const payloads = () => [
  { status: 'configured', branch: 'staging', commitSha: sha, supabaseProjectRef: STAGING_PROJECT_REF, backendOrigin: STAGING_API_ORIGIN, scope: 'public_configuration_only' },
  { status: 'ok', commitSha: sha },
  { status: 'ready', checks: { database: { status: 'ok', projectRef: STAGING_PROJECT_REF } } },
];
function transport(data, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const i = url.endsWith('staging-runtime-identity') ? 0 : url.endsWith('/health') ? 1 : 2;
    return { ok: true, json: async () => data[i] };
  };
}
test('correlates matching live web/API SHA and data plane with no redirects or cache', async () => {
  const calls = [];
  assert.deepEqual(await correlateStagingRuntime({ ...input(), fetchImpl: transport(payloads(), calls) }), { deploymentSha: sha, source: 'live-staging-web-api', dataPlaneRef: STAGING_PROJECT_REF });
  assert.equal(calls.length, 3);
  assert.ok(calls.every(c => c.options.redirect === 'error' && c.options.cache === 'no-store'));
});
for (const [name, index, field, value] of [
  ['web SHA',0,'commitSha','b'.repeat(40)], ['web branch',0,'branch','main'], ['web project',0,'supabaseProjectRef','kssaceuetdjwfqnbzhly'],
  ['web backend',0,'backendOrigin','https://api.404tradeos.com'], ['web scope',0,'scope','other'], ['API SHA',1,'commitSha','b'.repeat(40)], ['API health',1,'status','failed'],
]) test(`rejects mismatched ${name}`, async () => {
  const data = payloads(); data[index][field] = value;
  await assert.rejects(correlateStagingRuntime({ ...input(), fetchImpl: transport(data) }), e => e.code === 'STAGING_RUNTIME_MISMATCH');
});
test('rejects ready failure, production data plane, and missing project proof', async () => {
  for (const ready of [{ status:'failed' }, { status:'ready', checks:{ database:{status:'ok',projectRef:'kssaceuetdjwfqnbzhly'} } }, { status:'ready',checks:{database:{status:'ok'}} }]) {
    const data = payloads(); data[2] = ready;
    await assert.rejects(correlateStagingRuntime({ ...input(), fetchImpl: transport(data) }));
  }
});
test('rejects untrusted target and short SHA before making requests', async () => {
  for (const patch of [{baseUrl:'https://app.404tradeos.com'}, {expectedSha:'aaaaaaa'}, {projectRef:'kssaceuetdjwfqnbzhly'}]) {
    await assert.rejects(correlateStagingRuntime({ ...input(), ...patch, fetchImpl: () => assert.fail('must not fetch') }));
  }
});
test('redacts transport errors and refuses non-success responses', async () => {
  for (const fetchImpl of [async()=>{throw new Error('secret-token-in-error')}, async()=>({ok:false})]) {
    await assert.rejects(correlateStagingRuntime({ ...input(), fetchImpl }), e => !e.message.includes('secret-token') && e.code === 'STAGING_RUNTIME_MISMATCH');
  }
});
