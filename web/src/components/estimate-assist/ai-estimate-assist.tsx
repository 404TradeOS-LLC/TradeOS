"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Layers3,
  Lightbulb,
  Mic,
  Paperclip,
  RefreshCw,
  Search,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AIEstimateSuggestion, KnowledgeScopeMatch, KnowledgeSearchResult, KnowledgeStats, KnowledgeTrade } from "@/lib/api";
import { clientFetch } from "@/lib/clientApi";

type SuggestionStatus = "pending" | "accepted" | "rejected";

interface EstimateTargetOption {
  id: string;
  kind: "assembly" | "costItem";
  code: string;
  name: string;
  unitOfMeasure: string;
  matchMethod?: "id" | "exact-name" | "contains-name";
  matchScore?: number;
}

interface SuggestionDraft extends AIEstimateSuggestion {
  status: SuggestionStatus;
  description: string;
  selectedTarget: EstimateTargetOption | null;
}

interface ApplySuggestionsResponse {
  applied: Array<{ suggestionId: string; lineItemId: string; title: string; quantity: number }>;
  skipped: Array<{ suggestionId: string; title: string; status: SuggestionStatus; reason: string }>;
}

const EXAMPLE_PROMPTS = [
  "Replace 28 squares of architectural shingles, synthetic underlayment, ridge vent, and chimney flashing on a two-story house.",
  "Build a 12x16 pressure-treated deck with stairs, guard rails, and concrete footings.",
  "Remove a 60 foot oak tree, grind the stump, and haul away debris.",
];

function matchMethodLabel(matchMethod: "id" | "exact-name" | "contains-name") {
  if (matchMethod === "id") return "Matched by exact ID";
  if (matchMethod === "exact-name") return "Matched by exact name";
  return "Matched by partial name";
}

function confidenceTone(confidence: number) {
  if (confidence >= 90) return "default";
  if (confidence >= 80) return "secondary";
  return "outline";
}

function toDraft(suggestion: AIEstimateSuggestion): SuggestionDraft {
  return {
    ...suggestion,
    status: "pending",
    description: suggestion.title,
    selectedTarget: suggestion.resolution.target
      ? {
          id: suggestion.resolution.target.id,
          kind: suggestion.resolution.target.kind,
          code: suggestion.resolution.target.code,
          name: suggestion.resolution.target.name,
          unitOfMeasure: suggestion.resolution.target.unitOfMeasure,
          matchMethod: suggestion.resolution.target.matchMethod,
          matchScore: suggestion.resolution.target.matchScore,
        }
      : null,
  };
}

export function AIEstimateAssist({
  projectId,
  estimateId,
  initialScopeOfWork,
  initialSuggestions,
  initialKnowledgeStats,
  initialKnowledgeTrades,
  initialKnowledgeMatch,
}: {
  projectId: string;
  estimateId: string;
  initialScopeOfWork: string;
  initialSuggestions: AIEstimateSuggestion[];
  initialKnowledgeStats: KnowledgeStats | null;
  initialKnowledgeTrades: KnowledgeTrade[];
  initialKnowledgeMatch: KnowledgeScopeMatch | null;
}) {
  const [scopeOfWork, setScopeOfWork] = useState(initialScopeOfWork || "");
  const [suggestions, setSuggestions] = useState<SuggestionDraft[]>(initialSuggestions.map(toDraft));
  const [knowledgeMatch, setKnowledgeMatch] = useState<KnowledgeScopeMatch | null>(initialKnowledgeMatch);
  const [searchMode, setSearchMode] = useState<"assemblies" | "cost-items">("assemblies");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(
    initialSuggestions.length > 0 ? "Loaded from AI suggestion service" : null
  );
  const [applySummary, setApplySummary] = useState<ApplySuggestionsResponse | null>(null);

  const reviewStats = useMemo(() => {
    const accepted = suggestions.filter((suggestion) => suggestion.status === "accepted");
    const rejected = suggestions.filter((suggestion) => suggestion.status === "rejected");
    const pending = suggestions.filter((suggestion) => suggestion.status === "pending");
    const acceptedReady = accepted.filter((suggestion) => suggestion.selectedTarget);
    const acceptedNeedsResolution = accepted.filter((suggestion) => !suggestion.selectedTarget);

    return {
      acceptedCount: accepted.length,
      acceptedReadyCount: acceptedReady.length,
      acceptedNeedsResolutionCount: acceptedNeedsResolution.length,
      rejectedCount: rejected.length,
      pendingCount: pending.length,
      averageConfidence:
        suggestions.length === 0
          ? 0
          : suggestions.reduce((sum, suggestion) => sum + suggestion.confidence, 0) / suggestions.length,
    };
  }, [suggestions]);

  const regenerateSuggestions = useMutation({
    mutationFn: async () => {
      return clientFetch<{ scopeOfWork: string; suggestions: AIEstimateSuggestion[]; knowledgeMatch: KnowledgeScopeMatch }>(
        `/estimates/${estimateId}/ai-suggestions`,
        {
          method: "POST",
          body: JSON.stringify({ scopeOfWork }),
        }
      );
    },
    onSuccess: (payload) => {
      setSuggestions(payload.suggestions.map(toDraft));
      setKnowledgeMatch(payload.knowledgeMatch);
      setScopeOfWork(payload.scopeOfWork);
      setLastGeneratedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      setApplySummary(null);
    },
  });

  const searchKnowledge = useMutation({
    mutationFn: async () => {
      if (!searchQuery.trim()) return [];
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        type: searchMode === "assemblies" ? "assembly" : "costItem",
        limit: "8",
      });
      return clientFetch<KnowledgeSearchResult[]>(`/knowledge/search?${params.toString()}`);
    },
    onSuccess: (payload) => {
      setSearchResults(payload);
    },
  });

  const applyAcceptedSuggestions = useMutation({
    mutationFn: () =>
      clientFetch<ApplySuggestionsResponse>(`/estimates/${estimateId}/ai-suggestions/apply`, {
        method: "POST",
        body: JSON.stringify({
          suggestions: suggestions.map((suggestion) => ({
            id: suggestion.id,
            kind: suggestion.kind,
            title: suggestion.title,
            quantity: suggestion.quantity,
            status: suggestion.status,
            description: suggestion.description,
            targetId: suggestion.selectedTarget?.id,
            targetKind: suggestion.selectedTarget?.kind,
          })),
        }),
      }),
    onSuccess: (payload) => {
      setApplySummary(payload);
    },
  });

  const updateSuggestion = (id: string, updater: (current: SuggestionDraft) => SuggestionDraft) => {
    setSuggestions((current) => current.map((suggestion) => (suggestion.id === id ? updater(suggestion) : suggestion)));
  };

  const acceptedReadyToApply = reviewStats.acceptedReadyCount > 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <div className="space-y-6">
        <Card className="border-border/70 bg-muted/10">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Scope of work</CardTitle>
                <CardDescription>Describe the job once, then let AI draft a reviewed starting point for the estimate team.</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <Sparkles className="size-3.5" />
                Review draft only
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={scopeOfWork}
              onChange={(event) => setScopeOfWork(event.target.value)}
              placeholder="Describe the work, materials, constraints, access, demolition, finish details, and anything field notes already confirmed..."
              className="min-h-40 resize-y bg-background/80 text-base"
            />

            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setScopeOfWork(prompt)}
                  className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-electric/40 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Mic className="size-4 text-electric" />
                  Voice note workflow
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Typed scopes work now, and dictated field notes can be pasted into intake transcripts before review.
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/80 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Paperclip className="size-4 text-electric" />
                  Photo context
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Jobsite photos can stay attached to the project record while AI Estimate Assist uses scope and field notes for reviewed suggestions.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Leave the scope blank if needed. We will fall back to the project scope or the seeded sample scope for validation.
              </p>
              <Button onClick={() => regenerateSuggestions.mutate()} disabled={regenerateSuggestions.isPending}>
                {regenerateSuggestions.isPending ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <WandSparkles className="size-4" />
                    Run AI Estimate Assist
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>AI suggestion pipeline</CardTitle>
                <CardDescription>
                  Review the detected trade, runtime matches, assumptions, missing inputs, and warnings before anything reaches the estimate.
                </CardDescription>
              </div>
              {knowledgeMatch ? <Badge variant={confidenceTone(knowledgeMatch.confidenceScore)}>{knowledgeMatch.confidenceScore}% confidence</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {knowledgeMatch ? (
              <KnowledgeMatchPanel match={knowledgeMatch} />
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                Run the assist flow to see trade detection, matched assemblies, matched cost items, and estimator warnings.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Human review</CardTitle>
                <CardDescription>Accept, reject, or edit every suggestion. Nothing is committed until you explicitly apply accepted items.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{suggestions.length} suggested</Badge>
                <Badge variant="secondary">{reviewStats.acceptedCount} accepted</Badge>
                <Badge variant="outline">{reviewStats.pendingCount} pending</Badge>
                <Badge variant="destructive">{reviewStats.rejectedCount} rejected</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                No review draft yet. Run AI Estimate Assist to build a contractor-facing draft from the scope.
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onChange={(next) => updateSuggestion(suggestion.id, () => next)}
                  onAccept={() => updateSuggestion(suggestion.id, (current) => ({ ...current, status: "accepted" }))}
                  onReject={() => updateSuggestion(suggestion.id, (current) => ({ ...current, status: "rejected" }))}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <Card className="border-border/70 bg-muted/10">
          <CardHeader>
            <CardTitle>Estimate builder handoff</CardTitle>
            <CardDescription>Accepted suggestions flow into the existing Estimate Engine write path only after review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <SummaryTile label="Accepted and ready" value={String(reviewStats.acceptedReadyCount)} />
              <SummaryTile label="Needs target resolution" value={String(reviewStats.acceptedNeedsResolutionCount)} />
              <SummaryTile label="Average confidence" value={`${Math.round(reviewStats.averageConfidence)}%`} />
              <SummaryTile label="Last generated" value={lastGeneratedAt ?? "Ready"} />
            </div>

            <Button type="button" className="w-full" onClick={() => applyAcceptedSuggestions.mutate()} disabled={applyAcceptedSuggestions.isPending || !acceptedReadyToApply}>
              {applyAcceptedSuggestions.isPending ? "Applying accepted suggestions…" : `Add ${reviewStats.acceptedReadyCount} accepted suggestion${reviewStats.acceptedReadyCount === 1 ? "" : "s"} to estimate`}
            </Button>

            {applyAcceptedSuggestions.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {applyAcceptedSuggestions.error instanceof Error
                  ? applyAcceptedSuggestions.error.message
                  : "Applying suggestions failed. Try again."}
              </p>
            ) : null}

            <p className="text-sm text-muted-foreground">
              Resolved suggestions are added as estimate line items through the existing engine. Unresolved suggestions stay review-only until you map them manually.
            </p>

            {applySummary ? (
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-sm font-medium text-foreground">Latest apply result</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <SummaryTile label="Applied" value={String(applySummary.applied.length)} />
                  <SummaryTile label="Skipped" value={String(applySummary.skipped.length)} />
                </div>
                {applySummary.skipped.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {applySummary.skipped.slice(0, 4).map((entry) => (
                      <div key={`${entry.suggestionId}-${entry.status}`} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{entry.title}</span>
                        <span> · {entry.reason}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-muted/10">
          <CardHeader>
            <CardTitle>Knowledge Engine runtime</CardTitle>
            <CardDescription>Read-only runtime data loaded straight from the migrated package files.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {initialKnowledgeStats ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SummaryTile label="Assemblies" value={String(initialKnowledgeStats.assembliesCount)} />
                <SummaryTile label="Cost items" value={String(initialKnowledgeStats.costItemsCount)} />
                <SummaryTile label="Trades" value={String(initialKnowledgeStats.tradesCount)} />
                <SummaryTile label="Schemas" value={String(initialKnowledgeStats.schemaCount)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Knowledge runtime metadata is unavailable for this session.</p>
            )}
            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Layers3 className="size-4 text-electric" />
                Read-only bridge
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This runtime loads exports, knowledge notes, and schemas without inventing prices or bypassing the estimate engine.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Trade list</CardTitle>
            <CardDescription>Current migrated trade coverage from the Knowledge Engine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {initialKnowledgeTrades.slice(0, 12).map((trade) => (
                <Badge key={trade.id} variant="outline" className="px-3 py-1">
                  {trade.name} · {trade.coverage}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(initialKnowledgeTrades.length, 12)} of {initialKnowledgeTrades.length} runtime trades.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Knowledge search</CardTitle>
            <CardDescription>Inspect read-only runtime matches while you review the draft.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button type="button" variant={searchMode === "assemblies" ? "default" : "outline"} onClick={() => setSearchMode("assemblies")}>
                Assemblies
              </Button>
              <Button type="button" variant={searchMode === "cost-items" ? "default" : "outline"} onClick={() => setSearchMode("cost-items")}>
                Cost items
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Search ${searchMode === "assemblies" ? "assemblies" : "cost items"}...`}
              />
              <Button type="button" variant="outline" onClick={() => searchKnowledge.mutate()} disabled={!searchQuery.trim() || searchKnowledge.isPending}>
                {searchKnowledge.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
                Search
              </Button>
            </div>
            <SearchResultsList results={searchResults} emptyLabel="Run a knowledge search to inspect read-only matches." />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Next step</CardTitle>
            <CardDescription>Jump back into the builder after the reviewed handoff.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href={`/projects/${projectId}/estimates/${estimateId}`} className={cn(buttonVariants({ variant: "outline" }), "justify-start")}>
              Open estimate builder
            </Link>
            <p className="text-sm text-muted-foreground">
              AI helps with scope understanding and selection only. Pricing still comes exclusively from the estimate engine.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onChange,
  onAccept,
  onReject,
}: {
  suggestion: SuggestionDraft;
  onChange: (next: SuggestionDraft) => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [targetSearchMode, setTargetSearchMode] = useState<"assembly" | "costItem">(suggestion.selectedTarget?.kind ?? suggestion.kind);
  const [targetSearchQuery, setTargetSearchQuery] = useState("");
  const [targetSearchResults, setTargetSearchResults] = useState<EstimateTargetOption[]>([]);

  const searchTargets = useMutation({
    mutationFn: async () => {
      if (!targetSearchQuery.trim()) return [];
      const path =
        targetSearchMode === "assembly"
          ? `/assemblies/search?q=${encodeURIComponent(targetSearchQuery.trim())}`
          : `/cost-database/cost-items/search?q=${encodeURIComponent(targetSearchQuery.trim())}`;

      const rows = await clientFetch<Array<{ id: string; name: string; code: string; unitOfMeasure: string }>>(path);
      return rows.map((row) => ({
        id: row.id,
        kind: targetSearchMode,
        code: row.code,
        name: row.name,
        unitOfMeasure: row.unitOfMeasure,
      }));
    },
    onSuccess: (payload) => {
      setTargetSearchResults(payload);
    },
  });

  const statusTone =
    suggestion.status === "accepted"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : suggestion.status === "rejected"
        ? "border-destructive/30 bg-destructive/5"
        : "border-border/70 bg-background/80";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm transition-colors", statusTone)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{suggestion.kind === "assembly" ? "Assembly suggestion" : "Cost item suggestion"}</Badge>
            <Badge variant={confidenceTone(suggestion.confidence)}>{suggestion.confidence}% confidence</Badge>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{suggestion.code}</span>
          </div>
          <div className="space-y-2">
            <Input
              value={suggestion.title}
              onChange={(event) => onChange({ ...suggestion, title: event.target.value, description: event.target.value })}
              aria-label="Suggestion title"
            />
            <p className="max-w-2xl text-sm text-muted-foreground">{suggestion.rationale}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {suggestion.status === "accepted" ? "Accepted" : suggestion.status === "rejected" ? "Rejected" : "Ready to review"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background/90 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estimator edits</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-end">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Quantity</div>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={suggestion.quantity}
                onChange={(event) =>
                  onChange({
                    ...suggestion,
                    quantity: Math.max(0.1, Number(event.target.value || 0.1)),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Estimate description</div>
              <Input
                value={suggestion.description}
                onChange={(event) => onChange({ ...suggestion, description: event.target.value })}
                aria-label="Estimate description"
              />
            </div>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Suggested quantity {formatQuantity(suggestion.quantity)} {suggestion.unit}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/90 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Lightbulb className="size-3.5" />
            Estimate target
          </div>
          {suggestion.selectedTarget ? (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{suggestion.selectedTarget.kind === "assembly" ? "Assembly" : "Cost item"}</Badge>
                {suggestion.selectedTarget.matchScore != null ? <Badge variant="outline">{suggestion.selectedTarget.matchScore}% match</Badge> : null}
                {suggestion.selectedTarget.matchMethod ? <Badge variant="outline">{matchMethodLabel(suggestion.selectedTarget.matchMethod)}</Badge> : null}
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{suggestion.selectedTarget.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {suggestion.selectedTarget.code} · {suggestion.selectedTarget.unitOfMeasure}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
              {suggestion.resolution.reason}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button type="button" variant={targetSearchMode === "assembly" ? "default" : "outline"} onClick={() => setTargetSearchMode("assembly")}>
                Assembly
              </Button>
              <Button type="button" variant={targetSearchMode === "costItem" ? "default" : "outline"} onClick={() => setTargetSearchMode("costItem")}>
                Cost item
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={targetSearchQuery}
                onChange={(event) => setTargetSearchQuery(event.target.value)}
                placeholder={`Search ${targetSearchMode === "assembly" ? "assemblies" : "cost items"} in the estimate database`}
              />
              <Button type="button" variant="outline" onClick={() => searchTargets.mutate()} disabled={!targetSearchQuery.trim() || searchTargets.isPending}>
                {searchTargets.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            {targetSearchResults.length > 0 ? (
              <div className="space-y-2">
                {targetSearchResults.slice(0, 5).map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => onChange({ ...suggestion, selectedTarget: result })}
                    className="w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left transition hover:border-electric/40 hover:bg-muted/40"
                  >
                    <div className="text-sm font-medium text-foreground">{result.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {result.code} · {result.unitOfMeasure}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onAccept} variant={suggestion.status === "accepted" ? "default" : "outline"}>
          <Check className="size-4" />
          Accept
        </Button>
        <Button type="button" onClick={onReject} variant={suggestion.status === "rejected" ? "destructive" : "ghost"}>
          <X className="size-4" />
          Reject
        </Button>
        <Button type="button" variant="ghost" onClick={() => onChange({ ...suggestion, status: "pending" })}>
          Reset
        </Button>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function KnowledgeMatchPanel({ match }: { match: KnowledgeScopeMatch }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Trade: {match.detectedTrade ?? "Needs review"}</Badge>
        <Badge variant={confidenceTone(match.confidenceScore)}>{match.confidenceScore}% confidence</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MatchList title="Matched assemblies" results={match.matchedAssemblies} />
        <MatchList title="Matched cost items" results={match.matchedCostItems} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoList title="Assumptions" items={match.assumptions} emptyLabel="No explicit runtime assumptions were generated." />
        <InfoList title="Missing inputs" items={match.missingInformation} emptyLabel="No obvious missing inputs were detected." />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoList
          title="Review warnings"
          items={match.reviewWarnings}
          emptyLabel="No extra review warnings were generated."
          icon={<AlertTriangle className="size-4 text-amber-500" />}
        />
        <InfoList title="Rationale" items={match.rationale} emptyLabel="No rationale available." />
      </div>
    </div>
  );
}

function MatchList({ title, results }: { title: string; results: KnowledgeSearchResult[] }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-3 space-y-3">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches found.</p>
        ) : (
          results.map((result) => (
            <div key={result.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{result.name}</span>
                <Badge variant="outline">{result.confidence}%</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{result.rationale}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InfoList({
  title,
  items,
  emptyLabel,
  icon,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          items.map((item) => (
            <p key={item} className="text-sm text-muted-foreground">
              {item}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function SearchResultsList({ results, emptyLabel }: { results: KnowledgeSearchResult[]; emptyLabel: string }) {
  if (results.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <div key={result.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{result.name}</span>
            <Badge variant="outline">{result.type === "assembly" ? "Assembly" : "Cost item"}</Badge>
            <Badge variant={confidenceTone(result.confidence)}>{result.confidence}%</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{result.rationale}</p>
        </div>
      ))}
    </div>
  );
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}
