export function isTeamTimeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.TEAM_TIME_ENABLED !== "true" || env.VERCEL_ENV === "production") return false;

  const expectedProjectRef = env.TEAM_TIME_SUPABASE_PROJECT_REF?.trim();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!expectedProjectRef || !supabaseUrl || !/^[a-z0-9]{20}$/.test(expectedProjectRef)) return false;

  try {
    return new URL(supabaseUrl).hostname === `${expectedProjectRef}.supabase.co`;
  } catch {
    return false;
  }
}
