import Link from "next/link";
import { cn } from "@/lib/utils";

export const PROJECT_WORKSPACE_TABS = [
  "overview",
  "estimate-history",
  "proposals",
  "contracts",
  "invoices",
  "photos",
  "documents",
  "site-visits",
  "tasks",
  "change-orders",
  "timeline",
  "warranty",
  "notes",
  "activity",
] as const;

export type ProjectWorkspaceTab = (typeof PROJECT_WORKSPACE_TABS)[number];

const TAB_LABELS: Record<ProjectWorkspaceTab, string> = {
  overview: "Overview",
  "estimate-history": "Estimate History",
  proposals: "Proposals",
  contracts: "Contracts",
  invoices: "Invoices",
  photos: "Photos",
  documents: "Documents",
  "site-visits": "Site Visits",
  tasks: "Tasks",
  "change-orders": "Change Orders",
  timeline: "Timeline",
  warranty: "Warranty",
  notes: "Notes",
  activity: "Activity",
};

export function resolveProjectWorkspaceTab(value: string | undefined): ProjectWorkspaceTab {
  return PROJECT_WORKSPACE_TABS.includes(value as ProjectWorkspaceTab) ? (value as ProjectWorkspaceTab) : "overview";
}

export function ProjectWorkspaceTabs({ projectId, activeTab }: { projectId: string; activeTab: ProjectWorkspaceTab }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/85 p-2">
      <nav className="flex min-w-max gap-2">
        {PROJECT_WORKSPACE_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/projects/${projectId}?tab=${tab}`}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
