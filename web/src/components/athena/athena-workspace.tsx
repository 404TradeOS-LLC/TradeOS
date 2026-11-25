"use client";

import { FormEvent, Fragment, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ATHENA_ESTIMATE_DRAFT_KEY, makeAthenaEstimateDraft } from "@/lib/athena-estimate-handoff";
import { AthenaConfirmationCard, type SaveJobNoteResult } from "./athena-confirmation-card";

interface JobWriteTarget {
  jobId: string;
  jobNumber: string;
  jobTitle: string;
}

interface AthenaWorkspaceProps {
  selectedScope?: AthenaSelectedScope;
  compact?: boolean;
  canCreateEstimate?: boolean;
  estimateHandoffIdentity?: string | null;
  /** Job-scoped mode (DES-4 Option A): enables the Confirm Write flow for
   *  saving a result as a job note. Absent on /athena and Today. */
  jobWriteTarget?: JobWriteTarget;
  /** Performs the job note write (POST /api/v1/jobs/:jobId/notes via the
   *  authenticated proxy). Supplied by the job route's client wrapper; the
   *  workspace itself never fetches. */
  onSaveJobNote?: (body: string) => Promise<SaveJobNoteResult>;
  /** Real record details for the context rail, keyed by scope-row label
   *  ("Job", "Customer", "Project", "Change order", "Estimate",
   *  "Field notes"). Overrides the generic "attached" copy. */
  scopeDetails?: Record<string, string>;
  /** Job-specific starter prompts; defaults to the generic STARTERS. */
  starters?: readonly string[];
  /** Whether the actor may review Athena approvals (owner/admin). Controls
   *  the approvals-queue link on an awaiting_approval result. */
  canReviewApprovals?: boolean;
  /** Sheet mode (DES-4 mobile context sheet, frame 289:165): pin the composer
   *  to the bottom of the sheet's scroll container instead of the page. */
  stickyComposer?: boolean;
  /** Composer placeholder override; defaults to the scope-aware copy. The
   *  job route uses the frame's "Ask about this job…" wording. */
  composerPlaceholder?: string;
}

interface ConversationTurn {
  id: number;
  role: "user" | "athena" | "error";
  text: string;
  result?: AthenaKernelResult;
  /** False for a verbatim starter prompt: starters are real chat requests,
   *  not contractor-authored scope, so they can never be added to the
   *  estimate notes. */
  canAddToEstimate?: boolean;
}

interface ContractorNote {
  id: number;
  text: string;
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

function scopeRows(scope?: AthenaSelectedScope, details?: Record<string, string>) {
  const rows: Array<{ label: string; detail: string }> = [];
  if (scope?.jobId) rows.push({ label: "Job", detail: details?.Job ?? "Selected Job attached" });
  if (scope?.projectId) rows.push({ label: "Project", detail: details?.Project ?? "Owning Project attached" });
  if (scope?.customerId) rows.push({ label: "Customer", detail: details?.Customer ?? "Customer attached" });
  // Canonical rail order (Figma 289:2): Job, Customer, Change order,
  // Estimate. The row renders only when the route supplies a change order
  // detail — like "Field notes", it is details-gated, not scope-gated.
  if (details?.["Change order"]) rows.push({ label: "Change order", detail: details["Change order"] });
  if (scope?.estimateId) rows.push({ label: "Estimate", detail: details?.Estimate ?? "Estimate attached" });
  if (scope?.invoiceId) rows.push({ label: "Invoice", detail: details?.Invoice ?? "Invoice attached" });
  if (scope?.page) rows.push({ label: "Page", detail: details?.Page ?? "Current TradeOS page attached" });
  if (details?.["Field notes"]) rows.push({ label: "Field notes", detail: details["Field notes"] });
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

function ResultCard({
  result,
  jobWriteTarget,
  canReviewApprovals = false,
  onRequestSaveNote,
}: {
  result: AthenaKernelResult;
  jobWriteTarget?: JobWriteTarget;
  canReviewApprovals?: boolean;
  onRequestSaveNote?: (summary: string) => void;
}) {
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
            {result.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="flex gap-2">
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

      {result.state === "succeeded" && jobWriteTarget && onRequestSaveNote && result.summary.trim().length > 0 ? (
        <div className="mt-4 border-t border-border/60 pt-4">
          <Button type="button" size="sm" variant="outline" onClick={() => onRequestSaveNote(result.summary)}>
            Save as job note
          </Button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Review the note before it is saved. Nothing is written until you confirm it.
          </p>
        </div>
      ) : null}

      {result.state === "awaiting_approval" ? (
        <AthenaConfirmationCard
          mode="awaiting-approval"
          summary={result.summary}
          jobNumber={jobWriteTarget?.jobNumber}
          canReviewApprovals={canReviewApprovals}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground">
        <span>Trace {result.traceId.slice(0, 8)}</span>
        <span>Execution {result.executionId.slice(0, 8)}</span>
      </div>
    </article>
  );
}

export function AthenaWorkspace({
  selectedScope,
  compact = false,
  canCreateEstimate = false,
  estimateHandoffIdentity = null,
  jobWriteTarget,
  onSaveJobNote,
  scopeDetails,
  starters,
  canReviewApprovals = false,
  stickyComposer = false,
  composerPlaceholder,
}: AthenaWorkspaceProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [contractorNotes, setContractorNotes] = useState<ContractorNote[]>([]);
  const [selectedStarter, setSelectedStarter] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [retrySubmission, setRetrySubmission] = useState<RetrySubmission | null>(null);
  const [pendingNote, setPendingNote] = useState<{ turnId: number; draft: string } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const nextTurnIdRef = useRef(1);
  const scoped = scopeRows(selectedScope, scopeDetails);

  // Tracks a note POST while it is in flight. A new chat request replaces
  // the visible exchange (and its confirmation card), so submitting during a
  // save would unmount the card mid-flight and lose its error and draft.
  // The composer stays disabled until the save completes, then normal
  // replacement resumes.
  const saveJobNote = useCallback(
    async (body: string): Promise<SaveJobNoteResult> => {
      if (!onSaveJobNote) return { ok: false as const, error: "Saving is unavailable." };
      setIsSavingNote(true);
      try {
        return await onSaveJobNote(body);
      } finally {
        setIsSavingNote(false);
      }
    },
    [onSaveJobNote]
  );

  const prepareEstimate = () => {
    if (!canCreateEstimate || !estimateHandoffIdentity) return;
    const payload = makeAthenaEstimateDraft(
      contractorNotes.map((note) => note.text),
      Date.now(),
      estimateHandoffIdentity
    );
    if (!payload) {
      setHandoffError("These notes exceed the 4,000-character limit or are empty. Edit or remove a note below before retrying.");
      return;
    }
    try {
      // One-tab and short-lived. The receiving form consumes and removes this
      // data. No business record is saved by preparing the handoff.
      window.sessionStorage.setItem(ATHENA_ESTIMATE_DRAFT_KEY, payload);
      setHandoffError(null);
      router.push("/projects/new?intent=estimate#simpleScope");
    } catch {
      setHandoffError("This browser blocked the transfer. Open Create → Estimate and paste your notes manually.");
    }
  };

  const editNote = (id: number, text: string) => {
    setContractorNotes((current) => current.map((note) => note.id === id ? { ...note, text } : note));
    setHandoffError(null);
  };

  const removeNote = (id: number) => {
    setContractorNotes((current) => current.filter((note) => note.id !== id));
    setHandoffError(null);
  };

  // 2026-11-25 draft-refusal regression (production side effect): every
  // typed message used to auto-append to the estimate notes, so plain
  // questions ("What's on my schedule today?") landed in the Estimate
  // handoff panel as Estimate notes 1-3. Notes are now added only by an
  // explicit tap on the message itself - asking a question never creates
  // scope. A note added twice is a no-op (same turn id).
  const addNote = (turn: ConversationTurn) => {
    if (!canCreateEstimate || !estimateHandoffIdentity || turn.canAddToEstimate === false) return;
    setContractorNotes((current) => (current.some((note) => note.id === turn.id) ? current : [...current, { id: turn.id, text: turn.text }]));
    setHandoffError(null);
  };

  const submitMessage = async (
    message: string,
    options: { idempotencyKey?: string; addUserTurn?: boolean } = {}
  ) => {
    const trimmed = message.trim();
    if (!trimmed || isSending || isSavingNote) return;

    const idempotencyKey = options.idempotencyKey ?? createAthenaIdempotencyKey();
    // A new request replaces the visible exchange, so a pending note draft
    // for the previous result closes with it.
    setPendingNote(null);

    if (options.addUserTurn !== false) {
      const userId = nextTurnIdRef.current++;
      // Starter prompts are real chat requests, not contractor-authored
      // scope. A verbatim starter records canAddToEstimate false so its
      // turn never offers the estimate-notes action.
      setTurns([{ id: userId, role: "user", text: trimmed, canAddToEstimate: trimmed !== selectedStarter }]);
      setSelectedStarter(null);
      setHandoffError(null);
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
    <div className={cn("mx-auto grid w-full", compact ? "max-w-none gap-3" : "max-w-5xl gap-5")}>
      {!compact ? (
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Athena</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Work with the context TradeOS already knows.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ask from the whole business or attach a TradeOS record. Athena should resolve toward real work, drafts, recommendations, or explicit next actions.
          </p>
        </div>
      </header>
      ) : null}

      {canCreateEstimate && estimateHandoffIdentity && contractorNotes.length > 0 ? (
        <section aria-label="Estimate handoff" className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Start an estimate from your notes</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Transfers only the notes you add into the existing Project scope form for review.
                Athena replies and other questions are not verified scope or preserved conversation memory.
              </p>
            </div>
            <Button type="button" onClick={prepareEstimate} disabled={isSending}>
              Review as estimate <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-4 grid gap-3">
            <p className="text-xs text-muted-foreground">
              Review and edit the notes selected for the scope. Only these notes move to the Project form.
              { " " }{contractorNotes.map((note) => note.text.trim()).filter(Boolean).join("\n\n").length} / 4,000 characters
            </p>
            {contractorNotes.map((note, index) => (
              <div key={note.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label htmlFor={`athena-note-${note.id}`} className="text-xs font-semibold">
                    Estimate note {index + 1}
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Remove note ${index + 1}`}
                    onClick={() => removeNote(note.id)}
                  >
                    Remove note
                  </Button>
                </div>
                <Textarea
                  id={`athena-note-${note.id}`}
                  aria-label={`Estimate note ${index + 1}`}
                  value={note.text}
                  rows={2}
                  onChange={(event) => editNote(note.id, event.target.value)}
                />
              </div>
            ))}
          </div>
          {handoffError ? <p role="alert" className="mt-3 text-sm text-destructive">{handoffError}</p> : null}
        </section>
      ) : null}

      <div className={cn("grid gap-4", !compact && "xl:grid-cols-[220px_minmax(0,1fr)]")}>
        {!compact ? <aside className="grid content-start gap-4">
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
              {(starters ?? STARTERS).map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => {
                    setDraft(starter);
                    setSelectedStarter(starter);
                  }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <span>{starter}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </aside> : null}

        <section aria-labelledby="athena-workspace-heading" className="min-w-0 rounded-2xl border border-border/70 bg-card">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <h2 id="athena-workspace-heading" className="font-heading text-lg font-semibold">Athena Workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell me what you’re trying to build or fix, and I’ll turn it into TradeOS work.</p>
            <p className="mt-1 text-xs text-muted-foreground">Each submission is independent in this build; include the detail Athena needs in each request.</p>
          </div>

          <div className={cn("grid content-start gap-4 p-4 sm:p-5", compact ? "min-h-0" : "min-h-[28rem]")} aria-live="polite">
            {turns.length === 0 ? (
              compact ? null : <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 text-center">
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
                  <Fragment key={turn.id}>
                    <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-sm leading-6 text-background">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-background/65">You</p>
                      {turn.text}
                    </div>
                    {canCreateEstimate && estimateHandoffIdentity && turn.canAddToEstimate ? (
                      <div className="flex justify-end">
                        {contractorNotes.some((note) => note.id === turn.id) ? (
                          <span className="text-xs text-muted-foreground">Added to estimate notes</span>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => addNote(turn)}>
                            Add to estimate notes
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </Fragment>
                ) : turn.role === "error" ? (
                  <div key={turn.id} className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                    {turn.text}
                  </div>
                ) : turn.result ? (
                  <Fragment key={turn.id}>
                    <ResultCard
                      result={turn.result}
                      jobWriteTarget={jobWriteTarget}
                      canReviewApprovals={canReviewApprovals}
                      onRequestSaveNote={
                        jobWriteTarget && onSaveJobNote && pendingNote?.turnId !== turn.id
                          ? (summary) => setPendingNote({ turnId: turn.id, draft: summary })
                          : undefined
                      }
                    />
                    {pendingNote?.turnId === turn.id && jobWriteTarget && onSaveJobNote ? (
                      <AthenaConfirmationCard
                        mode="confirm-write"
                        jobTitle={jobWriteTarget.jobTitle}
                        jobNumber={jobWriteTarget.jobNumber}
                        draft={pendingNote.draft}
                        onConfirm={saveJobNote}
                        onClose={() => setPendingNote(null)}
                      />
                    ) : null}
                  </Fragment>
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

          <form onSubmit={onSubmit} className={cn("border-t border-border/70 bg-card/95 p-4 sm:p-5", !compact && "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] backdrop-blur 2xl:bottom-0", compact && stickyComposer && "sticky bottom-0 backdrop-blur")}>
            <label htmlFor="athena-message" className="sr-only">Ask Athena</label>
            <Textarea
              id="athena-message"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setSelectedStarter(null);
              }}
              placeholder={composerPlaceholder ?? (selectedScope ? "Ask about the selected TradeOS work…" : "Ask Athena about your business or describe work to estimate…")}
              rows={3}
              disabled={isSending || isSavingNote}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Selected scope and your authenticated permissions travel with this request. Prior response text does not.</p>
              <Button type="submit" disabled={isSending || isSavingNote || draft.trim().length === 0}>
                {isSending ? "Working…" : "Send"}
              </Button>
            </div>
          </form>
        </section>

        {!compact ? <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trust</p>
            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-sm font-medium">Selected scope</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{scopeLabel(selectedScope)} request context is sent to the kernel.</p>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-sm font-medium">Write path</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {jobWriteTarget
                    ? "Job notes save only after you confirm them here, through the existing Job note service. Business changes remain behind registered Athena tools and existing service permissions."
                    : "Business changes remain behind registered Athena tools and existing service permissions."}
                </p>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-sm font-medium">Authority</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Customers, Projects, Jobs, estimates, invoices, and other domain services remain the source of truth.</p>
              </div>
            </div>
          </section>

          <section className="border-t border-border/70 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Not exposed by this response</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The chat result does not yet return a provider-by-provider “context used” list. This workspace does not invent one. Degraded context appears only when the kernel reports it.
            </p>
          </section>
        </aside> : null}
      </div>
    </div>
  );
}
