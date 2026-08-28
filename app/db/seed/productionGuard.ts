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

function hostnameOf(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
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
    const hostname = hostnameOf(databaseUrl);
    if (hostname === null) {
      reasons.push("DATABASE_URL could not be parsed, so the target database cannot be identified.");
    } else if (PRODUCTION_HOST_FRAGMENTS.some((fragment) => hostname.includes(fragment))) {
      // Never echo the URL itself — it carries credentials.
      reasons.push("DATABASE_URL points at a known production database host.");
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
