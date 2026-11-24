import { LeadOverview } from "@/components/projects/lead-overview";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectSidebar } from "@/components/projects/project-sidebar";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { ProjectWorkspaceTabs, resolveProjectWorkspaceTab } from "@/components/projects/project-workspace-tabs";
import { getProjectTaskAssignees, getOrganizationSettings, getProject, getProjectCloseout, listPunchItems, listWarranties } from "@/lib/api";
import type { ProjectCloseoutData } from "@/components/projects/workspace-types";
import { getSessionToken } from "@/lib/session";

const JOB_MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);

async function loadProjectCloseoutData(token: string, projectId: string): Promise<ProjectCloseoutData> {
  const [closeoutResult, punchItems, warranties] = await Promise.all([
    getProjectCloseout(token, projectId).catch(() => null),
    listPunchItems(token, projectId).catch(() => null),
    listWarranties(token, projectId).catch(() => null),
  ]);
  return {
    // The backend returns { closeout, checklist } as one payload; the
    // checklist is the backend's computed readiness verdict, not a field
    // on the closeout row.
    closeout: closeoutResult?.closeout ?? null,
    checklist: closeoutResult?.checklist ?? null,
    punchItems: punchItems ?? [],
    warranties: warranties ?? [],
    // All three calls failed: the closeout service is unreachable, which the
    // tab reports explicitly. A 404 on the closeout record alone (no record
    // yet) returns null for just that call and is not an outage.
    closeoutUnavailable: closeoutResult === null && punchItems === null && warranties === null,
  };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; estimateStart?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const token = await getSessionToken();
  const [project, settings, assignees] = await Promise.all([
    getProject(token ?? "", id),
    getOrganizationSettings(token ?? ""),
    getProjectTaskAssignees(token ?? "", id).catch(() => ({ canAssign: false, members: [] })),
  ]);
  const activeTab = resolveProjectWorkspaceTab(resolvedSearchParams.tab);
  // Closeout data is loaded only for the Closeout tab, and each call degrades
  // independently: a missing closeout record (or an unreachable closeout
  // service) stays local to the tab instead of failing the whole workspace.
  const closeoutData: ProjectCloseoutData | null =
    activeTab === "closeout"
      ? await loadProjectCloseoutData(token ?? "", id)
      : null;
  // Presentation gate only; the PATCH /api/v1/projects/:id endpoint and the
  // updateProjectAction independently require crm.write and tenant scope.
  const canEditProject = ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);
  const estimateStartNotice = resolvedSearchParams.estimateStart === "review" ? (
    <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
      Project saved. The estimate request could not be confirmed. Check this Project’s estimates before starting another one.
    </p>
  ) : null;
  const showCanonicalLeadOverview =
    activeTab === "overview" &&
    project.estimates.length === 0 &&
    project.proposals.length === 0 &&
    project.contracts.length === 0 &&
    project.jobs.length === 0 &&
    (project.status === "lead" || (project.status === "estimating" && project.siteVisits.length > 0));

  if (showCanonicalLeadOverview) {
    return (
      <div className="flex flex-col gap-4">
        {estimateStartNotice}
        <LeadOverview
          project={project}
          customer={project.customer}
          estimates={project.estimates}
          siteVisits={project.siteVisits}
          projectFiles={project.projectFiles}
          canEditProject={canEditProject}
        />
      </div>
    );
  }

  const actions = [
    ...(canEditProject
      ? [{ href: `/projects/${project.id}/edit`, label: "Edit project", variant: "secondary" as const }]
      : []),
    ...(JOB_MANAGER_ROLES.has(settings.currentRole)
      ? [{ href: `/projects/${project.id}/jobs/new`, label: "Create job" }]
      : []),
    { href: `/projects/${project.id}/intake`, label: "Open field intake", variant: "secondary" as const },
    { href: `/projects/${project.id}?tab=change-orders`, label: "Open change orders", variant: "secondary" as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      {estimateStartNotice}
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
          currentRole={settings.currentRole}
          taskMembers={assignees.members}
          canAssignTaskIdentity={assignees.canAssign}
          closeoutData={closeoutData}
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
