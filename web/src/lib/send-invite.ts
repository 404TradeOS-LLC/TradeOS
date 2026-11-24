import { clientFetch } from "./clientApi.ts";

/**
 * Roles the team-invite endpoint accepts (POST /api/v1/account/invites,
 * app/modules/auth/service.ts inviteTeamMember). Owner and admin roles are
 * never invited through this flow — the backend rejects anything outside
 * dispatcher/technician with 400.
 */
export const sendInviteRoles = ["technician", "dispatcher"] as const;
export type SendInviteRole = (typeof sendInviteRoles)[number];

export interface SendInviteInput {
  email: string;
  role: SendInviteRole;
}

export interface SendInviteResult {
  inviteId: string;
  email: string;
  role: string;
  /** ISO expiry returned by the backend (invites live 7 days). */
  expiresAt: string;
}

interface TeamInviteResponse {
  inviteId: string;
  email: string;
  role: string;
  expiresAt: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates the form input against the POST /api/v1/account/invites contract. Throws an Error with a user-facing message. */
export function validateSendInviteInput(input: SendInviteInput): { email: string; role: SendInviteRole } {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw new Error("Enter a valid work email address.");
  }
  if (!sendInviteRoles.includes(input.role)) {
    throw new Error("Choose a role: technician or dispatcher.");
  }
  return { email, role: input.role };
}

/**
 * Sends a team invite to a person with no TradeOS account yet, via the
 * owner-only invite endpoint (through the authenticated /api/proxy route).
 * The backend persists the invite and schedules the invitation email in the
 * background; the recipient accepts at /invite/accept and creates their
 * sign-in there. Only the invite id, email, role, and expiry are returned —
 * the server never hands the UI anything that could stand in for the
 * invitation link, so there is nothing here to leak, log, or display.
 * Server errors surface as ClientApiError carrying the backend message and
 * status.
 */
export async function submitSendInvite(input: SendInviteInput): Promise<SendInviteResult> {
  const payload = validateSendInviteInput(input);
  const invite = await clientFetch<TeamInviteResponse>("/api/v1/account/invites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    inviteId: invite.inviteId,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  };
}
