"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { clientFetch } from "@/lib/clientApi";
import type { Estimate, StructuredAIEstimateDraft } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  answerForClarificationChoice,
  buildDraftRequestBody,
  getActiveClarification,
  submitClarification,
} from "./clarification";

type ApplyResponse = {
  applied: Array<{ draftLineItemId: string; lineItemId: string; quantity: number }>;
  skipped: Array<{ draftLineItemId: string; status: string; reason: string }>;
};

export function AthenaEstimatingCopilot({
  estimateId,
  currentRole,
  scopeOfWork,
  estimate,
  onUpdated,
}: {
  estimateId: string;
  currentRole: string | null;
  scopeOfWork: string;
  estimate: Estimate & { lineItems: Array<{ taxable: boolean; lineCost: number }> };
  onUpdated: () => void;
}) {
  const [scope, setScope] = useState(scopeOfWork);
  const [draft, setDraft] = useState<StructuredAIEstimateDraft | null>(null);
  const [draftScope, setDraftScope] = useState("");
  const [applyNotice, setApplyNotice] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);

  const generate = useMutation({
    mutationFn: (scopeToEstimate: string) =>
      clientFetch<StructuredAIEstimateDraft>(`/estimates/${estimateId}/ai-estimator/draft`, {
        method: "POST",
        body: JSON.stringify(buildDraftRequestBody(scopeToEstimate)),
      }),
    onSuccess: (next, submittedScope) => {
      setDraft(next);
      setAcceptedIds(next.lineItems.filter((line) => line.targetId && line.reviewToken).map((line) => line.draftLineItemId));
      setDraftScope(submittedScope.trim());
      setApplyNotice("");
      setActiveQuestion(getActiveClarification(next.validation.missingInformation));
      setAnswer("");
    },
  });

  const apply = useMutation({
    mutationFn: () =>
      clientFetch<ApplyResponse>(`/estimates/${estimateId}/ai-estimator/apply`, {
        method: "POST",
        body: JSON.stringify({
          // Generation-linked review provenance is limited by the backend to
          // owner/admin. Dispatchers retain their existing billing.write apply.
          ...((currentRole === "owner" || currentRole === "admin") && draft?.generationId ? { generationId: draft.generationId } : {}),
          lineItems: draft?.lineItems
            .filter((line) => acceptedIds.includes(line.draftLineItemId) && line.targetId && line.reviewToken)
            .map((line) => ({
              draftLineItemId: line.draftLineItemId,
              quantity: line.quantity,
              status: "accepted",
              description: line.description,
              targetId: line.targetId,
              targetKind: line.targetKind,
              reviewToken: line.reviewToken,
            })) ?? [],
        }),
      }),
    onSuccess: (result) => {
      if (result.skipped.length > 0) {
        setApplyNotice(`${result.applied.length} item(s) added; ${result.skipped.length} skipped: ${result.skipped.map((line) => `${line.draftLineItemId}: ${line.reason}`).join("; ")}`);
      } else {
        setApplyNotice(`${result.applied.length} item(s) added. Review the estimate Items.`);
      }
      onUpdated();
    },
  });

  const preview = useMemo(() => {
    if (!draft) return null;
    const proposedCost = draft.lineItems
      .filter((line) => acceptedIds.includes(line.draftLineItemId) && line.targetId && line.reviewToken)
      .reduce((sum, line) => sum + line.lineCost, 0);
    return { proposedCost, combinedCost: Number(estimate.subtotalCost ?? 0) + proposedCost };
  }, [draft, estimate.subtotalCost, acceptedIds]);

  function acceptQuestion() {
    const nextScope = submitClarification(scope, activeQuestion, answer);
    if (!nextScope) return;
    setScope(nextScope);
    setActiveQuestion(null);
    setAnswer("");
    generate.mutate(nextScope);
  }

  function chooseAnswer(value: string) {
    setAnswer(answerForClarificationChoice(value));
  }

  const questionChoices = activeQuestion ? getQuestionChoices(activeQuestion) : [];
  const resolved = draft?.lineItems.filter((line) => line.targetId && line.reviewToken) ?? [];
  const accepted = resolved.filter((line) => acceptedIds.includes(line.draftLineItemId));
  const assumptions = draft ? [...draft.parsedScope.assumptions, ...draft.validation.missingInformation] : [];
  const exclusions = draft?.parsedScope.exclusions ?? [];
  const canBuild = accepted.length > 0 && estimate.status === "draft" && draftScope === scope.trim() && !generate.isPending && !apply.isPending;

  return (
    <section className="border border-primary/30 bg-primary/5" aria-labelledby="athena-estimating-copilot-heading">
      <div className="border-b border-primary/20 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="athena-estimating-copilot-heading" className="font-semibold text-foreground">Athena estimating copilot</h2>
              <p className="mt-1 text-sm text-muted-foreground">Describe the job naturally. Athena extracts scope, checks TradeOS pricing, and stages the estimate for review.</p>
            </div>
          </div>
          {draft ? <Badge variant="outline">{draft.confidenceScore}% confidence</Badge> : null}
        </div>

        <div className="mt-4">
          <Textarea
            value={scope}
            onChange={(event) => { setScope(event.target.value); setApplyNotice(""); }}
            placeholder="Paint a 2.5-car garage floor. Existing coating is worn. Customer wants tan."
            className="min-h-24 resize-y bg-background text-base"
            aria-label="Contractor job description"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => generate.mutate(scope)} disabled={generate.isPending || !scope.trim()}>
            {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generate.isPending ? "Estimating…" : draft ? "Recalculate" : "Build estimate"}
          </Button>
          <span className="text-xs text-muted-foreground">TradeOS data first · review before anything is added</span>
        </div>
        {generate.isError ? <p className="mt-3 text-sm text-destructive" role="alert">{generate.error instanceof Error ? generate.error.message : "Athena could not build this estimate."}</p> : null}
      </div>

      {draft ? (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {activeQuestion ? (
            <div className="border-b border-primary/20 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">One thing Athena needs</p>
              <p className="mt-2 font-medium text-foreground">{activeQuestion}</p>
              {questionChoices.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {questionChoices.map((choice) => (
                    <Button key={choice} type="button" size="sm" variant={answer === choice ? "default" : "outline"} onClick={() => chooseAnswer(choice)}>
                      {choice}
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Other / answer in plain language…" className="min-h-11 bg-background" />
                <Button type="button" className="shrink-0 self-end" onClick={acceptQuestion} disabled={!answer.trim() || generate.isPending}>
                  Continue <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estimate items</p>
                  <p className="mt-1 text-sm text-muted-foreground">Athena selected existing TradeOS targets. Adjustments happen in the Estimate Workspace.</p>
                </div>
                <Badge variant="secondary">{resolved.length} ready</Badge>
              </div>

              <div className="mt-3 divide-y divide-border/70 border-y border-border/70 bg-background/70">
                {draft.lineItems.length === 0 ? (
                  <p className="px-3 py-5 text-sm text-muted-foreground">No confident TradeOS matches yet.</p>
                ) : draft.lineItems.map((line) => (
                  <div key={line.draftLineItemId} className="flex items-start justify-between gap-4 px-3 py-3">
                    <div className="min-w-0">
                      {line.targetId && line.reviewToken ? <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={acceptedIds.includes(line.draftLineItemId)} onChange={(event) => setAcceptedIds((ids) => event.target.checked ? [...ids, line.draftLineItemId] : ids.filter((id) => id !== line.draftLineItemId))} /> Include in estimate</label> : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{line.description}</span>
                        <Badge variant="outline">{line.targetKind === "assembly" ? "Assembly" : "Costbook"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{line.quantity} {line.unitOfMeasure} · {line.rationale}</p>
                      {line.reviewWarnings.length > 0 ? <p className="mt-1 text-xs text-warning">{line.reviewWarnings[0]}</p> : null}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold">{formatCurrency(line.lineCost)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {preview ? (
                <div className="border border-border/70 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Review</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <ReviewRow label="Selected item cost" value={formatCurrency(preview.proposedCost)} />
                    <ReviewRow label="Cost with saved items" value={formatCurrency(preview.combinedCost)} strong />
                    <p className="text-xs text-muted-foreground">Final sell price, overhead, margin, tax and rounding are calculated by the Estimate Engine after you add the selected items.</p>
                  </div>
                </div>
              ) : null}

              {assumptions.length > 0 ? (
                <div className="border border-border/70 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Assumptions</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">{assumptions.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul>
                </div>
              ) : null}

              {exclusions.length > 0 ? (
                <div className="border border-border/70 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Exclusions</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">{exclusions.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul>
                </div>
              ) : null}
            </div>
          </div>

          {draft.validation.warnings.length > 0 ? (
            <div className="flex items-start gap-2 border-t border-border/70 pt-3 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{draft.validation.warnings.slice(0, 2).join(" · ")}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
            <p className="text-xs text-muted-foreground">Nothing is written to the estimate until you build it.</p>
            <Button type="button" onClick={() => apply.mutate()} disabled={!canBuild}>
              {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {apply.isPending ? "Adding estimate…" : "Add to estimate"}
            </Button>
          </div>
          {apply.isError ? <p className="text-sm text-destructive" role="alert">{apply.error instanceof Error ? apply.error.message : "Athena could not add the reviewed estimate."}</p> : null}
          {applyNotice ? <p className="text-sm text-warning" role="status">{applyNotice}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function ReviewRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono tabular-nums", strong ? "text-lg font-semibold text-primary" : "font-semibold text-foreground")}>{value}</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function getQuestionChoices(question: string): string[] {
  const normalized = question.toLowerCase();
  if (/coating|adhere|peel|flak/.test(normalized)) return ["Mostly adhered", "Peeling / flaking", "Other"];
  if (/brand|paint|finish|material|system/.test(normalized)) return ["Use preferred TradeOS material", "Other"];
  if (/access|two-story|height/.test(normalized)) return ["Standard access", "Difficult access", "Other"];
  if (/repair|damage|crack/.test(normalized)) return ["Minor", "Extensive", "Other"];
  return [];
}
