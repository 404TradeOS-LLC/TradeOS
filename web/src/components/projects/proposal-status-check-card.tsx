"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PROPOSAL_STATUS_CHECK_COPY } from "@/lib/proposal-status-check";
import "./proposal-status-check-card.css";

// DES-10 status check: the recovery-guidance card from Figma frames
// 1027:28503 (desktop) / 1027:28547 (mobile), copy verbatim. The guide
// does not fetch or infer a result — the contractor reads the loaded
// list below it. This card renders only after the list is fully loaded
// (the proposals tab is server-rendered, so a render means loaded); while
// the page is loading, the route skeleton shows and this card is absent.
export function ProposalStatusCheckCard({
  projectId,
  projectName,
  customerName,
  estimateLabel,
  match,
}: {
  projectId: string;
  projectName: string;
  customerName: string | null;
  estimateLabel: string | null;
  match: { id: string } | null;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const destination = PROPOSAL_STATUS_CHECK_COPY.destination.replace("{projectId}", projectId);

  return (
    <Card className="proposal-status-check-card border-border/70">
      <CardContent className="space-y-4 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project · Proposals</p>
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-medium outline-none md:text-[26px]">
            {PROPOSAL_STATUS_CHECK_COPY.heading}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{PROPOSAL_STATUS_CHECK_COPY.description}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {projectName}
            {customerName ? ` · ${customerName}` : ""}
          </p>
          {estimateLabel ? <p className="text-sm text-muted-foreground">{estimateLabel}</p> : null}
        </div>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="proposal-status-check-verdict rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
        >
          {match
            ? "This is your draft — open it from the list below. Continue review there; do not create again."
            : "No matching draft in the loaded list."}
        </div>
        <div className="grid gap-3">
          <section aria-label="Destination" className="rounded-lg border border-border/60 p-3.5">
            <h3 className="text-sm font-medium">Destination</h3>
            <p className="mt-1 text-sm text-muted-foreground">{destination}</p>
          </section>
          <section aria-label="Matching draft found" className="rounded-lg border border-border/60 p-3.5">
            <h3 className="text-sm font-medium">Matching draft found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">
                {PROPOSAL_STATUS_CHECK_COPY.matchingDraftFound.heading}
              </strong>
              {` — ${PROPOSAL_STATUS_CHECK_COPY.matchingDraftFound.body}`}
            </p>
          </section>
          <section
            aria-label="No match after the list finishes loading"
            className="rounded-lg border border-border/60 p-3.5"
          >
            <h3 className="text-sm font-medium">No match after the list finishes loading</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">{PROPOSAL_STATUS_CHECK_COPY.noMatch.heading}</strong>
              {` — ${PROPOSAL_STATUS_CHECK_COPY.noMatch.body}`}
            </p>
          </section>
        </div>
        <p className="text-xs text-muted-foreground">Project proposals route</p>
      </CardContent>
    </Card>
  );
}
