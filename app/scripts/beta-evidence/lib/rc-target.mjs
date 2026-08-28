// Pure, dependency-free helpers that decide whether a candidate deployment is a
// safe target for beta-evidence capture. Everything here is synchronous and
// side-effect free so `node --test` can cover it without a browser, a network,
// or a deployment.
//
// The rules encoded here are deliberately fail-closed: an unknown host, an
// unrecognised environment, or an unproven production-isolation claim is
// treated as production until proven otherwise.

// Production surfaces. These must never be mutated by evidence capture.
export const PRODUCTION_HOSTNAMES = Object.freeze([
  "app.404tradeos.com",
  "api.404tradeos.com",
]);

// Production Supabase project ref. web/scripts/preview-smoke-check.mjs already
// treats this as forbidden on Preview; the same constant gates mutations here
// so the two checks cannot drift apart.
export const PRODUCTION_SUPABASE_REF = "kssaceuetdjwfqnbzhly";

// The frontend Vercel project that serves the contractor UI. Preview
// deployments are always `<project>-<something>.vercel.app`; the bare
// `tradeos-costbook-web.vercel.app` alias tracks Production and is therefore
// NOT an approved RC host.
const APPROVED_RC_HOST = /^tradeos-costbook-web-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/;

// `-git-main-` previews build from the default branch and share Production's
// environment variables. They look like Previews but are not an isolated RC
// target, so they are rejected for mutating evidence.
const PRODUCTION_TRACKING_ALIAS = /^tradeos-costbook-web-git-main-[a-z0-9-]+\.vercel\.app$/;

export const SUPPORTED_ENVIRONMENTS = Object.freeze(["preview", "staging"]);

// Staging deployments use Vercel's branch alias for the `staging` branch.
const STAGING_ALIAS = /^tradeos-costbook-web-git-staging-[a-z0-9-]+\.vercel\.app$/;

export class RcTargetError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "RcTargetError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RcTargetError(message, code);
}

/**
 * Parse and validate an RC base URL.
 * Returns the parsed URL when the target is an approved non-production host.
 */
export function assertApprovedRcUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    fail("RC_URL_MISSING", "An RC base URL is required. Evidence cannot be captured without a resolved target.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    fail("RC_URL_MALFORMED", `RC base URL is not a valid absolute URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "https:") {
    fail("RC_URL_NOT_HTTPS", "RC base URL must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    fail("RC_URL_HAS_CREDENTIALS", "RC base URL must not embed credentials.");
  }
  if (parsed.search || parsed.hash) {
    fail("RC_URL_NOT_ORIGIN", "RC base URL must be a bare origin without query or fragment.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  if (PRODUCTION_HOSTNAMES.includes(hostname)) {
    fail("RC_URL_IS_PRODUCTION", `Refusing to run beta evidence against production host ${hostname}.`);
  }
  if (hostname === "tradeos-costbook-web.vercel.app") {
    fail(
      "RC_URL_IS_PRODUCTION_ALIAS",
      "tradeos-costbook-web.vercel.app is the Production alias, not an RC target.",
    );
  }
  if (PRODUCTION_TRACKING_ALIAS.test(hostname)) {
    fail(
      "RC_URL_TRACKS_MAIN",
      `${hostname} builds from the default branch and shares Production configuration; it is not an isolated RC target.`,
    );
  }
  if (!APPROVED_RC_HOST.test(hostname)) {
    fail(
      "RC_URL_NOT_APPROVED",
      `${hostname} is not an approved tradeos-costbook-web Vercel Preview host.`,
    );
  }

  return parsed;
}

/**
 * Derive the environment from the deployment host itself.
 *
 * This is what makes the environment assertion meaningful: the operator states
 * which environment they believe they are targeting, and it is checked against
 * the deployment actually resolved, rather than against a copy of their own
 * input. Production hosts are classified as production so callers can refuse
 * them explicitly rather than silently treating them as preview.
 */
export function deriveEnvironmentFromUrl(rawUrl) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    fail("RC_URL_MALFORMED", `Cannot derive an environment from ${rawUrl}.`);
  }

  if (PRODUCTION_HOSTNAMES.includes(hostname) || hostname === "tradeos-costbook-web.vercel.app") {
    return "production";
  }
  if (STAGING_ALIAS.test(hostname)) return "staging";
  if (APPROVED_RC_HOST.test(hostname)) return "preview";

  fail("ENV_UNDERIVABLE", `Cannot derive an environment from host ${hostname}.`);
}

/**
 * Environment identity assertion (expected vs actual).
 * Both sides must be explicitly supplied and must agree.
 */
export function assertEnvironmentIdentity(expected, actual) {
  if (!expected) fail("ENV_EXPECTED_MISSING", "EXPECTED_ENVIRONMENT is required.");
  if (!actual) fail("ENV_ACTUAL_MISSING", "ACTUAL_ENVIRONMENT is required.");

  const normalizedExpected = String(expected).trim().toLowerCase();
  const normalizedActual = String(actual).trim().toLowerCase();

  if (!SUPPORTED_ENVIRONMENTS.includes(normalizedExpected)) {
    fail(
      "ENV_UNSUPPORTED",
      `EXPECTED_ENVIRONMENT must be one of ${SUPPORTED_ENVIRONMENTS.join(", ")}; received "${normalizedExpected}".`,
    );
  }
  if (normalizedExpected !== normalizedActual) {
    fail(
      "ENV_MISMATCH",
      `Environment identity mismatch: expected "${normalizedExpected}" but the run is configured as "${normalizedActual}".`,
    );
  }
  return normalizedExpected;
}

/**
 * Mutating evidence requires positive proof that the RC deployment does not
 * share Production's Supabase project. The operator supplies the RC project
 * ref; an absent, malformed, or production-matching ref fails closed.
 */
export function assertNonProductionDataPlane(supabaseRef) {
  if (typeof supabaseRef !== "string" || supabaseRef.trim() === "") {
    fail(
      "DATA_PLANE_UNPROVEN",
      "RC_SUPABASE_PROJECT_REF is required. Mutating beta evidence must prove the RC deployment does not share the production database.",
    );
  }
  const ref = supabaseRef.trim().toLowerCase();
  if (!/^[a-z0-9]{20}$/.test(ref)) {
    fail("DATA_PLANE_MALFORMED", "RC_SUPABASE_PROJECT_REF must be a 20-character Supabase project ref.");
  }
  if (ref === PRODUCTION_SUPABASE_REF) {
    fail(
      "DATA_PLANE_IS_PRODUCTION",
      "RC_SUPABASE_PROJECT_REF matches the production Supabase project. Refusing to create fixture data in production.",
    );
  }
  return ref;
}

/**
 * Deterministic resolution of the RC target from candidate sources, in
 * priority order. Ambiguity is an error rather than a guess.
 */
export function resolveRcBaseUrl(candidates) {
  const provided = (candidates ?? [])
    .filter((candidate) => candidate && typeof candidate.value === "string" && candidate.value.trim() !== "")
    .map((candidate) => ({ source: candidate.source, value: candidate.value.trim() }));

  if (provided.length === 0) {
    fail(
      "RC_URL_UNRESOLVED",
      "No RC base URL could be resolved from any configured source (workflow input, repository variable, or deployment metadata).",
    );
  }

  const distinct = [...new Set(provided.map((candidate) => candidate.value.replace(/\/+$/, "")))];
  if (distinct.length > 1) {
    fail(
      "RC_URL_AMBIGUOUS",
      `RC base URL resolution is ambiguous. Sources disagree: ${provided
        .map((candidate) => `${candidate.source}=${candidate.value}`)
        .join(", ")}.`,
    );
  }

  return { url: distinct[0], source: provided[0].source };
}

/**
 * Correlate the deployment actually under test with the commit it should have
 * been built from. Phase 44: never assume the deployment contains the SHA.
 */
export function assertDeploymentSha(expectedSha, actualSha) {
  if (!expectedSha) fail("SHA_EXPECTED_MISSING", "Expected commit SHA is required for deployment correlation.");
  if (!actualSha) {
    fail(
      "SHA_ACTUAL_MISSING",
      "The deployment did not report a commit SHA, so it cannot be correlated with the expected commit.",
    );
  }
  const expected = String(expectedSha).trim().toLowerCase();
  const actual = String(actualSha).trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(expected) || !/^[0-9a-f]{7,40}$/.test(actual)) {
    fail("SHA_MALFORMED", "Commit SHAs must be hexadecimal.");
  }
  const length = Math.min(expected.length, actual.length);
  if (expected.slice(0, length) !== actual.slice(0, length)) {
    fail(
      "SHA_MISMATCH",
      `Deployment SHA mismatch: expected ${expected} but the deployment reports ${actual}.`,
    );
  }
  return actual;
}
