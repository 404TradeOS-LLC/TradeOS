const SUPABASE_POOLER_SUFFIX = ".pooler.supabase.com";

/**
 * Keep serverless Prisma instances on Supabase's transaction pooler.
 *
 * This is intentionally limited to Vercel and Supabase pooler hosts. Local,
 * self-hosted, direct Supabase, and test database URLs retain their configured
 * behavior. The URL is never logged or included in an error.
 */
export function resolveRuntimeDatabaseUrl(
  rawUrl: string | undefined,
  isVercel = process.env.VERCEL === "1",
): string | undefined {
  if (!rawUrl || !isVercel) return rawUrl;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    // Preserve Prisma's existing configuration error for malformed URLs.
    return rawUrl;
  }

  if (!url.hostname.endsWith(SUPABASE_POOLER_SUFFIX)) return rawUrl;

  if (url.port === "5432") url.port = "6543";
  if (url.port !== "6543") return rawUrl;

  url.searchParams.set("pgbouncer", "true");
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslaccept", "strict");
  return url.toString();
}
