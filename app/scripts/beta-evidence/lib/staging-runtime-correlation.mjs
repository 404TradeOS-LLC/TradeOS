import { RcTargetError } from './rc-target.mjs';

export const STAGING_WEB_ORIGIN = 'https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app';
export const STAGING_API_ORIGIN = 'https://tradeos-costbook-git-staging-billykshowalters.vercel.app';
export const STAGING_PROJECT_REF = 'qfbgdkbamfaasmtjfyru';

/** Correlate the actual web and API runtimes without trusting repository variables. */
export async function correlateStagingRuntime({ baseUrl, expectedSha, projectRef, fetchImpl = globalThis.fetch }) {
  const fail = () => { throw new RcTargetError('Staging web/API runtime identity is unavailable or does not match the approved source and data plane.', 'STAGING_RUNTIME_MISMATCH'); };
  if (baseUrl !== STAGING_WEB_ORIGIN || projectRef !== STAGING_PROJECT_REF || !/^[a-f0-9]{40}$/.test(expectedSha ?? '')) fail();
  let web, health, ready;
  try {
    const read = async (url) => {
      const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' });
      if (!response.ok) throw new Error('Runtime identity unavailable');
      return response.json();
    };
    [web, health, ready] = await Promise.all([
      read(`${STAGING_WEB_ORIGIN}/api/staging-runtime-identity`),
      read(`${STAGING_API_ORIGIN}/health`),
      read(`${STAGING_API_ORIGIN}/ready`),
    ]);
  } catch { fail(); }
  if (web?.status !== 'configured' || web.branch !== 'staging' || web.commitSha !== expectedSha ||
      web.supabaseProjectRef !== STAGING_PROJECT_REF || web.backendOrigin !== STAGING_API_ORIGIN ||
      web.scope !== 'public_configuration_only' || health?.status !== 'ok' || health.commitSha !== expectedSha ||
      ready?.status !== 'ready' || ready.checks?.database?.status !== 'ok' ||
      ready.checks.database.projectRef !== STAGING_PROJECT_REF) fail();
  return { deploymentSha: expectedSha, source: 'live-staging-web-api', dataPlaneRef: STAGING_PROJECT_REF };
}
