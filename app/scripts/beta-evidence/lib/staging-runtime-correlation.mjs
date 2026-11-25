import { RcTargetError } from './rc-target.mjs';
import { collectRuntimeIdentity, verifyDeploymentIdentity } from './deployment-identity-contract.mjs';

export const STAGING_WEB_ORIGIN = 'https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app';
export const STAGING_API_ORIGIN = 'https://tradeos-costbook-git-staging-billykshowalters.vercel.app';
export const STAGING_PROJECT_REF = 'qfbgdkbamfaasmtjfyru';

/** Correlate the actual web and API runtimes without trusting repository variables. */
export async function correlateStagingRuntime({ baseUrl, expectedSha, projectRef, fetchImpl = globalThis.fetch }) {
  const fail = () => { throw new RcTargetError('Staging web/API runtime identity is unavailable or does not match the approved source and data plane.', 'STAGING_RUNTIME_MISMATCH'); };
  if (baseUrl !== STAGING_WEB_ORIGIN || projectRef !== STAGING_PROJECT_REF || !/^[a-f0-9]{40}$/.test(expectedSha ?? '')) fail();
  try {
    // Canonical S071 identity contract: commit, environment, backend host,
    // and data-plane identifier are verified from the deployment itself.
    // Any mismatch, missing value, or unparseable identity fails closed;
    // transport errors are never echoed (the contract redacts them).
    const observed = await collectRuntimeIdentity({ webOrigin: STAGING_WEB_ORIGIN, apiOrigin: STAGING_API_ORIGIN, fetchImpl });
    verifyDeploymentIdentity({
      expected: {
        commitSha: expectedSha,
        environment: 'staging',
        backendHost: new URL(STAGING_API_ORIGIN).hostname,
        supabaseProjectRef: STAGING_PROJECT_REF,
      },
      observed,
      // Staging correlation requires the web identity to be published:
      // without it the web SHA, branch, backend binding, and data plane
      // are unverifiable (Codex P1 on PR #1096).
      options: { requireWebIdentity: true },
    });
  } catch {
    fail();
  }
  return { deploymentSha: expectedSha, source: 'live-staging-web-api', dataPlaneRef: STAGING_PROJECT_REF };
}
