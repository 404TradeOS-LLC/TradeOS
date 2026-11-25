import { getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { EstimateBuilder } from "./builder";
import { EstimateMaterialsPanel } from "@/components/estimate/estimate-materials-panel";

export default async function EstimateBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; estimateId: string }>;
  searchParams: Promise<{ confirmedNoMatch?: string }>;
}) {
  const { id, estimateId } = await params;
  const resolvedSearchParams = await searchParams;
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);
  return (
    <div className="flex flex-col gap-6">
      <EstimateMaterialsPanel estimateId={estimateId} projectId={id} />
      <EstimateBuilder
        key={`${id}:${estimateId}`}
        projectId={id}
        projectName={project.name}
        simpleScope={project.simpleScope}
        estimateId={estimateId}
        customerName={project.customer?.name ?? null}
        jobType={project.jobType}
        // DES-10 Status Check: carried from the Status Check screen's
        // "Return to Estimate Review" action after the contractor confirmed
        // no matching draft was present.
        confirmedNoMatch={resolvedSearchParams.confirmedNoMatch === "1"}
      />
    </div>
  );
}
