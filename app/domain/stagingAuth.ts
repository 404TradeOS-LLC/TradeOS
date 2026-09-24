/** Public fixture identifiers, never credentials. The database owns authorization. */
export const STAGING_AUTH = {
  marker: "tradeos-staging-fixture-v1",
  subject: "staging-owner",
  userId: "70000000-0000-4000-8000-000000000001",
  orgId: "70000000-0000-4000-8000-000000000002",
  projectId: "70000000-0000-4000-8000-000000000003",
  estimateId: "70000000-0000-4000-8000-000000000004",
  email: "staging-owner@tradeos.local",
  supabaseRef: "qfbgdkbamfaasmtjfyru",
} as const;

export interface StagingAuthEnvironment {
  TRADEOS_AUTH_BYPASS?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  APP_ENVIRONMENT?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  DATABASE_URL?: string;
}

export interface StagingAuthDecision {
  enabled: boolean;
  blocked: boolean;
  reason?: string;
}

function databaseProjectRef(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const hostMatch = /^db\.([a-z0-9]{20})\.supabase\.(?:co|com)$/.exec(url.hostname.toLowerCase());
    if (hostMatch) return hostMatch[1];
    if (!/\.pooler\.supabase\.(?:co|com)$/.test(url.hostname.toLowerCase())) return null;
    return /(?:^|\.)([a-z0-9]{20})$/.exec(decodeURIComponent(url.username).toLowerCase())?.[1] ?? null;
  } catch { return null; }
}

function supabaseProjectRef(raw?: string): string | null {
  if (!raw) return null;
  try { return /^([a-z0-9]{20})\.supabase\.(?:co|com)$/.exec(new URL(raw).hostname.toLowerCase())?.[1] ?? null; }
  catch { return null; }
}

/** A Preview is explicitly allowed although Next.js sets NODE_ENV=production there. */
export function evaluateStagingAuth(env: StagingAuthEnvironment, layer: "web" | "api"): StagingAuthDecision {
  if (env.TRADEOS_AUTH_BYPASS !== "true") return { enabled: false, blocked: false };
  const deny = (reason: string): StagingAuthDecision => ({ enabled: false, blocked: true, reason });
  if (env.VERCEL_ENV === "production") return deny("Vercel Production cannot enable auth bypass");
  if (env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview") return deny("Production runtime cannot enable auth bypass");
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "preview") return deny("Only Vercel Preview can enable auth bypass");
  if (!env.VERCEL_ENV && env.APP_ENVIRONMENT !== "staging") return deny("Local bypass requires APP_ENVIRONMENT=staging");
  const supabaseRef = supabaseProjectRef(layer === "web" ? env.NEXT_PUBLIC_SUPABASE_URL : env.SUPABASE_URL);
  if (supabaseRef !== STAGING_AUTH.supabaseRef) return deny("Supabase URL is not the dedicated staging project");
  if (layer === "api" && databaseProjectRef(env.DATABASE_URL) !== STAGING_AUTH.supabaseRef) {
    return deny("Database URL is not the dedicated staging project");
  }
  return { enabled: true, blocked: false };
}
