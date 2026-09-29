import Link from "next/link";
import { Clock3, Users } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  ActivityEvent,
  Customer,
  OrganizationProjectTask,
  Project,
  ProposalQueueItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type PipelineStage = "lead" | "ready" | "estimating" | "proposal" | "awarded";

interface CrmOverviewProps {
  projects: Project[];
  customers: Customer[];
  followUps: OrganizationProjectTask[];
  proposals: ProposalQueueItem[];
  siteVisitEvents: ActivityEvent[];
  sourceErrors: string[];
}

const PIPELINE: Array<{ id: PipelineStage; label: string; helper: string }> = [
  { id: "lead", label: "Lead", helper: "Project = lead" },
  { id: "ready", label: "Ready to Estimate", helper: "Site visit captured" },
  { id: "estimating", label: "Estimating", helper: "Project = estimating" },
  { id: "proposal", label: "Proposal Sent", helper: "Proposal = sent / viewed" },
  { id: "awarded", label: "Awarded", helper: "Project = awarded" },
];

function newestProposalByProject(proposals: ProposalQueueItem[]) {
  const map = new Map<string, ProposalQueueItem>();
  for (const proposal of [...proposals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    if (!map.has(proposal.projectId)) map.set(proposal.projectId, proposal);
  }
  return map;
}

function customerMap(customers: Customer[]) {
  return new Map(customers.map((customer) => [customer.id, customer]));
}

function pipelineStageFor(
  project: Project,
  proposal: ProposalQueueItem | undefined,
  siteVisitProjectIds: Set<string>
): PipelineStage | null {
  if (project.status === "awarded") return "awarded";
  if (proposal && (proposal.status === "sent" || proposal.status === "viewed")) return "proposal";

  if (project.status === "lead") {
    return siteVisitProjectIds.has(project.id) ? "ready" : "lead";
  }

  if (project.status === "estimating") {
    const proposalExists = Boolean(proposal);
    return siteVisitProjectIds.has(project.id) && !proposalExists ? "ready" : "estimating";
  }

  return null;
}

function dueLabel(task: OrganizationProjectTask) {
  if (!task.dueDate) return "No due date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(task.dueDate));
}

function followUpSort(left: OrganizationProjectTask, right: OrganizationProjectTask) {
  if (!left.dueDate && !right.dueDate) return right.updatedAt.localeCompare(left.updatedAt);
  if (!left.dueDate) return 1;
  if (!right.dueDate) return -1;
  return left.dueDate.localeCompare(right.dueDate);
}

function PipelineCard({
  project,
  customer,
  proposal,
}: {
  project: Project;
  customer?: Customer;
  proposal?: ProposalQueueItem;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-xl border border-border/70 bg-background/80 p-3 outline-none transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{customer?.name ?? proposal?.customerName ?? "No customer linked"}</p>
        </div>
        <StatusBadge status={proposal && (proposal.status === "sent" || proposal.status === "viewed") ? proposal.status : project.status} />
      </div>
      {proposal ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Proposal {proposal.status}{proposal.amount != null ? ` · ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(proposal.amount)}` : ""}
        </p>
      ) : project.jobType ? (
        <p className="mt-2 text-xs text-muted-foreground">{project.jobType}</p>
      ) : null}
    </Link>
  );
}

export function CrmOverview({
  projects,
  customers,
  followUps,
  proposals,
  siteVisitEvents,
  sourceErrors,
}: CrmOverviewProps) {
  const customersById = customerMap(customers);
  const proposalsByProject = newestProposalByProject(proposals);
  const siteVisitProjectIds = new Set(siteVisitEvents.map((event) => event.entityId));

  const lanes = new Map<PipelineStage, Project[]>(PIPELINE.map((stage) => [stage.id, []]));
  for (const project of projects) {
    const stage = pipelineStageFor(project, proposalsByProject.get(project.id), siteVisitProjectIds);
    if (stage) lanes.get(stage)?.push(project);
  }

  const visibleFollowUps = [...followUps]
    .filter((task) => task.status !== "completed" && !task.completedAt)
    .sort(followUpSort)
    .slice(0, 5);

  const recentCustomers = [...customers]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="grid gap-5">
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
          CRM is showing the sources that loaded successfully. {sourceErrors.join(" ")}
        </div>
      ) : null}

      <nav aria-label="CRM sections" className="flex gap-2 overflow-x-auto pb-1">
        <Link href="/crm" aria-current="page" className="min-h-10 shrink-0 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
          Overview
        </Link>
        <Link href="#pipeline" className="min-h-10 shrink-0 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          Leads
        </Link>
        <Link href="#customers" className="min-h-10 shrink-0 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          Customers
        </Link>
        <Link href="#follow-ups" className="min-h-10 shrink-0 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          Follow-ups
        </Link>
      </nav>

      <section id="follow-ups" className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Follow-ups</p>
              <h2 className="mt-1 font-heading text-xl font-semibold">What needs a relationship touch?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Existing incomplete Project Tasks due next.</p>
            </div>
            <Badge variant="outline">{visibleFollowUps.length}</Badge>
          </div>

          <div className="mt-4 grid gap-2">
            {visibleFollowUps.length === 0 ? (
              <EmptyState icon={Clock3} title="No open follow-ups" description="Project Tasks created by staff or Athena appear here when they are still open." />
            ) : (
              visibleFollowUps.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.projectId}`}
                  className="grid gap-1 rounded-xl border border-border/70 bg-background/70 px-3 py-3 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {task.projectName}{task.customerName ? ` · ${task.customerName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{task.priority}</Badge>
                    <span className="font-medium text-muted-foreground">{dueLabel(task)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div id="customers" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customers</p>
              <h2 className="mt-1 font-heading text-xl font-semibold">Relationship records</h2>
            </div>
            <Link href="/customers" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>

          <div className="mt-4 grid gap-2">
            {recentCustomers.length === 0 ? (
              <EmptyState icon={Users} title="No customers yet" description="Customer records stay canonical in CRM; projects and documents link back to them." />
            ) : (
              recentCustomers.map((customer) => (
                <Link key={customer.id} href={`/customers/${customer.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{customer.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{customer.email ?? customer.phone ?? "No contact detail"}</p>
                  </div>
                  <span aria-hidden="true" className="text-muted-foreground">›</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="pipeline" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5" aria-labelledby="pipeline-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Proposal pipeline</p>
            <h2 id="pipeline-heading" className="mt-1 font-heading text-xl font-semibold">Pre-job work, derived from canonical records</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              No parallel CRM stage is stored. Lanes come from Project status, Site Visit activity, and Proposal status.
            </p>
          </div>
          <Link href="/projects/new" className={buttonVariants({ variant: "outline", size: "sm" })}>New lead</Link>
        </div>

        <div className="mt-4 hidden grid-cols-5 gap-3 xl:grid">
          {PIPELINE.map((stage) => {
            const stageProjects = lanes.get(stage.id) ?? [];
            return (
              <section key={stage.id} className="min-w-0 rounded-xl bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{stage.label}</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{stage.helper}</p>
                  </div>
                  <Badge variant="outline">{stageProjects.length}</Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {stageProjects.slice(0, 5).map((project) => (
                    <PipelineCard
                      key={project.id}
                      project={project}
                      customer={project.customerId ? customersById.get(project.customerId) : undefined}
                      proposal={proposalsByProject.get(project.id)}
                    />
                  ))}
                  {stageProjects.length === 0 ? <p className="rounded-lg border border-dashed border-border/70 px-2 py-4 text-center text-xs text-muted-foreground">Nothing here</p> : null}
                  {stageProjects.length > 5 ? <p className="text-xs text-muted-foreground">+ {stageProjects.length - 5} more</p> : null}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 xl:hidden">
          {PIPELINE.map((stage) => {
            const stageProjects = lanes.get(stage.id) ?? [];
            const first = stageProjects[0];
            return (
              <div key={stage.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{stage.label}</p>
                    <Badge variant="outline">{stageProjects.length}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{first?.name ?? stage.helper}</p>
                </div>
                {first ? <Link href={`/projects/${first.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0")}>Open</Link> : null}
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        CRM is an operating view over Customers, Projects, Project Tasks, Site Visits, and Proposals. Moving work forward continues through the existing lifecycle actions on those records.
      </p>
    </div>
  );
}
