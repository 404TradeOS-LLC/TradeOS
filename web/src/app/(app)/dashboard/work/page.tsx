import type { Metadata } from "next";
import { TodayExperience } from "@/components/dashboard/today-experience";
import { TodayAccessState } from "@/components/dashboard/today-access-state";
import { loadTodayData } from "@/lib/today-data";
export const metadata: Metadata = { title: "Today's Work | TradeOS" };
export default async function TodayWorkPage() {
  const data = await loadTodayData();
  if (!data) return <TodayAccessState />;
  return <TodayExperience data={data} initialView="work" />;
}
