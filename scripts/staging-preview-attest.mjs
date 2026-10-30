import { pathToFileURL } from "node:url";

export const STAGING_REF = "qfbgdkbamfaasmtjfyru";
export const PROD_REF = "kssaceuetdjwfqnbzhly";
export const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
export const STAGING_API_ORIGIN = "https://tradeos-costbook-git-staging-billykshowalters.vercel.app";
export const STAGING_WEB_ORIGIN = "https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app";

/**
 * Staging Preview isolation attestation.
 *
 * Vercel never exposes sensitive environment values through the CLI or API,
 * so `vercel env run` withholds SUPABASE_URL, AUTH_JWT_SECRET, DATABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY. Those fields therefore arrive missing even
 * when they are correctly set. This script never works around that rule: it
 * does not downgrade sensitivity, print values, or fetch secret metadata.
 *
 * Instead it distinguishes two failure kinds for injected values:
 * - "mismatch": a value is present and wrong. Always a failure. Runtime
 *   evidence never excuses a wrong value, because the next deployment would
 *   use it.
 * - "missing": a value was withheld. Excused only when the live staging
 *   deployment proves the effective binding at runtime (the staging web
 *   alias serves its pages and the staging API alias answers healthy and
 *   ready). Excused fields are reported as runtime-inferred, never as
 *   env-verified, so the distinction stays visible to reviewers. Only the
 *   sensitive service-role key is excusable this way: the public Supabase
 *   URL and backend origin are non-sensitive, so their absence from the
 *   pull means they are unset, which stays a failure.
 *
 * Runtime evidence proves the deployment serves and the API is healthy.
 * Full tenant proof remains the separate authenticated evidence gate
 * (staging smoke sign-in plus org assertion, which fails if the web
 * server key belonged to another project); this script does not claim it.
 * Output carries field names only, never URLs, credentials,
 * secret values, or fetched content.
 */

function detail(field, reason) {
  return { field, reason };
}

export function attestEnvDetail(kind, env) {
  const errors = [];
  const fail = (field, reason) => errors.push(detail(field, reason));
  if (env.VERCEL_ENV === "production") fail("VERCEL_ENV", "mismatch");
  if (kind === "api") {
    if (!env.SUPABASE_URL) fail("SUPABASE_URL", "missing");
    else if (env.SUPABASE_URL !== STAGING_URL) fail("SUPABASE_URL", "mismatch");
    if (!env.AUTH_JWT_SECRET) fail("AUTH_JWT_SECRET", "missing");
    if (!env.DATABASE_URL) fail("DATABASE_URL", "missing");
    else {
      let db;
      try { db = new URL(env.DATABASE_URL); } catch { fail("DATABASE_URL", "missing"); }
      if (db) {
        let username = "";
        try { username = decodeURIComponent(db.username); } catch { fail("DATABASE_URL", "missing"); }
        const direct = db.hostname === `db.${STAGING_REF}.supabase.co`;
        const pooler = /(^|\.)pooler\.supabase\.com$/.test(db.hostname) &&
          username.endsWith(`.${STAGING_REF}`);
        if (!["postgres:", "postgresql:"].includes(db.protocol) || !(direct || pooler) || db.searchParams.has("host")) {
          fail("DATABASE_URL", "mismatch");
        }
      }
    }
  } else if (kind === "web") {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL", "missing");
    else if (env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_URL) fail("NEXT_PUBLIC_SUPABASE_URL", "mismatch");
    if (env.SUPABASE_URL && env.SUPABASE_URL !== STAGING_URL) fail("SUPABASE_URL", "mismatch");
    if (env.TEAM_TIME_SUPABASE_PROJECT_REF && env.TEAM_TIME_SUPABASE_PROJECT_REF !== STAGING_REF) {
      fail("TEAM_TIME_SUPABASE_PROJECT_REF", "mismatch");
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY", "missing");
    if (!env.BACKEND_API_URL) fail("BACKEND_API_URL", "missing");
    else {
      let backend;
      try { backend = new URL(env.BACKEND_API_URL); } catch { fail("BACKEND_API_URL", "missing"); }
      if (backend && (backend.origin !== STAGING_API_ORIGIN || backend.username || backend.password ||
        (backend.pathname !== "/" && backend.pathname !== "") || backend.search || backend.hash)) {
        fail("BACKEND_API_URL", "mismatch");
      }
    }
  } else {
    fail("target", "mismatch");
  }
  return errors;
}

/**
 * Inspect only in-memory values injected by Vercel's branch-scoped Preview
 * environment. Return field names, never URLs, credentials or secret values.
 * This is an isolation preflight, not production or browser certification.
 */
export function attestStagingPreview(kind, env) {
  return [...new Set(attestEnvDetail(kind, env).map((d) => d.field))];
}

// Fields whose absence may be excused by healthy runtime evidence. Only the
// sensitive service-role key qualifies: the public Supabase URL and backend
// origin are non-sensitive, so absence from the pull means they are unset.
// BACKEND_API_URL is not excusable either: it is non-sensitive, so absence
// from the pull means it is unset, and no runtime fetch observes its value.
const RUNTIME_EXCUSABLE = {
  api: new Set(["SUPABASE_URL", "AUTH_JWT_SECRET", "DATABASE_URL"]),
  web: new Set(["SUPABASE_SERVICE_ROLE_KEY"]),
};

async function fetchJson(fetchImpl, url) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

export async function attestStagingRuntime(kind, fetchImpl = globalThis.fetch) {
  const errors = [];
  try {
    const health = await fetchJson(fetchImpl, `${STAGING_API_ORIGIN}/health`);
    if (health?.status !== "ok") errors.push("API_HEALTH");
  } catch {
    errors.push("API_HEALTH");
  }
  try {
    const ready = await fetchJson(fetchImpl, `${STAGING_API_ORIGIN}/ready`);
    if (ready?.status !== "ready" || ready?.checks?.database?.status !== "ok") errors.push("API_READINESS");
  } catch {
    errors.push("API_READINESS");
  }
  if (kind === "web") {
    // The Supabase client loads lazily, so bundle contents are not a reliable
    // binding signal. Serving plus healthy API is the runtime signal; the
    // authenticated evidence gate separately proves the server key's tenant.
    try {
      const home = await fetchImpl(`${STAGING_WEB_ORIGIN}/`, { signal: AbortSignal.timeout(15000) });
      if (!home.ok) throw new Error(`fetch failed: ${home.status}`);
      const login = await fetchImpl(`${STAGING_WEB_ORIGIN}/login`, { signal: AbortSignal.timeout(15000) });
      if (!login.ok) throw new Error(`fetch failed: ${login.status}`);
    } catch {
      errors.push("WEB_SERVING");
    }
  }
  return [...new Set(errors)];
}

export async function attestWithRuntime(kind, env, fetchImpl = globalThis.fetch) {
  const details = attestEnvDetail(kind, env);
  const mismatches = details.filter((d) => d.reason === "mismatch").map((d) => d.field);
  const missing = details.filter((d) => d.reason === "missing");
  const runtimeErrors = await attestStagingRuntime(kind, fetchImpl);
  const excusable = RUNTIME_EXCUSABLE[kind] ?? new Set();
  const runtimeInferred = [];
  const unexcused = [];
  for (const d of missing) {
    if (runtimeErrors.length === 0 && excusable.has(d.field)) runtimeInferred.push(d.field);
    else unexcused.push(d.field);
  }
  const errors = [...new Set([...mismatches, ...unexcused, ...runtimeErrors])];
  const envVerified = [];
  if (kind === "api") {
    for (const field of ["SUPABASE_URL", "AUTH_JWT_SECRET", "DATABASE_URL"]) {
      if (!details.some((d) => d.field === field)) envVerified.push(field);
    }
  } else if (kind === "web") {
    for (const field of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "TEAM_TIME_SUPABASE_PROJECT_REF", "SUPABASE_SERVICE_ROLE_KEY", "BACKEND_API_URL"]) {
      if (!details.some((d) => d.field === field)) envVerified.push(field);
    }
  }
  return { errors, envVerified, runtimeInferred };
}

const calledAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (calledAsScript) {
  const kind = process.argv[2];
  const { errors, envVerified, runtimeInferred } = await attestWithRuntime(kind, process.env);
  if (errors.length) {
    console.error(`Staging Preview isolation NOT verified for ${kind === "web" ? "web" : "API"}: ${errors.join(", ")}. No secret values emitted.`);
    process.exitCode = 1;
  } else {
    console.log(`Staging Preview ${kind} bindings pass database/origin checks; env-verified: ${envVerified.join(", ") || "none"}; runtime-inferred: ${runtimeInferred.join(", ") || "none"}; secret-project provenance and authenticated acceptance remain separately required.`);
  }
}
