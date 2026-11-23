import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TodayExperience } from "@/components/dashboard/today-experience";
import { TodayAccessState } from "@/components/dashboard/today-access-state";
import { loadTodayData } from "@/lib/today-data";
import { isFirstRunRedirectNeeded } from "@/lib/onboarding-first-run";

export const metadata: Metadata = {
  title: "Today | TradeOS",
  description: "Your work, decisions, and next action. The TradeOS contractor command center.",
};

export default async function DashboardPage() {
  // DES-3: a brand-new organization never lands on the empty Today view —
  // it goes to first-estimate onboarding instead. The check fails open to
  // the dashboard, and completing onboarding clears it by itself (the
  // created draft estimate makes the org non-empty). Signup, login, and
  // auto-provisioning are untouched; the legacy recovery route stays as-is.
  if (await isFirstRunRedirectNeeded()) redirect("/onboarding");
  const data = await loadTodayData();
  if (!data) return <TodayAccessState />;
  return <TodayExperience data={data} />;
}
