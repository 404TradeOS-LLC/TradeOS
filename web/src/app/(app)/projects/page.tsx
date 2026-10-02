import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { listProjects } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRowLink } from "@/components/shared/list-row-link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  buildProjectIntentDestination,
  PROJECT_CREATE_INTENT_COPY,
  resolveProjectCreateIntent,
} from "@/lib/universal-create";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const [token, query] = await Promise.all([getSessionToken(), searchParams]);
  const projects = token ? await listProjects(token) : [];
  const intent = resolveProjectCreateIntent(query.intent);
  const intentCopy = intent ? PROJECT_CREATE_INTENT_COPY[intent] : null;

  const headerAction =
    intent === "job" ? (
      <Link href="/projects/new?intent=job" className={buttonVariants()}>
        New project for job
      </Link>
    ) : !intent ? (
      <Link href="/projects/new" className={buttonVariants()}>
        Add project
      </Link>
    ) : undefined;

  const emptyAction =
    intent === "job" ? (
      <Link href="/projects/new?intent=job" className={buttonVariants()}>
        Create project for job
      </Link>
    ) : intent === "invoice" ? (
      <Link href="/projects/new?intent=estimate#simpleScope" className={buttonVariants()}>
        Start with an estimate
      </Link>
    ) : intent === "change-order" ? (
      <Link href="/projects/new" className={buttonVariants()}>
        Create the project first
      </Link>
    ) : (
      <Link href="/projects/new" className={buttonVariants()}>
        Add first project
      </Link>
    );

  const emptyDescription =
    intent === "invoice"
      ? "Invoices require an existing Project with an eligible non-draft Estimate. Start the estimate workflow first."
      : intent === "change-order"
        ? "A change order belongs to an existing Project whose scope is changing. Create the Project before recording the change."
        : intent === "job"
          ? "A field Job belongs to a Project and Customer. Create that Project first, then TradeOS will continue directly into Job creation."
          : "Create the first Project so TradeOS can carry the work from field intake through estimating, proposal, contract, invoicing, and closeout.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={intentCopy?.title ?? "Projects"}
        description={
          intentCopy?.description ??
          "Each Project keeps the site visit, estimate, proposal, contract, and invoice work tied to one customer job."
        }
        action={headerAction}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={intentCopy ? `No Projects available for ${intentCopy.title.toLowerCase()}` : "No projects yet"}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ListRowLink
                href={intent ? buildProjectIntentDestination(project.id, intent) : `/projects/${project.id}`}
                title={project.name}
                subtitle={intentCopy?.rowHelper}
                trailing={
                  <>
                    <StatusBadge status={project.status} />
                    {intentCopy ? <span className="hidden text-xs font-medium text-primary sm:inline">{intentCopy.rowAction}</span> : null}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
