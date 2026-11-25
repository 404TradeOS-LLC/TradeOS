// Canonical deployment-identity contract (S071).
//
// One shared gate for the browser-evidence workflows (S059/S068/S069, via
// app/scripts/s059-deployment-identity.mjs) and the staging orchestrator
// (via app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs).
// Before S071 each workflow re-proved identity ad hoc and the runtime
// published no environment or backend host: the expected SHA was
// operator-attested and nothing in app/backend/ read VERCEL_ENV.
//
// The contract verifies four public identifiers from the deployment itself
// — commit, environment, backend host, and the non-secret data-plane
// identifier — and fails closed on any mismatch, missing value, or
// unparseable identity. It never fetches, decrypts, or asserts a secret or
// an env inventory: the only requests are the three unauthenticated,
// public runtime surfaces (/health, /ready, /api/staging-runtime-identity),
// made with no headers.
//
// Environment vocabulary: Vercel reports "production" | "preview" |
// "development" (VERCEL_ENV). TradeOS deployment environments are
// "staging" | "preview" (rc-target SUPPORTED_ENVIRONMENTS). Vercel deploys
// the staging branch as a preview-target deployment, so a staging runtime
// reports VERCEL_ENV "preview" while its TradeOS deployment environment is
// "staging". The verifier maps that explicitly and refuses anything else:
// a runtime reporting "production" or "development", or no environment at
// all, can never be an evidence target.

import {
  PRODUCTION_HOSTNAMES,
  PRODUCTION_SUPABASE_REF,
  SUPPORTED_ENVIRONMENTS,
  assertNonProductionDataPlane,
} from "./rc-target.mjs";

export class DeploymentIdentityError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "DeploymentIdentityError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new DeploymentIdentityError(message, code);
}

// Vercel environments a deployed runtime may report.
export const RUNTIME_ENVIRONMENTS = Object.freeze(["production", "preview", "development"]);

const SHA_40 = /^[0-9a-f]{40}$/i;

function normalizeHost(value) {
  if (typeof value !== "string") return undefined;
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  return host === "" ? undefined : host;
}

function hostOf(origin) {
  try {
    return new URL(origin).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Verify an observed runtime identity against the expected identity.
 * `expected` is operator/URL-derived: { commitSha, environment
 * ("staging" | "preview"), backendHost (hostname), supabaseProjectRef }.
 * `observed` comes from collectRuntimeIdentity: { commitSha, environment
 * (Vercel environment), backendHost (hostname), supabaseProjectRef,
 * webIdentityPublished, webCommitSha?, webEnvironment?, webBranch?,
 * webBackendHost?, webProjectRef? }.
 * `options.requireShaCorrelation` (default true) requires the observed
 * commit to equal the expected commit. When false, the observed commit must
 * still be present and well-formed, but equality is not asserted — the
 * caller is explicitly running without SHA correlation and the returned
 * record says so. The web/API SHA equality is part of SHA correlation and
 * is gated on the same option (CodeRabbit Minor on PR #1096): with
 * correlation off, the s059 script accepts any READY deployment on the
 * branch, so the web and API surfaces may legitimately disagree. The web
 * SHA is still collected and recorded. Environment, backend host, and
 * data-plane checks are never relaxed.
 * `options.requireWebIdentity` (default false) requires the web runtime
 * identity to be published. Staging correlation and S059 evidence set it:
 * without a published web identity the web SHA, branch, backend binding,
 * and data plane are unverifiable, and silently skipping them would accept
 * a target the pre-S071 implementation rejected. Ordinary previews keep
 * the optional behavior — their web runtime reports 404 by design.
 * Returns the verified identity (public identifiers only). Throws
 * DeploymentIdentityError on any mismatch, missing value, unparseable
 * identity, or production target.
 */
export function verifyDeploymentIdentity({ expected, observed, options = {} }) {
  const requireShaCorrelation = options.requireShaCorrelation !== false;
  const expectedSha = typeof expected?.commitSha === "string" ? expected.commitSha.trim().toLowerCase() : "";
  if (!expectedSha) fail("IDENTITY_EXPECTED_SHA_MISSING", "Expected commit SHA is required for deployment identity.");
  if (!SHA_40.test(expectedSha)) fail("IDENTITY_EXPECTED_SHA_MALFORMED", "Expected commit SHA must be a 40-character hex string.");

  const observedSha = typeof observed?.commitSha === "string" ? observed.commitSha.trim().toLowerCase() : "";
  if (!observedSha) fail("IDENTITY_SHA_MISSING", "The deployment did not report a commit SHA.");
  if (!SHA_40.test(observedSha)) fail("IDENTITY_SHA_MALFORMED", "The deployment reported a malformed commit SHA.");
  if (requireShaCorrelation && observedSha !== expectedSha) fail("IDENTITY_SHA_MISMATCH", "Deployment SHA mismatch.");

  const expectedEnvironment = typeof expected?.environment === "string" ? expected.environment.trim().toLowerCase() : "";
  if (!SUPPORTED_ENVIRONMENTS.includes(expectedEnvironment)) {
    fail("IDENTITY_ENVIRONMENT_UNSUPPORTED", "Expected deployment environment must be a supported non-production environment.");
  }

  const runtimeEnvironment = typeof observed?.environment === "string" ? observed.environment.trim() : "";
  if (!RUNTIME_ENVIRONMENTS.includes(runtimeEnvironment)) {
    fail("IDENTITY_ENVIRONMENT_MISSING", "The deployment did not publish a recognized runtime environment.");
  }
  if (runtimeEnvironment === "production") {
    fail("IDENTITY_PRODUCTION_REFUSED", "Refusing a production runtime as an evidence target.");
  }
  if (runtimeEnvironment !== "preview") {
    fail("IDENTITY_ENVIRONMENT_UNACCEPTABLE", "Only a preview-target deployment may serve as an evidence target.");
  }

  if (expectedEnvironment === "staging" && observed?.webIdentityPublished) {
    if (observed.webBranch !== "staging") {
      fail("IDENTITY_BRANCH_MISMATCH", "The web runtime is not the staging branch deployment.");
    }
  }

  const expectedHost = normalizeHost(expected?.backendHost);
  if (!expectedHost) fail("IDENTITY_BACKEND_HOST_MISSING", "Expected backend host is required for deployment identity.");
  if (PRODUCTION_HOSTNAMES.includes(expectedHost)) {
    fail("IDENTITY_PRODUCTION_REFUSED", "Refusing a production backend host as an evidence target.");
  }
  const observedHost = normalizeHost(observed?.backendHost);
  if (!observedHost) fail("IDENTITY_BACKEND_HOST_MISSING", "The deployment did not report a backend host.");
  if (PRODUCTION_HOSTNAMES.includes(observedHost)) {
    fail("IDENTITY_PRODUCTION_REFUSED", "Refusing a production backend host as an evidence target.");
  }
  if (observedHost !== expectedHost) fail("IDENTITY_BACKEND_HOST_MISMATCH", "Backend host mismatch.");

  // The observed data-plane identifier must be present and non-production
  // before any cross-check reads it: a missing observed ref is its own
  // fail-closed case, not a web/API mismatch.
  const observedRef = typeof observed?.supabaseProjectRef === "string" ? observed.supabaseProjectRef.trim().toLowerCase() : "";
  if (!observedRef) fail("IDENTITY_DATA_PLANE_MISSING", "The deployment did not report a data-plane identifier.");
  if (observedRef === PRODUCTION_SUPABASE_REF) {
    fail("IDENTITY_PRODUCTION_REFUSED", "Refusing the production data plane as an evidence target.");
  }

  // The expected-vs-observed data-plane check runs before the web
  // cross-checks: when the API data plane itself is wrong, that is the
  // reported mismatch, not the web/API disagreement it also causes.
  let expectedRef;
  try {
    expectedRef = assertNonProductionDataPlane(expected?.supabaseProjectRef);
  } catch {
    fail("IDENTITY_DATA_PLANE_INVALID", "Expected data-plane identifier is not an approved non-production project.");
  }
  if (observedRef !== expectedRef) fail("IDENTITY_DATA_PLANE_MISMATCH", "Data-plane identifier mismatch.");

  // Staging correlation and S059 evidence require the web identity to be
  // published: without it the web SHA, branch, backend binding, and data
  // plane are unverifiable, and silently skipping them would accept a
  // target the pre-S071 implementation rejected (it failed on a non-200
  // web identity response). Ordinary previews keep the optional behavior
  // — their web runtime reports 404 by design.
  if (options.requireWebIdentity && !observed?.webIdentityPublished) {
    fail("IDENTITY_WEB_IDENTITY_UNPUBLISHED", "The web runtime identity is not published for this deployment.");
  }

  if (observed?.webIdentityPublished) {
    // The web/API SHA equality is a SHA-correlation assertion, gated on
    // requireShaCorrelation (see the option's doc comment): with
    // correlation off, the web and API surfaces may legitimately be
    // different READY deployments of the same branch.
    if (requireShaCorrelation && typeof observed.webCommitSha === "string" && observed.webCommitSha.trim().toLowerCase() !== observedSha) {
      fail("IDENTITY_WEB_SHA_MISMATCH", "Web runtime commit does not match the API runtime commit.");
    }
    if (typeof observed.webEnvironment === "string" && observed.webEnvironment !== runtimeEnvironment) {
      fail("IDENTITY_WEB_ENVIRONMENT_MISMATCH", "Web runtime environment does not match the API runtime environment.");
    }
    if (typeof observed.webProjectRef === "string" && observed.webProjectRef !== observedRef) {
      fail("IDENTITY_WEB_DATA_PLANE_MISMATCH", "Web runtime data plane does not match the API runtime data plane.");
    }
    const webBackendHost = normalizeHost(observed.webBackendHost);
    // The web's backend claim is checked for shape and non-production
    // only — NOT for equality with the API origin host. The web points at
    // the backend by its stable alias while evidence fetches /health from
    // the selected deployment's own URL, so the two hosts legitimately
    // differ; the alias-to-deployment binding is proven separately by the
    // caller's Vercel deployment lookup (deployment-uid equality in
    // s059-deployment-identity.mjs). Equating the hosts here would fail
    // closed on every real staging run.
    if (webBackendHost && PRODUCTION_HOSTNAMES.includes(webBackendHost)) {
      fail("IDENTITY_PRODUCTION_REFUSED", "Refusing a production backend host as an evidence target.");
    }
  }

  return {
    commitSha: observedSha,
    environment: expectedEnvironment,
    backendHost: observedHost,
    supabaseProjectRef: observedRef,
    shaCorrelated: requireShaCorrelation,
    verifiedAt: new Date().toISOString(),
  };
}

function assertPublicOrigin(rawOrigin, label) {
  if (typeof rawOrigin !== "string" || rawOrigin.trim() === "") {
    fail("IDENTITY_ORIGIN_MISSING", `${label} origin is required.`);
  }
  let parsed;
  try {
    parsed = new URL(rawOrigin.trim());
  } catch {
    fail("IDENTITY_ORIGIN_MALFORMED", `${label} origin is not a valid absolute URL.`);
  }
  if (parsed.protocol !== "https:") fail("IDENTITY_ORIGIN_NOT_HTTPS", `${label} origin must use HTTPS.`);
  if (parsed.username || parsed.password) fail("IDENTITY_ORIGIN_HAS_CREDENTIALS", `${label} origin must not embed credentials.`);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    fail("IDENTITY_ORIGIN_NOT_ORIGIN", `${label} origin must be a bare origin without a path, query, or fragment.`);
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (PRODUCTION_HOSTNAMES.includes(host)) {
    fail("IDENTITY_PRODUCTION_REFUSED", `Refusing a production host as an evidence target.`);
  }
  return parsed.origin;
}

async function readJson(fetchImpl, url, label) {
  let response;
  try {
    response = await fetchImpl(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    // Transport errors are never echoed: they can carry credentials or
    // internal host detail, and the message reaches CI logs.
    fail("IDENTITY_RUNTIME_UNAVAILABLE", `${label} is unavailable.`);
  }
  if (!response || response.ok !== true) {
    fail("IDENTITY_RUNTIME_UNAVAILABLE", `${label} did not return a successful response.`);
  }
  try {
    return await response.json();
  } catch {
    fail("IDENTITY_UNPARSEABLE", `${label} did not return parseable JSON.`);
  }
}

/**
 * Collect the observed runtime identity from the deployment's public
 * surfaces. Fetches the web runtime identity (404 = not published, which
 * non-staging previews report by design), the API /health, and the API
 * /ready — no headers, no credentials, no env inventory. /health is read
 * a second time after /ready and the two SHAs must agree, binding the
 * /health and /ready observations to one deployment (/ready reports no
 * commit SHA). Throws DeploymentIdentityError fail-closed on any
 * unavailable, non-200 (other than web 404), missing, or malformed
 * identity, or on a deployment change mid-collection.
 */
export async function collectRuntimeIdentity({ webOrigin, apiOrigin, fetchImpl = globalThis.fetch }) {
  const web = assertPublicOrigin(webOrigin, "Web");
  const api = assertPublicOrigin(apiOrigin, "API");
  const apiHost = hostOf(api);

  let webBody;
  let webIdentityPublished = false;
  try {
    const webResponse = await fetchImpl(`${web}/api/staging-runtime-identity`, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (webResponse?.status === 404) {
      webIdentityPublished = false;
    } else if (webResponse?.ok === true) {
      try {
        webBody = await webResponse.json();
      } catch {
        fail("IDENTITY_UNPARSEABLE", "Web runtime identity did not return parseable JSON.");
      }
      webIdentityPublished = true;
    } else {
      fail("IDENTITY_RUNTIME_UNAVAILABLE", "Web runtime identity did not return a successful response.");
    }
  } catch (error) {
    if (error instanceof DeploymentIdentityError) throw error;
    fail("IDENTITY_RUNTIME_UNAVAILABLE", "Web runtime identity is unavailable.");
  }

  const health = await readJson(fetchImpl, `${api}/health`, "API /health");
  const ready = await readJson(fetchImpl, `${api}/ready`, "API /ready");

  if (health?.status !== "ok" || typeof health?.commitSha !== "string" || health.commitSha === "") {
    fail("IDENTITY_UNPARSEABLE", "API /health did not report a usable identity.");
  }
  const projectRef = ready?.checks?.database?.projectRef;
  if (ready?.status !== "ready" || ready?.checks?.database?.status !== "ok" || typeof projectRef !== "string" || projectRef === "") {
    fail("IDENTITY_UNPARSEABLE", "API /ready did not report a usable data-plane identity.");
  }

  // Bind the /health and /ready observations to one deployment: /ready
  // reports no commit SHA, so /health is read again after /ready and the
  // two SHAs must agree. If the alias repointed between the two reads,
  // the deployment changed mid-collection and the identity is rejected
  // (IDENTITY_CHANGED, the same code as the pre/post-capture check).
  const healthRecheck = await readJson(fetchImpl, `${api}/health`, "API /health");
  if (healthRecheck?.status !== "ok" || typeof healthRecheck?.commitSha !== "string" || healthRecheck.commitSha === "") {
    fail("IDENTITY_UNPARSEABLE", "API /health did not report a usable identity.");
  }
  if (healthRecheck.commitSha !== health.commitSha) {
    fail("IDENTITY_CHANGED", "Deployment identity changed during collection (commitSha).");
  }

  const observed = {
    commitSha: health.commitSha,
    environment: typeof health.environment === "string" ? health.environment : undefined,
    backendHost: apiHost,
    supabaseProjectRef: projectRef,
    webIdentityPublished,
  };

  if (webIdentityPublished) {
    if (
      webBody?.status !== "configured" ||
      typeof webBody?.commitSha !== "string" ||
      typeof webBody?.branch !== "string" ||
      typeof webBody?.environment !== "string" ||
      typeof webBody?.supabaseProjectRef !== "string" ||
      typeof webBody?.backendOrigin !== "string" ||
      webBody?.scope !== "public_configuration_only"
    ) {
      fail("IDENTITY_UNPARSEABLE", "Web runtime identity did not report a usable identity.");
    }
    observed.webCommitSha = webBody.commitSha;
    observed.webEnvironment = webBody.environment;
    observed.webBranch = webBody.branch;
    observed.webProjectRef = webBody.supabaseProjectRef;
    observed.webBackendHost = hostOf(webBody.backendOrigin);
    if (!observed.webBackendHost) {
      fail("IDENTITY_UNPARSEABLE", "Web runtime identity did not report a usable backend host.");
    }
  }

  return observed;
}

// Fields compared across a capture window in addition to the four core
// identity fields, when both records carry them (the s059 identity file
// carries deployment ids and the backend binding).
const DRIFT_COMPARED_FIELDS = Object.freeze(["id", "apiDeploymentId", "backendOrigin", "backendBinding"]);

/**
 * Pre/post-capture verification: the identity observed after capture must
 * equal the identity observed before it. Any drift fails the run — a
 * deployment change during capture invalidates the evidence.
 */
export function verifyIdentityUnchanged(before, after) {
  const core = ["commitSha", "environment", "backendHost", "supabaseProjectRef"];
  for (const field of core) {
    const a = typeof before?.[field] === "string" ? before[field].trim().toLowerCase() : before?.[field];
    const b = typeof after?.[field] === "string" ? after[field].trim().toLowerCase() : after?.[field];
    if (a !== b) fail("IDENTITY_CHANGED", `Deployment identity changed during evidence capture (${field}).`);
  }
  for (const field of DRIFT_COMPARED_FIELDS) {
    if (before?.[field] !== undefined && after?.[field] !== undefined && before[field] !== after[field]) {
      fail("IDENTITY_CHANGED", `Deployment identity changed during evidence capture (${field}).`);
    }
  }
  return true;
}
