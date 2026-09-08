import { getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { EstimateBuilder } from "./builder";

export default async function EstimateBuilderPage({ params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id, estimateId } = await params;
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);
  return (
    <div className="flex flex-col gap-6">
      <EstimateBuilder projectId={id} projectName={project.name} estimateId={estimateId} />
    </div>
  );
}
