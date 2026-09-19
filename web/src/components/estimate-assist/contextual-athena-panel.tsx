"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { clientFetch } from "@/lib/clientApi";

interface ContextualSuggestion {
  id: string;
  kind: "assembly" | "costItem";
  code: string;
  title: string;
  rationale: string;
  quantity: number;
  unit: string;
  confidence: number;
  provenanceStatus: "documented" | "unverified-legacy" | "placeholder";
  resolution: {
    target: { id: string; kind: "assembly" | "costItem"; name: string; code: string; unitOfMeasure: string } | null;
    reason: string;
  };
}

interface SuggestionsResponse {
  suggestions: ContextualSuggestion[];
}

export function ContextualAthenaPanel({
  estimateId,
  scopeOfWork,
  projectId,
}: {
  estimateId: string;
  scopeOfWork: string;
  projectId: string;
}) {
  const [suggestions, setSuggestions] = useState<ContextualSuggestion[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function askAthena() {
    if (!scopeOfWork.trim()) return;
    setState("loading");
    setError(null);
    try {
      const response = await clientFetch<SuggestionsResponse>(`/estimates/${estimateId}/ai-suggestions`, {
        method: "POST",
        body: JSON.stringify({ scopeOfWork: scopeOfWork.trim() }),
      });
      setSuggestions(response.suggestions ?? []);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Athena could not review this scope.");
      setState("error");
    }
  }

  return (
    <section className="border border-primary/30 bg-primary/5 p-4" aria-labelledby="contextual-athena-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id="contextual-athena-heading" className="font-semibold text-foreground">Athena context</h2>
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
            const setupRequired = suggestion.kind === "assembly" && !suggestion.resolution.target;
            return (
              <div key={suggestion.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{suggestion.title}</span>
                  <Badge variant="outline">{suggestion.kind === "assembly" ? "Assembly" : "Cost item"}</Badge>
                  <Badge variant="outline">{suggestion.confidence}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                <div className={cn("text-xs", setupRequired ? "text-warning" : "text-muted-foreground")}>
                  {setupRequired ? "Assembly available — setup required." : suggestion.resolution.target ? `Matched to ${suggestion.resolution.target.name} · ${suggestion.resolution.target.code}` : suggestion.resolution.reason}
                </div>
                {suggestion.provenanceStatus === "placeholder" ? <p className="text-xs text-warning">Pricing evidence is placeholder data; verify before applying.</p> : null}
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
