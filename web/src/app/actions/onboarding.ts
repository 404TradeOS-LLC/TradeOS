"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  apiFetch,
  ApiClientError,
  completeOnboarding,
  saveOnboardingProgress,
  skipOnboarding,
  type Estimate,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import {
  deriveProjectNameFromScope,
  MAX_SCOPE_TEXT_LENGTH,
  ONBOARDING_SKIPPED_COOKIE,
  ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS,
  ONBOARDING_WORK_TYPES,
  parseLaborRateDollars,
  validateOnboardingInput,
} from "@/lib/onboarding";
import type { FormActionState } from "./customers";

/**
 * First-estimate onboarding completion (DES-3 slices 1–2).
 *
 * Signup → login → dashboard is untouched: the dashboard sends a brand-new
 * org here, and this action takes it to a draft estimate instead of the
 * empty Today view.
 *
 * 1. Create the Project from the scope text (name derived from the scope;
 *    first selected work type as `jobType`; scope persisted as
 *    `simpleScope`, the same field the estimate workspace reads).
 * 2. Create a draft Estimate on that Project.
 * 3. Persist the wizard's answers (work types, scope, labor baseline,
 *    region) on the org's onboarding-state record and mark it completed
 *    (best-effort: a persistence failure never blocks the redirect — the
 *    created draft estimate is itself the completion record).
 * 4. Land on the Athena review route for the draft estimate, with
 *    `?autoReview=1` so the review runs on landing (DES-3 slice 3).
 *    Athena review generates the structured draft on demand from the
 *    persisted scope — no draft is staged here:
 *    `StructuredAIEstimatorService.generateDraft` persists only
 *    generation metadata, not retrievable line items, and there is no
 *    endpoint to fetch a staged draft, so a fire-and-forget generation
 *    here would discard its result. Draft persistence + hydration is a
 *    follow-up slice (storage + GET + migration). The review itself
 *    runs client-side on the assist route (auto-run once on mount when
 *    the landing carries the param, manual otherwise); nothing is
 *    applied to the estimate without the user's accept step.
 *
 * Failure semantics (mirrors `createProjectAction` with intent=estimate):
 * a project that fails to save returns an inline error; an estimate that
 * fails after the project saved redirects to the project instead of
 * retrying the create (a retry would duplicate the project, and the
 * estimate POST may have committed despite the error).
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
    laborRate: formData.get("laborRate"),
    region: formData.get("region"),
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
    await completeOnboarding(token, {
      workTypes: value.workTypes,
      scopeText: value.scopeText,
      laborRateCents: value.laborRateCents,
      region: value.region,
    });
  } catch {
    // Best-effort: the draft estimate is the completion record. A failed
    // state write leaves the org resumable (in_progress) rather than
    // blocking the first estimate.
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/estimates/${estimate.id}/assist?autoReview=1`);
}

/**
 * Skip onboarding for this org (DES-3 slice 2).
 *
 * The skip is persisted on the org's onboarding-state record
 * (POST /api/v1/onboarding/skip) — slice 1's browser-scoped cookie is
 * gone as the primary path. Completion needs no persistence call — the
 * created draft estimate makes the org non-empty and clears the dashboard
 * bypass by itself. A failed skip write fails open to the dashboard via
 * the legacy skip cookie (Codex P2, PR #1105): without it, the dashboard
 * gate re-reads the un-skipped state and bounces the user back to
 * /onboarding, stranding them in a redirect loop whenever the
 * onboarding-state read is down. The cookie is set only on persist
 * failure, never on the success path.
 */
export async function skipFirstEstimateOnboarding(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    try {
      await skipOnboarding(token);
    } catch {
      // Fallback bypass: the persisted skip failed, so preserve the
      // escape with the cookie the dashboard gate already honors.
      const cookieStore = await cookies();
      cookieStore.set(ONBOARDING_SKIPPED_COOKIE, "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }
  redirect("/dashboard");
}

/**
 * Best-effort wizard progress save (DES-3 slice 2).
 *
 * Called when the wizard moves between steps so an org resumes where it
 * left off. Invalid or missing fields are dropped, never errors: a
 * half-filled step 1 has no scope text yet, and a progress save must
 * never block the wizard. Returns { ok } so the form can advance
 * regardless of the outcome.
 *
 * Explicit clears (Codex P2, PR #1105): a field the form sends present
 * but empty is sent as `null`, not omitted — the service preserves
 * stored values for omitted fields, so omitting a cleared scope or
 * region would restore the deleted text on resume. A field the form
 * does not send at all stays omitted.
 */
export async function saveOnboardingProgressAction(formData: FormData): Promise<{ ok: boolean }> {
  const token = await getSessionToken();
  if (!token) return { ok: false };

  const step = Number(formData.get("currentStep"));
  const workTypes = formData
    .getAll("workTypes")
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && (ONBOARDING_WORK_TYPES as ReadonlyArray<string>).includes(entry),
    );
  const scopeText = typeof formData.get("scopeText") === "string" ? (formData.get("scopeText") as string) : null;
  const { cents: laborRateCents } = parseLaborRateDollars(formData.get("laborRate"));
  const region = typeof formData.get("region") === "string" ? (formData.get("region") as string).trim() : null;

  try {
    await saveOnboardingProgress(token, {
      ...(Number.isInteger(step) && (step === 1 || step === 2) ? { currentStep: step } : {}),
      workTypes,
      ...(scopeText === null
        ? {}
        : scopeText.trim().length === 0
          ? { scopeText: null }
          : scopeText.length <= MAX_SCOPE_TEXT_LENGTH
            ? { scopeText: scopeText.trim() }
            : {}),
      ...(laborRateCents !== null ? { laborRateCents } : {}),
      ...(region === null ? {} : region.length > 0 ? { region } : { region: null }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
