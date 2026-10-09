import type { OrganizationSettingsResponse } from "./settings";

/**
 * Show the two supplier-seed IDs only when the authenticated backend user ID
 * resolves to one active owner/admin membership in the same Settings response.
 * Email and membership IDs are not reliable substitutes for AppUser.id.
 */
export function resolveSupplierWorkflowIdentity(
  settings: OrganizationSettingsResponse | null,
): { orgId: string; userId: string } | null {
  if (!settings?.canManageWorkspace || !["owner", "admin"].includes(settings.currentRole)) return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const actorUserId = settings.currentUserId;
  if (!actorUserId || !uuid.test(settings.orgId) || !uuid.test(actorUserId)) return null;

  const matches = settings.teamMembers.filter(
    (member) =>
      member.userId === actorUserId &&
      member.status === "active" &&
      ["owner", "admin"].includes(member.role),
  );
  if (matches.length !== 1) return null;

  return { orgId: settings.orgId, userId: actorUserId };
}
