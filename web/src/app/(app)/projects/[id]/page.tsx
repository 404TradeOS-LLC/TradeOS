import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectSidebar } from "@/components/projects/project-sidebar";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { ProjectWorkspaceTabs, resolveProjectWorkspaceTab } from "@/components/projects/project-workspace-tabs";
import { getOrganizationSettings, getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

const JOB_MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const token = await getSessionToken();
  const [project, settings] = await Promise.all([
    getProject(token ?? "", id),
    getOrganizationSettings(token ?? ""),
  ]);
  const activeTab = resolveProjectWorkspaceTab(resolvedSearchParams.tab);
  const actions = [
    ...(JOB_MANAGER_ROLES.has(settings.currentRole)
      ? [{ href: `/projects/${project.id}/jobs/new`, label: "Create job" }]
      : []),
    { href: `/projects/${project.id}/intake`, label: "Open field intake", variant: "secondary" as const },
    { href: `/projects/${project.id}?tab=change-orders`, label: "Open change orders", variant: "secondary" as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ProjectHeader
        project={project}
        subtitle={project.simpleScope ?? "Move this job from estimate into full project execution."}
        actions={actions}
      />

      <ProjectWorkspaceTabs projectId={project.id} activeTab={activeTab} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ProjectWorkspace
          activeTab={activeTab}
          project={project}
          customer={project.customer}
          estimates={project.estimates}
          siteVisits={project.siteVisits}
          projectFiles={project.projectFiles}
          proposals={project.proposals}
          invoices={project.invoices}
          contracts={project.contracts}
          changeOrders={project.changeOrders}
          tasks={project.tasks}
          jobs={project.jobs}
        />

        <ProjectSidebar
          project={project}
          customer={project.customer}
          siteVisits={project.siteVisits}
          proposals={project.proposals}
          estimates={project.estimates}
          projectFiles={project.projectFiles}
          invoices={project.invoices}
          contracts={project.contracts}
          changeOrders={project.changeOrders}
          tasks={project.tasks}
          jobs={project.jobs}
        />
      </div>
    </div>
  );
}
