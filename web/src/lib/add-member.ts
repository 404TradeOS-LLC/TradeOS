import { clientFetch } from "./clientApi.ts";
import type { SettingsTeamMember } from "./settings.ts";

/** Roles the admin member endpoint accepts (app/modules/admin-dashboard/types.ts). */
export const addMemberRoles = ["owner", "admin", "dispatcher", "technician"] as const;
export type AddMemberRole = (typeof addMemberRoles)[number];

export interface AddMemberInput {
  email: string;
  fullName?: string;
  /**
   * Authentication subject of the person being attached — the Supabase Auth
   * user UUID, or `local:<uuid>` for a local-auth account. This is the value
   * `upsertOrganizationMember()` looks the user up by; the application user
   * UUID shown under Supplier workflow IDs is a different identifier and
   * must not be pasted here. The person finds their sign-in ID on their own
   * Settings page under Team & Access → Your TradeOS sign-in ID.
   */
  authSubject: string;
  role: AddMemberRole;
}

interface OrganizationMemberResponse {
  membershipId: string;
  userId: string;
  authSubject: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Local-auth accounts carry `local:<uuid>` subjects (app/modules/auth/service.ts). */
const LOCAL_AUTH_SUBJECT_PATTERN =
  /^local:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a pasted value is a real authentication subject: a Supabase Auth
 * user UUID, or a `local:<uuid>` subject for a local-auth account. The
 * application user UUID (AppUser.id) is also a UUID by shape and cannot be
 * told apart here — the Settings page must show the sign-in ID, not the
 * application user ID, so the owner pastes the right one.
 */
export function isAuthSubject(value: string): boolean {
  const subject = value.trim();
  return UUID_PATTERN.test(subject) || LOCAL_AUTH_SUBJECT_PATTERN.test(subject);
}

/**
 * Roles the signed-in user may grant. The backend rejects owner grants from
 * non-owners with 403 ("Only owners can assign owner memberships"), so the
 * option is never offered to them.
 */
export function addMemberRoleOptions(currentRole: string): AddMemberRole[] {
  if (currentRole === "owner") return [...addMemberRoles];
  return addMemberRoles.filter((role) => role !== "owner");
}

/** Validates the form input against the POST /organizations/:id/members contract. Throws an Error with a user-facing message. */
export function validateAddMemberInput(input: AddMemberInput): {
  email: string;
  fullName?: string;
  authSubject: string;
  role: AddMemberRole;
} {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw new Error("Enter a valid work email address.");
  }
  const authSubject = input.authSubject.trim();
  if (!isAuthSubject(authSubject)) {
    throw new Error("Enter the person's TradeOS sign-in ID (shown on their Settings page under Team & Access → Your TradeOS sign-in ID).");
  }
  const fullName = input.fullName?.trim();
  if (fullName !== undefined && fullName.length > 160) {
    throw new Error("Full name must be 160 characters or fewer.");
  }
  if (!addMemberRoles.includes(input.role)) {
    throw new Error("Choose a role: owner, admin, dispatcher, or technician.");
  }
  return { email, ...(fullName ? { fullName } : {}), authSubject, role: input.role };
}

/**
 * Attaches an existing TradeOS auth user to the organization via the admin
 * member endpoint (through the authenticated /api/proxy route). This does not
 * create a sign-in and does not send an email invite — the person must
 * already have a TradeOS account. Server errors surface as ClientApiError
 * carrying the backend message and status.
 */
export async function submitAddMember(orgId: string, input: AddMemberInput): Promise<SettingsTeamMember> {
  const payload = validateAddMemberInput(input);
  const member = await clientFetch<OrganizationMemberResponse>(`/api/v1/admin/organizations/${orgId}/members`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    membershipId: member.membershipId,
    userId: member.userId,
    fullName: member.fullName,
    email: member.email,
    role: member.role,
    status: member.status,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}
