import { getProject, getProjectProposalDraft } from "@/lib/api";
import { ProposalContextPanel } from "@/components/proposals/proposal-context-panel";
import { PageHeader } from "@/components/shared/page-header";
import { getSessionToken } from "@/lib/session";
import { NewProposalForm } from "./form";

export default async function NewProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const [project, draft] = await Promise.all([getProject(token ?? "", id), getProjectProposalDraft(token ?? "", id)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proposal Review"
        description="Start with the AI draft, then tighten language, exclusions, and pricing before sending anything to the customer."
        backHref={`/projects/${id}`}
        backLabel="Back to project"
      />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <NewProposalForm projectId={id} estimates={project.estimates} draft={draft} />
        <ProposalContextPanel latestVisit={project.siteVisits[0] ?? null} projectFiles={project.projectFiles} />
      </div>
    </div>
  );
}
