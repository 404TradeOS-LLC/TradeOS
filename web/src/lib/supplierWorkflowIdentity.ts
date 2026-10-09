import type { OrganizationSettingsResponse } from "./settings";

/**
 * Expose the two GitHub supplier-import workflow inputs only for the signed-in,
 * active owner/admin. Data comes from the authenticated Settings response; it is
 * not inferred from database table estimates or the Supabase auth subject.
 */
export function resolveSupplierWorkflowIdentity(
  settings: OrganizationSettingsResponse | null,
  sessionEmail: string | null | undefined,
): { orgId: string; userId: string } | null {
  if (!settings?.canManageWorkspace || !["owner", "admin"].includes(settings.currentRole)) return null;
  const email = sessionEmail?.trim().toLowerCase();
  if (!email) return null;

  const matches = settings.teamMembers.filter(
    (member) =>
      member.email.trim().toLowerCase() === email &&
      member.status === "active" &&
      ["owner", "admin"].includes(member.role),
  );
  // No guessing in the presence of missing or ambiguous identities.
  if (matches.length !== 1) return null;

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(settings.orgId) || !uuid.test(matches[0].userId)) return null;

  return { orgId: settings.orgId, userId: matches[0].userId };
}
