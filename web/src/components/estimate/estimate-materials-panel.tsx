"use client";

import { useQuery } from "@tanstack/react-query";
import { clientFetch } from "@/lib/clientApi";
import type { EstimateDetail } from "@/lib/api";
import { estimateMaterialsPreview } from "@/lib/estimate-materials";
import { buttonVariants } from "@/components/ui/button";

/** Read-only customer handoff: estimate editing remains in the existing builder. */
export function EstimateMaterialsPanel({ estimateId, projectId }: { estimateId: string; projectId: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: () => clientFetch<EstimateDetail>(`/estimates/${estimateId}`),
    staleTime: 15_000,
  });
  const preview = estimateMaterialsPreview(data?.lineItems ?? []);
  const available = data?.projectId === projectId && !preview.requiresReview && preview.items.length > 0;
  const downloadPath = `/api/documents/estimates/${estimateId}/materials/pdf`;

  return (
    <section aria-label="Customer materials checklist" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">Customer materials checklist</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a shopping list from saved material lines, with quantities and no internal prices.
          </p>
          {isPending ? <p className="mt-2 text-sm text-muted-foreground">Loading saved materials…</p> : null}
          {isError ? <p className="mt-2 text-sm text-destructive" role="alert">Materials could not be loaded. Try reloading the estimate.</p> : null}
          {data && data.projectId !== projectId ? (
            <p className="mt-2 text-sm text-destructive" role="alert">This estimate does not belong to the current project.</p>
          ) : null}
          {data && data.projectId === projectId && preview.requiresReview ? (
            <p className="mt-2 text-sm text-warning" role="alert">Review the saved material quantities and descriptions before downloading.</p>
          ) : null}
          {data && data.projectId === projectId && !preview.requiresReview && preview.items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Add a line categorized as Material to create the checklist.</p>
          ) : null}
        </div>
        {available ? (
          <div className="flex flex-wrap gap-2">
            <a className={buttonVariants({ variant: "outline" })} href={`${downloadPath}?disposition=inline`} target="_blank" rel="noopener noreferrer">
              Preview PDF
            </a>
            <a className={buttonVariants({ variant: "default" })} href={downloadPath}>
              Download PDF
            </a>
          </div>
        ) : null}
      </div>
      {available ? (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Review {preview.items.length} material {preview.items.length === 1 ? "line" : "lines"}
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            {preview.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{item.section}</span>
                  <span className="block">{item.description}</span>
                </span>
                <span className="shrink-0 font-medium">{item.quantity} {item.unitOfMeasure}</span>
              </li>
            ))}
          </ul>
          {preview.unexpandedAssemblyCount > 0 ? (
            <p className="mt-3 text-xs text-warning">
              {preview.unexpandedAssemblyCount} assembly line(s) may contain additional materials and are not expanded into shopping quantities.
            </p>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
