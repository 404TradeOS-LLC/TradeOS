export function isTeamTimeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TEAM_TIME_ENABLED === "true" && env.VERCEL_ENV !== "production";
}
