/**
 * Resolve the workspace key that remounts the (app) shell subtree.
 *
 * The key must change exactly when the active workspace changes, and it must
 * not depend on a network lookup that can time out: the settings identity
 * lookup fails closed to null after 1.5s, which left the key stuck on
 * "unknown" across a switch and let tenant-owned client state (for example a
 * Settings draft) survive into the next workspace.
 *
 * The session token is the reliable identity source. Every session the
 * backend issues — login, bootstrap, and select-organization — signs the
 * active orgId into the token, and a workspace switch replaces the token
 * atomically before the page refreshes, so the token claim changes exactly
 * when the workspace does. The settings lookup stays as the fallback for
 * sessions whose token carries no org claim (for example a bare Supabase
 * JWT), preserving the previous behavior on that path.
 */
export function resolveWorkspaceKey(input: {
  tokenOrgId?: string | null;
  settingsOrgId?: string | null;
}): string {
  return input.tokenOrgId || input.settingsOrgId || "unknown";
}
