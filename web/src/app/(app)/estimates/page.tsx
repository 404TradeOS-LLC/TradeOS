import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { listEstimateQueue, type EstimateQueueItem } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { formatCurrency } from "@/lib/document-workflow";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Estimates | TradeOS",
  description: "Build, review, and send contractor estimates.",
};

function EstimateRow({ estimate }: { estimate: EstimateQueueItem }) {
  return (
    <Link
      href={`/projects/${estimate.projectId}/estimates/${estimate.id}`}
      className="group grid gap-3 border-b border-border/60 px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground group-hover:text-copper">{estimate.projectName}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{estimate.customerName ?? "No customer linked"} · Updated {new Date(estimate.updatedAt).toLocaleDateString()}</p>
      </div>
      <StatusBadge status={estimate.status} />
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(estimate.amount)}</span>
        <span aria-hidden="true" className="text-lg text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}

export default async function EstimatesPage() {
  const token = await getSessionToken();
  let estimates: EstimateQueueItem[] = [];
  let loadError: string | null = null;

  if (token) {
    try {
      estimates = (await listEstimateQueue(token, { status: "draft,ready", limit: 50 })).items;
    } catch {
      loadError = "Estimates are temporarily unavailable. Try again in a moment.";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Estimates"
        description="Turn plain-language scope into clear, profitable work."
        actions={
          <Link href="/projects/new?intent=estimate#simpleScope" className={cn(buttonVariants({ variant: "copper" }), "shrink-0")}>
            <Plus className="size-4" aria-hidden="true" />
            Estimate from scope
          </Link>
        }
      />

      {loadError ? (
        <div role="alert" className="border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">{loadError}</div>
      ) : estimates.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" aria-hidden="true" />}
          title="No estimates need attention"
          description="Start with the work in front of you. A short scope is enough to create the first estimate."
          action={
            <Link href="/projects/new?intent=estimate#simpleScope" className={buttonVariants({ variant: "copper" })}>
              Create an estimate
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="estimate-queue-heading" className="overflow-hidden border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div>
              <h2 id="estimate-queue-heading" className="font-semibold text-foreground">Open estimate queue</h2>
              <p className="text-sm text-muted-foreground">{estimates.length} draft or ready estimate{estimates.length === 1 ? "" : "s"}</p>
            </div>
            <span className="hidden text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:inline">Scope → price → send</span>
          </div>
          {estimates.map((estimate) => <EstimateRow key={estimate.id} estimate={estimate} />)}
        </section>
      )}
    </div>
  );
}
