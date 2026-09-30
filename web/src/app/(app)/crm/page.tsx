import type { Metadata } from "next";
import Link from "next/link";
import { CrmOverview } from "@/components/crm/crm-overview";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listActivityEvents,
  listCustomers,
  listOrganizationProjectTasks,
  listProjects,
  listProposalQueue,
  type ActivityEvent,
  type Customer,
  type OrganizationProjectTask,
  type Project,
  type ProposalQueueItem,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "CRM | TradeOS",
  description: "Leads, customers, follow-ups, and proposal pipeline derived from the TradeOS records that already own the work.",
};

function resultValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function CrmPage() {
  const token = await getSessionToken();
  if (!token) {
    return <EmptyState title="Sign in to view CRM" description="Your customer and pre-job work appear here after authentication." />;
  }

  const [projectsResult, customersResult, tasksResult, proposalsResult, siteVisitsResult] = await Promise.allSettled([
    listProjects(token),
    listCustomers(token),
    listOrganizationProjectTasks(token, { limit: 50, includeCompleted: false }),
    listProposalQueue(token, { limit: 50 }),
    listActivityEvents(token, { entityType: "project", eventType: "site_visit.created", limit: 100 }),
  ]);

  const projects = resultValue<Project[]>(projectsResult, []);
  const customers = resultValue<Customer[]>(customersResult, []);
  const followUps = resultValue<OrganizationProjectTask[]>(tasksResult, []);
  const proposals = resultValue(proposalsResult, { items: [] as ProposalQueueItem[], nextCursor: null, total: 0 }).items;
  const siteVisitEvents = resultValue<ActivityEvent[]>(siteVisitsResult, []);

  const sourceErrors: string[] = [];
  if (projectsResult.status === "rejected") sourceErrors.push("Projects are temporarily unavailable.");
  if (customersResult.status === "rejected") sourceErrors.push("Customers are temporarily unavailable.");
  if (tasksResult.status === "rejected") sourceErrors.push("Follow-ups are temporarily unavailable.");
  if (proposalsResult.status === "rejected") sourceErrors.push("Proposal pipeline status is temporarily unavailable.");
  if (siteVisitsResult.status === "rejected") sourceErrors.push("Site-visit milestones are temporarily unavailable.");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="CRM"
        description="Leads, customers, follow-ups, and the proposal path without a second opportunity database."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/customers/new" className={buttonVariants({ variant: "outline" })}>New customer</Link>
            <Link href="/projects/new" className={buttonVariants()}>New lead</Link>
          </div>
        }
      />
      <CrmOverview
        projects={projects}
        customers={customers}
        followUps={followUps}
        proposals={proposals}
        siteVisitEvents={siteVisitEvents}
        sourceErrors={sourceErrors}
      />
    </div>
  );
}
