import Link from "next/link";
import { notFound } from "next/navigation";
import { AIEstimateAssist } from "@/components/estimate-assist/ai-estimate-assist";
import { buttonVariants } from "@/components/ui/button";
import { getKnowledgeStats, getKnowledgeTrades, getProject } from "@/lib/api";
import { savedScopeForEstimateReview } from "@/lib/estimate-review-navigation";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function AIEstimateAssistPage({
  params,
}: {
  params: Promise<{ id: string; estimateId: string }>;
}) {
  const { id, estimateId } = await params;
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);
  const initialScope = savedScopeForEstimateReview(project, id, estimateId);
  if (initialScope === null) notFound();
  const [knowledgeStats, knowledgeTrades] = token
    ? await Promise.all([
        // Both are supplementary context for the assist panel (it already
        // renders sensible empty states for null/[]) — a failure here must
        // never crash the whole page into the generic error boundary.
        getKnowledgeStats(token).catch(() => null),
        getKnowledgeTrades(token).catch(() => []),
      ])
    : [null, []];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href={`/projects/${id}/estimates/${estimateId}`} className="text-sm text-muted-foreground underline underline-offset-4">
            ← Back to estimate builder
          </Link>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Athena Estimate Review</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Turn a plain-English scope into reviewable draft line items with Athena, then accept or reject them before they reach the estimate.
            </p>
          </div>
        </div>
        <Link href={`/projects/${id}/estimates/${estimateId}`} className={cn(buttonVariants({ variant: "outline" }))}>
          Return to estimate
        </Link>
      </div>

      <AIEstimateAssist
        key={`${id}:${estimateId}`}
        projectId={id}
        estimateId={estimateId}
        initialScopeOfWork={initialScope}
        initialSuggestions={[]}
        initialKnowledgeStats={knowledgeStats}
        initialKnowledgeTrades={knowledgeTrades}
        initialKnowledgeMatch={null}
        initialStructuredDraft={null}
      />
    </div>
  );
}

