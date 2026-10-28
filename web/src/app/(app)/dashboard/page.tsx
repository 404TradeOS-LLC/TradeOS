import type { Metadata } from "next";
import { TodayExperience } from "@/components/dashboard/today-experience";
import { TodayAccessState } from "@/components/dashboard/today-access-state";
import { loadTodayData } from "@/lib/today-data";

export const metadata: Metadata = {
  title: "Today | TradeOS",
  description: "Your work, decisions, and next action. The TradeOS contractor command center.",
};

export default async function DashboardPage() {
  const data = await loadTodayData();
  if (!data) return <TodayAccessState />;
  return <TodayExperience data={data} />;
}
