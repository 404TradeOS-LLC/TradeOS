// This starter checks the login shell only. Authenticated certification stays
// in the governed Beta Evidence runner, including data-plane attestation.
export function resolveAgentTarget(env = {}) {
  const target = new URL(env.TRADEOS_AGENT_BASE_URL || 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash || target.pathname !== '/') {
    throw new Error('TRADEOS_AGENT_BASE_URL must be an HTTP(S) origin without credentials, path, query, or fragment');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (local) return target.origin;
  // Vercel's current web project also emits "tradeos-costbook-<hash>-<scope>" URLs,
  // including production builds. That form is allowed ONLY after the assembly
  // workflow has independently attested an immutable non-production Preview.
  const standardPreview = /^tradeos-costbook-web-[a-z0-9-]+\.vercel\.app$/.test(target.hostname);
  const assemblyAttestedPreview =
    /^tradeos-costbook-[a-z0-9-]+\.vercel\.app$/.test(target.hostname) &&
    env.TRADEOS_ASSEMBLY_EVIDENCE === 'true' &&
    env.TRADEOS_AGENT_DEPLOYMENT_ATTESTED === 'true';
  if (target.protocol !== 'https:' || target.port || !(standardPreview || assemblyAttestedPreview) || target.hostname.includes('-git-main-')) {
    throw new Error('Playwright agents require loopback or an approved non-production TradeOS Preview origin');
  }
  if (!['preview', 'staging'].includes(env.TRADEOS_AGENT_ENVIRONMENT) || env.TRADEOS_AGENT_SANITIZED_TENANT !== 'true') {
    throw new Error('Hosted agent runs require preview/staging identity and TRADEOS_AGENT_SANITIZED_TENANT=true');
  }
  return target.origin;
}
