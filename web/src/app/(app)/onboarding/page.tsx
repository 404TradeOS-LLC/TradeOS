import type { Metadata } from "next";
import { FirstEstimateOnboardingForm } from "./first-estimate-onboarding-form";

export const metadata: Metadata = {
  title: "Get started | TradeOS",
  description:
    "Two things before your first estimate — then Athena builds a draft from a real job.",
};

export default function OnboardingPage() {
  return <FirstEstimateOnboardingForm />;
}
