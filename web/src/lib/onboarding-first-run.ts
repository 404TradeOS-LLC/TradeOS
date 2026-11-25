import "server-only";

import { cookies } from "next/headers";
import { hasPermission } from "../../../app/domain/contracts";
import { getOnboardingState, getOrganizationSettings, listEstimateQueue, listProjects } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { ONBOARDING_SKIPPED_COOKIE, shouldRedirectToOnboarding } from "./onboarding";

/**
 * First-run gate for the dashboard bypass (DES-3 slices 1–2).
 *
 * Returns true only when the signed-in user can create estimates
 * (`crm.write`) in an organization with no projects and no draft/ready
 * estimates that has not skipped onboarding. Any failure — no session,
 * unreadable settings, or an uncountable queue — fails OPEN to the
 * dashboard: onboarding must never block sign-in.
 *
 * The skip is org-scoped (DES-3 slice 2): the persisted onboarding-state
 * record. The slice-1 browser cookie is kept as a legacy fallback read
 * only — an org that skipped before slice 2 must not be re-prompted —
 * but nothing sets it anymore.
 *
 * Once onboarding completes, the created draft estimate makes the org
 * non-empty, so the redirect clears itself without stored state.
 */
export async function isFirstRunRedirectNeeded(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get(ONBOARDING_SKIPPED_COOKIE)?.value === "1") return false;

  const token = await getSessionToken();
  if (!token) return false;

  try {
    const [settings, projects, estimates, onboarding] = await Promise.all([
      getOrganizationSettings(token),
      listProjects(token, { limit: 1 }),
      listEstimateQueue(token, { status: "draft,ready", limit: 1 }),
      // A failed state read must not block the bypass: treat it as
      // "not skipped" and let the project/estimate counts decide.
      getOnboardingState(token).catch(() => ({ state: null })),
    ]);
    if (!hasPermission(settings.currentRole, "crm.write")) return false;
    return shouldRedirectToOnboarding({
      projectCount: projects.length,
      estimateCount: estimates.total,
      skipped: false,
      persistedSkipped: onboarding.state?.status === "skipped",
    });
  } catch {
    return false;
  }
}
