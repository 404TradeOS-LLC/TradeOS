/**
 * Quiet, nonblocking Codes & Permits disclosure for the Estimate Scope and
 * Review stages (issue #946, TODO 4).
 *
 * Progressive disclosure per .stitch/DESIGN.md: a small inline signal that
 * expands only when the contractor opens it. It never blocks estimating —
 * while loading, on error, or for roles without costbook.read it renders
 * nothing. It never shows a price and never changes the estimate total.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { clientFetch } from "@/lib/clientApi";
import {
  summarizeCodesHints,
  type EstimateCodesHintsResponse,
} from "@/lib/costbook-codes-hints";

export function EstimateCodesHints({ estimateId }: { estimateId: string }) {
  const { data, isError } = useQuery({
    queryKey: ["estimate-codes-hints", estimateId],
    queryFn: () =>
      clientFetch<EstimateCodesHintsResponse>(`/costbook/codes/estimates/${estimateId}/hints`),
    staleTime: 30_000,
    retry: false,
  });

  if (isError || !data) return null;
  const summary = summarizeCodesHints(data);

  return (
    <section
      aria-label="Codes and permits hints"
      className="rounded-lg border border-border/70 bg-muted/20 p-4"
    >
      <details>
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          {summary.statusLine}
          {summary.openQuestionCount > 0 ? ` · ${summary.openQuestionCount} open question${summary.openQuestionCount === 1 ? "" : "s"}` : ""}
        </summary>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          {data.hints.map((hint) => (
            <p key={hint}>{hint}</p>
          ))}
          {data.openQuestions.length > 0 ? (
            <div>
              <p className="font-medium text-foreground">Open questions</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {data.openQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.assessments.length > 0 ? (
            <div>
              <p className="font-medium text-foreground">Job assessments</p>
              <ul className="mt-1 space-y-1">
                {data.assessments.map((assessment) => (
                  <li key={assessment.id}>
                    {assessment.workType} — {assessment.status.replace("_", " ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.citations.length > 0 ? (
            <div>
              <p className="font-medium text-foreground">Authorities cited</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {data.citations.map((citation) => (
                  <li key={`${citation.source_id}:${citation.rationale}`}>
                    <span className="font-mono text-xs">{citation.source_id}</span> — {citation.rationale}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs">{data.disclaimer}</p>
          <p className="text-xs">No cost effect — hints never change the estimate total.</p>
        </div>
      </details>
    </section>
  );
}
