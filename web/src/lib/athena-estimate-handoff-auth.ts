import "server-only";

import { getOrganizationSettings } from "@/lib/api";
import { getSession, getSessionToken } from "@/lib/session";
import { canUseUniversalCreate } from "@/lib/universal-create-access";
import { buildAthenaEstimateIdentity } from "@/lib/athena-estimate-handoff";

interface EstimateHandoffAuth {
  identity: string | null;
  canCreateEstimate: boolean;
}

/**
 * UI presentation only. Re-resolve the currently authenticated identity on
 * each route: never trust a user/organization identifier from browser storage.
 * The Project and Estimate API remain the actual write authorization.
 */
export async function getAthenaEstimateHandoffAuth(): Promise<EstimateHandoffAuth> {
  const [session, token] = await Promise.all([getSession(), getSessionToken()]);
  if (!session?.sub || !token) return { identity: null, canCreateEstimate: false };

  try {
    const settings = await getOrganizationSettings(token);
    const identity = buildAthenaEstimateIdentity(session.sub, settings.orgId);
    return {
      identity,
      canCreateEstimate: Boolean(identity) && canUseUniversalCreate("estimate", settings.currentRole, false),
    };
  } catch {
    // Avoid creating a cross-session prefill if authenticated settings cannot
    // establish the current organization and role.
    return { identity: null, canCreateEstimate: false };
  }
}
