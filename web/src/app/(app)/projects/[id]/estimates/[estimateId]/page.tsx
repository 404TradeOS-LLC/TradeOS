import { EstimateBuilder } from "./builder";

export default async function EstimateBuilderPage({ params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id, estimateId } = await params;
  return (
    <div className="flex flex-col gap-6">
      <EstimateBuilder projectId={id} estimateId={estimateId} />
    </div>
  );
}
