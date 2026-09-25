export const TEAM_TIME_STAGING_PROJECT_REF = "qfbgdkbamfaasmtjfyru";

export function isTeamTimeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.TEAM_TIME_ENABLED !== "true" || env.VERCEL_ENV === "production") return false;

  const expectedProjectRef = env.TEAM_TIME_SUPABASE_PROJECT_REF?.trim();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (expectedProjectRef !== TEAM_TIME_STAGING_PROJECT_REF || !supabaseUrl) return false;

  try {
    return new URL(supabaseUrl).hostname === `${TEAM_TIME_STAGING_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}
