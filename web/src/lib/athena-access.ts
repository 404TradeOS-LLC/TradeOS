import "server-only";
import { ApiClientError, getOrganizationSettings } from "./api";
import { getSessionToken } from "./session";
import { isAthenaOperatorRole, type AthenaAccessState } from "./athena-state";

export type { AthenaDisplayState, AthenaAccessState, AthenaLoadOutcome } from "./athena-state";
export { isAthenaOperatorRole, describeAthenaLoadError } from "./athena-state";

// A10 operator gating. Athena observability surfaces cost, traces, and error
// detail across the whole organization - the backend's
// requireObservabilityAccess() (app/backend/controllers/athenaObservability.controller.ts)
// restricts every route to roles "owner"/"admin" (deliberately narrower than
// requireOrgAdmin(), which also admits "dispatcher"). The gate below mirrors
// that exact restriction using the exact mechanism the Settings page already
// relies on for role-aware rendering: getOrganizationSettings's
// `currentRole` field (web/src/app/(app)/settings/page.tsx reads
// `persisted.currentRole` the same way). There is no other role source in
// this codebase to reuse, and this is not a new auth mechanism - it is the
// same settings call, read for its role field instead of its settings draft.

export type AthenaOperatorContext = { granted: true; token: string; currentRole: string } | { granted: false; state: AthenaAccessState };

/**
 * Resolves whether the current session may view Athena observability.
 * Every Athena page calls this first, before making any observability
 * fetch, so a non-operator never even reaches the backend's 403.
 */
export async function getAthenaOperatorContext(): Promise<AthenaOperatorContext> {
  const token = await getSessionToken();
  if (!token) return { granted: false, state: { kind: "signed_out" } };

  try {
    const settings = await getOrganizationSettings(token);
    if (!isAthenaOperatorRole(settings.currentRole)) {
      return { granted: false, state: { kind: "denied", currentRole: settings.currentRole } };
    }
    return { granted: true, token, currentRole: settings.currentRole };
  } catch (error) {
    const message = error instanceof ApiClientError ? error.message : "Unable to verify your access to Athena observability.";
    return { granted: false, state: { kind: "error", message } };
  }
}
