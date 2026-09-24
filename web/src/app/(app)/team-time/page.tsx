import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamTimeWorkspace } from "@/components/team-time/team-time-workspace";
import { isTeamTimeEnabled } from "@/lib/team-time-config";

export const metadata: Metadata = {
  title: "Team & Time | TradeOS",
  description: "Record assigned job hours, review timesheets, and prepare a controlled payroll handoff.",
};

export default function TeamTimePage() {
  if (!isTeamTimeEnabled()) {
    return <EmptyState title="Team & Time is not enabled here" description="This workspace is available in configured staging environments while the team and payroll handoff are being verified." />;
  }
  return <TeamTimeWorkspace />;
}
