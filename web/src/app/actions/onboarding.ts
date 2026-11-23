"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, type Estimate } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import {
  ONBOARDING_SKIPPED_COOKIE,
  ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS,
  deriveProjectNameFromScope,
  validateOnboardingInput,
} from "@/lib/onboarding";
import type { FormActionState } from "./customers";

/**
 * First-estimate onboarding completion (DES-3 slice 1).
 *
 * Signup → login → dashboard is untouched: the dashboard sends a brand-new
 * org here, and this action takes it to a draft estimate instead of the
 * empty Today view.
 *
 * 1. Create the Project from the scope text (name derived from the scope;
 *    first selected work type as `jobType`; scope persisted as
 *    `simpleScope`, the same field the estimate workspace reads).
 * 2. Create a draft Estimate on that Project.
 * 3. Stage the Athena structured draft (`POST
 *    /api/v1/estimates/:id/ai-estimator/draft` with the scope text). The
 *    draft is review-only — nothing reaches the estimate until the
 *    contractor accepts lines in Athena review — and the generation is
 *    recorded as an Athena generation + `estimate.ai_estimator_draft_generated`
 *    activity event.
 * 4. Land on the draft estimate workspace, where the existing Athena
 *    review button continues Items → Price → Review.
 *
 * Failure semantics (mirrors `createProjectAction` with intent=estimate):
 * a project that fails to save returns an inline error; an estimate that
 * fails after the project saved redirects to the project instead of
 * retrying the create (a retry would duplicate the project, and the
 * estimate POST may have committed despite the error). A failed Athena
 * draft generation never loses the saved project + estimate — the
 * workspace's Athena review regenerates the same draft on demand.
 */
export async function completeFirstEstimateOnboarding(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const token = await getSessionToken();
  if (!token) return { error: "Sign in before building your first estimate." };

  const { value, error } = validateOnboardingInput({
    workTypes: formData.getAll("workTypes"),
    scopeText: formData.get("scopeText"),
  });
  if (!value) return { error: error ?? "Check the onboarding answers and try again." };

  const projectName = deriveProjectNameFromScope(value.scopeText);

  let projectId = "";
  try {
    const project = await apiFetch<{ id: string }>("/api/v1/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: projectName,
        jobType: value.workTypes[0],
        simpleScope: value.scopeText,
      }),
    });
    projectId = project.id;
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  let estimate: Estimate;
  try {
    estimate = await apiFetch<Estimate>("/api/v1/estimates", {
      method: "POST",
      token,
      body: JSON.stringify({ projectId }),
    });
  } catch {
    // The Project is already saved. A retry of this form would create a
    // duplicate, and the Estimate POST may have committed despite the error.
    redirect(`/projects/${projectId}?estimateStart=review`);
  }

  try {
    await apiFetch(`/api/v1/estimates/${estimate.id}/ai-estimator/draft`, {
      method: "POST",
      token,
      body: JSON.stringify({ scopeOfWork: value.scopeText }),
    });
  } catch (err) {
    console.error(
      "completeFirstEstimateOnboarding: Athena draft staging failed; the estimate workspace can regenerate it",
      err,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/estimates/${estimate.id}`);
}

/**
 * Skip onboarding for this browser. Completion needs no cookie — the
 * created draft estimate makes the org non-empty and clears the dashboard
 * bypass by itself. A skip is browser-scoped (not org-scoped) until
 * persisted onboarding state lands; see `web/src/lib/onboarding.ts`.
 */
export async function skipFirstEstimateOnboarding(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_SKIPPED_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS,
  });
  redirect("/dashboard");
}
