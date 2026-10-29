"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createProposalAction } from "@/app/actions/proposals";
import { PaymentScheduleFields } from "@/components/proposals/payment-schedule-fields";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Estimate, ProposalDraftPreview } from "@/lib/api";

export function NewProposalForm({
  projectId,
  estimates,
  draft,
  initialEstimateId,
}: {
  projectId: string;
  estimates: Estimate[];
  draft: ProposalDraftPreview;
  initialEstimateId?: string;
}) {
  const [state, formAction, isPending] = useActionState(createProposalAction, undefined);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!state?.error) return;
    errorRef.current?.focus({ preventScroll: true });
    errorRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [state]);
  const eligibleEstimates = estimates.filter((estimate) => estimate.status !== "draft");
  const hasEstimates = eligibleEstimates.length > 0;
  const [selectedEstimateId, setSelectedEstimateId] = useState(initialEstimateId ?? "");
  const selectedEstimate = eligibleEstimates.find((estimate) => estimate.id === selectedEstimateId);

  return (
    <Card className="border-border/70 bg-muted/10">
      <CardHeader>
        <CardTitle>Proposal Draft</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          className="flex flex-col gap-5"
          // Returned validation/API errors are fulfilled actions, so React
          // resets uncontrolled fields. Keep edits; successful creation redirects.
          onReset={(event) => event.preventDefault()}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="estimateId">Estimate</Label>
            <select
              id="estimateId"
              name="estimateId"
              value={selectedEstimate?.id ?? ""}
              onChange={(event) => setSelectedEstimateId(event.target.value)}
              aria-describedby="proposal-price-basis"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{hasEstimates ? "Use project intake only" : "No finalized estimates yet. Use project intake only."}</option>
              {eligibleEstimates.map((estimate) => (
                <option key={estimate.id} value={estimate.id}>
                  v{estimate.version} · {estimate.status} · ${estimate.totalPrice.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input id="companyName" name="companyName" defaultValue={draft.companyName} placeholder="Your Company Name" />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeline">Estimated timeline</Label>
              <Input id="timeline" name="timeline" defaultValue={draft.timeline} placeholder="2 to 5 working days after scheduling" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scopeHint">Proposal approach</Label>
              <Input id="scopeHint" value={hasEstimates ? "AI can draft from intake or estimate context." : "AI will draft from the saved project intake."} readOnly />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <SummaryMetricCard label="Job type" value={draft.normalizedJobType ?? "Needs confirmation"} />
            <SummaryMetricCard label="AI confidence" value={draft.confidenceScore !== null ? `${draft.confidenceScore}%` : "Not scored"} />
            <div role="status" aria-live="polite" aria-atomic="true">
              <SummaryMetricCard
                label={selectedEstimate ? "Proposal price" : "Intake range"}
                value={selectedEstimate ? formatCurrency(selectedEstimate.totalPrice) : `${formatCurrency(draft.priceLow)} - ${formatCurrency(draft.priceHigh)}`}
              />
            </div>
          </div>
          <p id="proposal-price-basis" className="text-sm text-muted-foreground">
            {selectedEstimate
              ? `Uses finalized estimate v${selectedEstimate.version}'s saved total. The proposal draft is created at this fixed price; nothing is sent to the customer.`
              : "Uses the saved project intake range. This form does not set a fixed proposal price; review pricing in the created draft before sending."}
          </p>
          {(draft.missingInfo.length > 0 || draft.aiQuestions.length > 0) && (
            <div className="grid gap-5 md:grid-cols-2">
              <EmptyState
                title="Missing info to close"
                description={draft.missingInfo.length === 0 ? "Nothing critical missing." : ""}
                className="bg-background/70"
                action={
                  draft.missingInfo.length === 0 ? null : (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {draft.missingInfo.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )
                }
              />
              <EmptyState
                title="Suggested follow-up questions"
                description={draft.aiQuestions.length === 0 ? "No open questions from the latest intake." : ""}
                className="bg-background/70"
                action={
                  draft.aiQuestions.length === 0 ? null : (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {draft.aiQuestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )
                }
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="scopeOfWork">Scope of work override</Label>
            <Textarea id="scopeOfWork" name="scopeOfWork" rows={8} defaultValue={draft.scopeOfWork} />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="assumptions">Assumptions override</Label>
              <Textarea id="assumptions" name="assumptions" rows={6} defaultValue={draft.assumptions} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exclusions">Exclusions override</Label>
              <Textarea id="exclusions" name="exclusions" rows={6} defaultValue={draft.exclusions} />
            </div>
          </div>
          <PaymentScheduleFields schedule={draft.paymentSchedule} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showLineItemDetail" />
            Show line-item detail on the proposal
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="termsAndConditions">Terms &amp; conditions</Label>
            <Textarea id="termsAndConditions" name="termsAndConditions" rows={4} />
          </div>
          {state?.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {state.error}
              </p>
              {state.error !== "Each payment row needs a label and percent." && (
                <div className="mt-3 flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    If you cannot confirm whether the draft was created, check this Project’s proposals before trying again.
                  </p>
                  <Link href={`/projects/${projectId}?tab=proposals`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Check Project proposals
                  </Link>
                </div>
              )}
            </div>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create proposal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number | null) {
  if (value === null) return "Not set";
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
