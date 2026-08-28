// Fail-closed guard for destructive fixture provisioning.
//
// db/seed/seed.ts issues 21 `deleteMany` calls and writes password-bearing
// identities. Every other destructive path in this repository (the RC smoke
// scripts) is gated by layered environment + hostname checks; this module gives
// the database path the same treatment.
//
// The guard is deliberately paranoid: an unset or unrecognised environment is
// treated as production, because the failure mode of guessing wrong is writing
// fixture data into a real tenant's database.

export interface SeedGuardEnvironment {
  DATABASE_URL?: string | undefined;
  NODE_ENV?: string | undefined;
  APP_ENVIRONMENT?: string | undefined;
  VERCEL_ENV?: string | undefined;
}

export interface SeedGuardResult {
  allowed: boolean;
  reasons: string[];
}

/** Supabase project ref that backs Production. */
export const PRODUCTION_SUPABASE_REF = "kssaceuetdjwfqnbzhly";

/** Hostname fragments that identify a production database endpoint. */
const PRODUCTION_HOST_FRAGMENTS = [PRODUCTION_SUPABASE_REF, "api.404tradeos.com", "app.404tradeos.com"];

const PRODUCTION_ENVIRONMENT_NAMES = new Set(["production", "prod"]);

function parseDatabaseUrl(databaseUrl: string): URL | null {
  try {
    return new URL(databaseUrl);
  } catch {
    return null;
  }
}

function isSupabaseManagedHost(hostname: string): boolean {
  return hostname === "supabase.co" || hostname === "supabase.com" ||
    hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
}

/**
 * Recover the Supabase project ref from a connection URL.
 *
 * Direct connections carry it in the hostname (`db.<ref>.supabase.co`), but
 * pooler connections do not — there the host is a shared regional endpoint
 * (`aws-0-<region>.pooler.supabase.com`) and the ref lives in the username
 * (`postgres.<ref>`). Checking only the hostname therefore misses production
 * entirely whenever the pooler form is used.
 *
 * Returns null when the ref cannot be determined.
 */
export function extractSupabaseProjectRef(url: URL): string | null {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  const hostMatch = /^(?:db\.)?([a-z0-9]{20})\.supabase\.(?:co|com)$/.exec(hostname);
  if (hostMatch) return hostMatch[1];

  // Pooler form: the username is `postgres.<ref>` (or occasionally just `<ref>`).
  const username = decodeURIComponent(url.username || "").toLowerCase();
  const userMatch = /(?:^|\.)([a-z0-9]{20})$/.exec(username);
  if (userMatch) return userMatch[1];

  return null;
}

/**
 * Decide whether destructive seeding may proceed.
 *
 * Returns every reason it was refused rather than the first, so an operator
 * fixes the whole configuration in one pass.
 */
export function evaluateSeedGuard(env: SeedGuardEnvironment): SeedGuardResult {
  const reasons: string[] = [];

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    reasons.push("DATABASE_URL is not set, so the target database cannot be identified.");
  } else {
    const parsed = parseDatabaseUrl(databaseUrl);
    if (parsed === null) {
      reasons.push("DATABASE_URL could not be parsed, so the target database cannot be identified.");
    } else {
      const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
      // Never echo the URL itself — it carries credentials.
      if (PRODUCTION_HOST_FRAGMENTS.some((fragment) => hostname.includes(fragment))) {
        reasons.push("DATABASE_URL points at a known production database host.");
      }

      const projectRef = extractSupabaseProjectRef(parsed);
      if (projectRef === PRODUCTION_SUPABASE_REF) {
        reasons.push("DATABASE_URL resolves to the production Supabase project.");
      } else if (projectRef === null && isSupabaseManagedHost(hostname)) {
        // A Supabase-managed endpoint whose project cannot be identified is
        // treated as production: the pooler form hides the ref in the
        // username, so "not obviously production" is not good enough here.
        reasons.push(
          "DATABASE_URL points at a Supabase-managed host whose project ref could not be determined, so it cannot be proven non-production.",
        );
      }
    }
  }

  for (const [name, value] of [
    ["NODE_ENV", env.NODE_ENV],
    ["APP_ENVIRONMENT", env.APP_ENVIRONMENT],
    ["VERCEL_ENV", env.VERCEL_ENV],
  ] as const) {
    const normalized = value?.trim().toLowerCase();
    if (normalized && PRODUCTION_ENVIRONMENT_NAMES.has(normalized)) {
      reasons.push(`${name} is "${normalized}".`);
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Throw unless destructive seeding is safe.
 *
 * There is intentionally no `--force` escape hatch: the only supported way to
 * seed a production-shaped target is to stop pointing DATABASE_URL at it.
 */
export function assertSeedTargetIsNotProduction(env: SeedGuardEnvironment = process.env): void {
  const { allowed, reasons } = evaluateSeedGuard(env);
  if (allowed) return;

  const detail = reasons.map((reason) => `  - ${reason}`).join("\n");
  throw new Error(
    "Refusing to run destructive seed against a production target.\n" +
      `${detail}\n` +
      "This seed deletes and recreates organization data. Point DATABASE_URL at a " +
      "non-production database (a local instance, a Supabase branch, or a dedicated " +
      "staging project) and run it again. There is no override flag."
  );
}
