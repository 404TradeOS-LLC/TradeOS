"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { clientFetch } from "@/lib/clientApi";

interface ContextualSuggestion {
  draftLineItemId: string;
  targetKind: "assembly" | "costItem";
  targetCode: string | null;
  description: string;
  rationale: string;
  quantity: number;
  unitOfMeasure: string;
  confidence: number;
  provenanceStatus: "documented" | "unverified-legacy" | "placeholder";
  targetResolution: {
    target: { id: string; kind: "assembly" | "costItem"; name: string; code: string; unitOfMeasure: string } | null;
    reason: string;
  };
}

interface SuggestionsResponse {
  lineItems: ContextualSuggestion[];
  validation?: { status: string; warnings: string[]; missingInformation: string[] };
}

export function ContextualAthenaPanel({
  estimateId,
  scopeOfWork,
  projectId,
  headingId = "contextual-athena-heading",
}: {
  estimateId: string;
  scopeOfWork: string;
  projectId: string;
  headingId?: string;
}) {
  const [suggestions, setSuggestions] = useState<ContextualSuggestion[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function askAthena() {
    if (!scopeOfWork.trim()) return;
    setState("loading");
    setError(null);
    try {
      const response = await clientFetch<SuggestionsResponse>(`/estimates/${estimateId}/ai-estimator/draft`, {
        method: "POST",
        body: JSON.stringify({ scopeOfWork: scopeOfWork.trim() }),
      });
      setSuggestions(response.lineItems ?? []);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Athena could not review this scope.");
      setState("error");
    }
  }

  return (
    <section className="border border-primary/30 bg-primary/5 p-4" aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id={headingId} className="font-semibold text-foreground">Athena context</h2>
            <p className="mt-1 text-sm text-muted-foreground">Suggest assemblies and Costbook matches from this scope. Nothing is added until you review it.</p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={askAthena} disabled={state === "loading" || !scopeOfWork.trim()}>
          {state === "loading" ? "Reviewing…" : state === "ready" ? "Refresh" : "Ask Athena"}
        </Button>
      </div>

      {!scopeOfWork.trim() ? <p className="mt-3 text-sm text-muted-foreground">Add a short scope to unlock suggestions.</p> : null}

      {error ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {state === "ready" && suggestions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No confident Costbook matches yet. Review the scope or add a custom line.</p> : null}

      {suggestions.length > 0 ? (
        <div className="mt-4 divide-y divide-primary/20 border-t border-primary/20">
          {suggestions.slice(0, 4).map((suggestion) => {
            const setupRequired = !suggestion.targetResolution.target;
            return (
              <div key={suggestion.draftLineItemId} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{suggestion.description}</span>
                  <Badge variant="outline">{suggestion.targetKind === "assembly" ? "Assembly" : "Cost item"}</Badge>
                  <Badge variant="outline">{suggestion.confidence}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                <div className={cn("text-xs", setupRequired ? "text-warning" : "text-muted-foreground")}>
                  {setupRequired ? "Target setup required before applying." : suggestion.targetResolution.target ? `Matched to ${suggestion.targetResolution.target.name} · ${suggestion.targetResolution.target.code}` : suggestion.targetResolution.reason}
                </div>
                {suggestion.provenanceStatus === "placeholder" ? <p className="text-xs text-warning">Pricing evidence is placeholder data; verify before applying.</p> : suggestion.provenanceStatus === "unverified-legacy" ? <p className="text-xs text-warning">Unverified pricing — confirm the Costbook source before applying.</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <Link href={`/projects/${projectId}/estimates/${estimateId}/assist`} className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">
        Open full review workspace →
      </Link>
    </section>
  );
}
