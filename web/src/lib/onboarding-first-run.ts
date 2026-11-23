import "server-only";

import { cookies } from "next/headers";
import { hasPermission } from "../../../app/domain/contracts";
import { getOrganizationSettings, listEstimateQueue, listProjects } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { ONBOARDING_SKIPPED_COOKIE, shouldRedirectToOnboarding } from "./onboarding";

/**
 * First-run gate for the dashboard bypass (DES-3 slice 1).
 *
 * Returns true only when the signed-in user can create estimates
 * (`crm.write`) in an organization with no projects and no draft/ready
 * estimates that has not skipped onboarding. Any failure — no session,
 * unreadable settings, or an uncountable queue — fails OPEN to the
 * dashboard: onboarding must never block sign-in.
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
    const [settings, projects, estimates] = await Promise.all([
      getOrganizationSettings(token),
      listProjects(token, { limit: 1 }),
      listEstimateQueue(token, { status: "draft,ready", limit: 1 }),
    ]);
    if (!hasPermission(settings.currentRole, "crm.write")) return false;
    return shouldRedirectToOnboarding({
      projectCount: projects.length,
      estimateCount: estimates.total,
      skipped: false,
    });
  } catch {
    return false;
  }
}
