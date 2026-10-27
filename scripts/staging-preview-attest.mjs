import { pathToFileURL } from "node:url";

export const STAGING_REF = "qfbgdkbamfaasmtjfyru";
export const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
export const STAGING_API_ORIGIN = "https://tradeos-costbook-git-staging-billykshowalters.vercel.app";

/**
 * Inspect only in-memory values injected by Vercel's branch-scoped Preview
 * environment. Return field names, never URLs, credentials or secret values.
 * This is an isolation preflight, not production or browser certification.
 */
export function attestStagingPreview(kind, env) {
  const errors = [];
  const fail = (name) => errors.push(name);
  if (env.VERCEL_ENV === "production") fail("VERCEL_ENV");
  if (kind === "api") {
    if (env.SUPABASE_URL !== STAGING_URL) fail("SUPABASE_URL");
    if (!env.AUTH_JWT_SECRET) fail("AUTH_JWT_SECRET");
    let db;
    try { db = new URL(env.DATABASE_URL); } catch { fail("DATABASE_URL"); }
    if (db) {
      let username = "";
      try { username = decodeURIComponent(db.username); } catch { fail("DATABASE_URL"); }
      const direct = db.hostname === `db.${STAGING_REF}.supabase.co`;
      const pooler = /(^|\.)pooler\.supabase\.com$/.test(db.hostname) &&
        username.endsWith(`.${STAGING_REF}`);
      if (!["postgres:", "postgresql:"].includes(db.protocol) || !(direct || pooler) || db.searchParams.has("host")) fail("DATABASE_URL");
    }
  } else if (kind === "web") {
    if (env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_URL) fail("NEXT_PUBLIC_SUPABASE_URL");
    if (env.SUPABASE_URL && env.SUPABASE_URL !== STAGING_URL) fail("SUPABASE_URL");
    if (env.TEAM_TIME_SUPABASE_PROJECT_REF && env.TEAM_TIME_SUPABASE_PROJECT_REF !== STAGING_REF) fail("TEAM_TIME_SUPABASE_PROJECT_REF");
    if (!env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY");
    let backend;
    try { backend = new URL(env.BACKEND_API_URL); } catch { fail("BACKEND_API_URL"); }
    if (backend && (backend.origin !== STAGING_API_ORIGIN || backend.username || backend.password ||
      (backend.pathname !== "/" && backend.pathname !== "") || backend.search || backend.hash)) fail("BACKEND_API_URL");
  } else {
    fail("target");
  }
  return [...new Set(errors)];
}

const calledAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (calledAsScript) {
  const kind = process.argv[2];
  const errors = attestStagingPreview(kind, process.env);
  if (errors.length) {
    console.error(`Staging Preview isolation NOT verified for ${kind === "web" ? "web" : "API"}: ${errors.join(", ")}. No secret values emitted.`);
    process.exitCode = 1;
  } else {
    console.log(`Staging Preview ${kind} bindings pass database/origin checks; secret-project provenance and authenticated acceptance remain separately required.`);
  }
}
