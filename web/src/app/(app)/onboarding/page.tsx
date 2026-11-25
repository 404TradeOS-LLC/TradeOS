import type { Metadata } from "next";
import { FirstEstimateOnboardingForm } from "./first-estimate-onboarding-form";
import { getOnboardingState } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Get started | TradeOS",
  description:
    "Two things before your first estimate — then Athena builds a draft from a real job.",
};

/**
 * Onboarding page (DES-3 slice 2). Loads the org's persisted onboarding
 * state server-side so the wizard resumes where the org left off (step,
 * work types, scope text, labor baseline, region). A failed state read
 * fails open to an empty wizard, exactly as slice 1 rendered it —
 * onboarding must never block on its own persistence.
 */
export default async function OnboardingPage() {
  let initialState = null;
  const token = await getSessionToken();
  if (token) {
    try {
      ({ state: initialState } = await getOnboardingState(token));
    } catch {
      // Fail open: see above.
    }
  }
  return <FirstEstimateOnboardingForm initialState={initialState} />;
}
