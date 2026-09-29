"use client";

import { FormEvent, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleSlash2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  describeAthenaClientError,
  isAthenaRetryableClientError,
  sendAthenaMessage,
  type AthenaKernelResult,
  type AthenaKernelState,
  type AthenaSelectedScope,
} from "@/lib/athena-client";
import { cn } from "@/lib/utils";

interface AthenaWorkspaceProps {
  selectedScope?: AthenaSelectedScope;
}

interface ConversationTurn {
  id: number;
  role: "user" | "athena" | "error";
  text: string;
  result?: AthenaKernelResult;
}

interface RetrySubmission {
  message: string;
  idempotencyKey: string;
}

function createAthenaIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `athena-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STARTERS = [
  "Turn a scope into an estimate",
  "Summarize the selected work",
  "Find what needs attention",
  "Draft a follow-up",
] as const;

function scopeLabel(scope?: AthenaSelectedScope) {
  if (scope?.jobId) return "Job scoped";
  if (scope?.estimateId) return "Estimate scoped";
  if (scope?.invoiceId) return "Invoice scoped";
  if (scope?.customerId) return "Customer scoped";
  if (scope?.projectId) return "Project scoped";
  return "Whole business";
}

function scopeRows(scope?: AthenaSelectedScope) {
  const rows: Array<{ label: string; detail: string }> = [];
  if (scope?.jobId) rows.push({ label: "Job", detail: "Selected Job attached" });
  if (scope?.projectId) rows.push({ label: "Project", detail: "Owning Project attached" });
  if (scope?.customerId) rows.push({ label: "Customer", detail: "Customer attached" });
  if (scope?.estimateId) rows.push({ label: "Estimate", detail: "Estimate attached" });
  if (scope?.invoiceId) rows.push({ label: "Invoice", detail: "Invoice attached" });
  if (scope?.page) rows.push({ label: "Page", detail: "Current TradeOS page attached" });
  if (rows.length === 0) rows.push({ label: "Business", detail: "No record selected" });
  return rows;
}

function statePresentation(state: AthenaKernelState) {
  switch (state) {
    case "succeeded":
      return { label: "Context ready", icon: CheckCircle2, className: "border-success/30 bg-success/10 text-success" };
    case "partially_succeeded":
      return { label: "Partially complete", icon: AlertTriangle, className: "border-warning/30 bg-warning/10 text-warning" };
    case "needs_clarification":
      return { label: "Needs one answer", icon: Sparkles, className: "border-primary/30 bg-primary/10 text-primary" };
    case "awaiting_approval":
      return { label: "Confirmation required", icon: AlertTriangle, className: "border-warning/30 bg-warning/10 text-warning" };
    case "degraded":
      return { label: "Some context unavailable", icon: AlertTriangle, className: "border-warning/30 bg-warning/10 text-warning" };
    case "denied":
      return { label: "Not permitted", icon: CircleSlash2, className: "border-destructive/30 bg-destructive/10 text-destructive" };
    case "failed":
    case "expired":
    case "cancelled":
      return { label: "Not completed", icon: CircleSlash2, className: "border-destructive/30 bg-destructive/10 text-destructive" };
    default:
      return { label: "Working state", icon: Sparkles, className: "border-border bg-muted/50 text-muted-foreground" };
  }
}

function ResultCard({ result }: { result: AthenaKernelResult }) {
  const presentation = statePresentation(result.state);
  const StateIcon = presentation.icon;
  const detail = result.message && result.message !== result.summary ? result.message : null;
  const visibleFollowUps =
    result.state === "needs_clarification"
      ? result.followUps.filter((followUp) => followUp.kind === "question").slice(0, 1)
      : result.followUps;

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">✦ Understanding</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", presentation.className)}>
          <StateIcon className="size-3.5" aria-hidden="true" />
          {presentation.label}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-foreground sm:text-[15px]">{result.summary}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p> : null}

      {result.warnings.length > 0 ? (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">What Athena could not fully verify</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
            {result.warnings.map((warning, index) => (\n              <li key={`${warning.code}-${index}`} className="flex gap-2">
                <span aria-hidden="true">—</span>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {visibleFollowUps.length > 0 ? (
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {result.state === "needs_clarification" ? "Missing detail" : "Recommended next"}
          </p>
          <ul className="mt-2 grid gap-2 text-sm text-foreground">
            {visibleFollowUps.map((followUp, index) => (
              <li key={`${followUp.kind}-${index}`} className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                {followUp.label}
              </li>
            ))}
          </ul>
          {result.state === "needs_clarification" ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              This Workspace does not yet carry prior response context into the next request. Start a new request with this missing detail included.
            </p>
          ) : null}
        </div>
      ) : null}

      {result.state === "awaiting_approval" ? (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-muted-foreground">
          Athena requires confirmation before this action can continue. The contractor confirmation card is not connected in this workspace yet, so this screen does not simulate approval or perform a direct write.
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground">
        <span>Trace {result.traceId.slice(0, 8)}</span>
        <span>Execution {result.executionId.slice(0, 8)}</span>
      </div>
    </article>
  );
}

export function AthenaWorkspace({ selectedScope }: AthenaWorkspaceProps) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [retrySubmission, setRetrySubmission] = useState<RetrySubmission | null>(null);
  const nextTurnIdRef = useRef(1);
  const scoped = scopeRows(selectedScope);

  const submitMessage = async (
    message: string,
    options: { idempotencyKey?: string; addUserTurn?: boolean } = {}
  ) => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    const idempotencyKey = options.idempotencyKey ?? createAthenaIdempotencyKey();

    if (options.addUserTurn !== false) {
      const userId = nextTurnIdRef.current++;
      setTurns([{ id: userId, role: "user", text: trimmed }]);
    } else {
      // A retry belongs to the same single request/result exchange. Remove the
      // prior transport error before replaying the same idempotent request.
      setTurns((current) => current.filter((turn) => turn.role === "user"));
    }
    setRetrySubmission(null);
    setDraft("");
    setIsSending(true);

    try {
      const result = await sendAthenaMessage({
        message: trimmed,
        selectedScope,
        channel: "text",
        viewportClass: typeof window !== "undefined" && window.innerWidth < 768 ? "compact" : "regular",
        idempotencyKey,
      });
      const resultId = nextTurnIdRef.current++;
      setTurns((current) => [...current, { id: resultId, role: "athena", text: result.summary, result }]);
      // A typed terminal envelope means the backend outcome is known. Do not
      // replay that recorded result with the same idempotency key. Same-key
      // retry is reserved for thrown transport/runtime failures where the
      // server outcome is genuinely ambiguous.
    } catch (error) {
      // Preserve the same request key only when the outcome is genuinely
      // ambiguous/retryable. Validation, auth, feature-disabled, and conflict
      // responses require a changed input/session/deployment state instead.
      if (isAthenaRetryableClientError(error)) {
        setRetrySubmission({ message: trimmed, idempotencyKey });
      } else {
        setRetrySubmission(null);
      }
      const errorId = nextTurnIdRef.current++;
      setTurns((current) => [...current, { id: errorId, role: "error", text: describeAthenaClientError(error) }]);
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage(draft);
  };

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Athena</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Work with the context TradeOS already knows.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ask from the whole business or attach a TradeOS record. Athena should resolve toward real work, drafts, recommendations, or explicit next actions.
          </p>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected context</p>
              <Badge variant="outline">{scopeLabel(selectedScope)}</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {scoped.map((row) => (
                <div key={row.label} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Start something</p>
            <div className="mt-3 grid gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => setDraft(starter)}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <span>{starter}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section aria-labelledby="athena-workspace-heading" className="min-w-0 rounded-2xl border border-border/70 bg-card">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <h2 id="athena-workspace-heading" className="font-heading text-lg font-semibold">Athena Workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell me what you’re trying to build or fix, and I’ll turn it into TradeOS work.</p>
            <p className="mt-1 text-xs text-muted-foreground">Each submission is independent in this build; include the detail Athena needs in each request.</p>
          </div>

          <div className="grid min-h-[28rem] content-start gap-4 p-4 sm:p-5" aria-live="polite">
            {turns.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold">Start with the work, not AI settings.</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Describe the job, ask what needs attention, or request a draft. Athena will use the authenticated TradeOS kernel and existing business-tool boundaries.
                </p>
              </div>
            ) : (
              turns.map((turn) =>
                turn.role === "user" ? (
                  <div key={turn.id} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-sm leading-6 text-background">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-background/65">You</p>
                    {turn.text}
                  </div>
                ) : turn.role === "error" ? (
                  <div key={turn.id} className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                    {turn.text}
                  </div>
                ) : turn.result ? (
                  <ResultCard key={turn.id} result={turn.result} />
                ) : null
              )
            )}

            {retrySubmission && !isSending ? (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4" role="alert">
                <p className="text-sm font-medium text-foreground">This request is safe to retry.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The original request key is preserved so Athena can reconcile the same operation instead of creating a duplicate.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    void submitMessage(retrySubmission.message, {
                      idempotencyKey: retrySubmission.idempotencyKey,
                      addUserTurn: false,
                    })
                  }
                >
                  Retry safely
                </Button>
              </div>
            ) : null}

            {isSending ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Athena is working in TradeOS context…</span>
                <span className="ml-2">No optimistic business-state change is shown before the kernel returns.</span>
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] border-t border-border/70 bg-card/95 p-4 backdrop-blur sm:p-5 2xl:bottom-0">
            <label htmlFor="athena-message" className="sr-only">Ask Athena</label>
            <Textarea
              id="athena-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={selectedScope ? "Ask about the selected TradeOS work…" : "Ask Athena about your business or describe work to estimate…"}
              rows={3}
              disabled={isSending}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Selected scope and your authenticated permissions travel with this request. Prior response text does not.</p>
              <Button type="submit" disabled={isSending || draft.trim().length === 0}>
                {isSending ? "Working…" : "Send"}
              </Button>
            </div>
          </form>
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trust</p>
            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-sm font-medium">Selected scope</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{scopeLabel(selectedScope)} request context is sent to the kernel.</p>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-sm font-medium">Write path</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Business changes remain behind registered Athena tools and existing service permissions.</p>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-sm font-medium">Authority</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Customers, Projects, Jobs, estimates, invoices, and other domain services remain the source of truth.</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Not exposed by this response</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The chat result does not yet return a provider-by-provider “context used” list. This workspace does not invent one. Degraded context appears only when the kernel reports it.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
