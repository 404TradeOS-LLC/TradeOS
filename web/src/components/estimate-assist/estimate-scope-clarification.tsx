"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientApiError } from "@/lib/clientApi";
import {
  getEstimateScopeClarification,
  saveEstimateScopeClarification,
  type EstimateClarificationAnswer,
  type EstimateScopeClarification,
} from "@/lib/estimate-scope-clarification";

export function ScopeClarificationSummary({ clarification, action }: {
  clarification: EstimateScopeClarification;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{clarification.question}</p>
      {action}
      {clarification.answer?.kind === "details" ? (
        <p className="whitespace-pre-wrap break-words">{clarification.answer.detail}</p>
      ) : (
        <p>{clarification.answer ? "Site-check assumption kept." : "No answer yet."} Footing replacement is unconfirmed — review before pricing replacement.</p>
      )}
    </div>
  );
}

export function EstimateScopeClarificationForm({
  estimateId, initial, onSaved, onBack, onFinalizedBack, onContinue, onBusyChange,
}: {
  estimateId: string;
  initial: EstimateScopeClarification;
  onSaved: (saved: EstimateScopeClarification) => void;
  onBack: () => void;
  onFinalizedBack: () => Promise<void>;
  onContinue: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const inputId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const restoredHeading = useRef<HTMLHeadingElement>(null);
  const finalizedBackButton = useRef<HTMLButtonElement>(null);
  const operationPending = useRef(false);
  const [baseline, setBaseline] = useState(initial);
  const [detail, setDetail] = useState(initial.answer?.kind === "details" ? initial.answer.detail : "");
  const [submitted, setSubmitted] = useState<EstimateClarificationAnswer | null>(null);
  const [status, setStatus] = useState<"editing" | "saving" | "saved" | "refreshing">("editing");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  // A finalized estimate is a different 409 from a revision conflict:
  // the answer can never be saved again, so the form offers a read-only
  // way back instead of the refresh-and-retry recovery.
  const [finalized, setFinalized] = useState(false);
  const [showLatest, setShowLatest] = useState(false);
  const saving = status === "saving";
  const busy = saving || status === "refreshing";

  useEffect(() => { heading.current?.focus(); }, []);

  async function save(answer: EstimateClarificationAnswer) {
    if (operationPending.current || conflict || finalized) return;
    operationPending.current = true;
    onBusyChange(true);
    setStatus("saving");
    setSubmitted(answer);
    setError(null);
    const startedAt = Date.now();
    try {
      const saved = await saveEstimateScopeClarification(estimateId, baseline, answer);
      const remaining = 900 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setBaseline(saved);
      setDetail(saved.answer?.kind === "details" ? saved.answer.detail : "");
      setShowLatest(false);
      setStatus("saved");
      onSaved(saved);
      requestAnimationFrame(() => restoredHeading.current?.focus());
    } catch (cause) {
      const isConflict = cause instanceof ClientApiError && cause.status === 409;
      const isFinalized = isConflict
        && typeof cause.details === "object" && cause.details !== null
        && (cause.details as { code?: unknown }).code === "ESTIMATE_FINALIZED";
      if (isFinalized) {
        setFinalized(true);
        setConflict(false);
        setStatus("editing");
        setError("This estimate was finalized in another session, so this answer can no longer be saved.");
        requestAnimationFrame(() => finalizedBackButton.current?.focus());
      } else {
        setConflict(isConflict);
        setStatus("editing");
        setError(isConflict ? cause.message : "Your answer could not be saved. Your note is still here.");
        requestAnimationFrame(() => input.current?.focus());
      }
    } finally {
      operationPending.current = false;
      onBusyChange(false);
    }
  }

  async function returnToFinalizedScope() {
    if (operationPending.current) return;
    operationPending.current = true;
    onBusyChange(true);
    setStatus("refreshing");
    try {
      await onFinalizedBack();
    } catch {
      setError("Could not reload the finalized estimate. Try returning to Scope again.");
      requestAnimationFrame(() => finalizedBackButton.current?.focus());
    } finally {
      setStatus("editing");
      operationPending.current = false;
      onBusyChange(false);
    }
  }

  async function refresh() {
    if (operationPending.current) return;
    operationPending.current = true;
    onBusyChange(true);
    setStatus("refreshing");
    try {
      const latest = await getEstimateScopeClarification(estimateId);
      if (!latest || latest.questionKey !== baseline.questionKey) {
        setError("This question no longer applies. Return to Scope and check the saved work description.");
        return;
      }
      setBaseline(latest);
      onSaved(latest);
      setConflict(false);
      setError(null);
      setShowLatest(true);
    } catch {
      setError("Could not reload the latest answer. Your note is still here.");
    } finally {
      setStatus("editing");
      operationPending.current = false;
      onBusyChange(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (detail.trim()) void save({ kind: "details", detail });
  }

  return (
    <section className="max-w-md space-y-4 border border-border bg-card p-4 sm:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-180" aria-labelledby={`${inputId}-heading`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
        {saving ? "Athena / Saving answer" : error ? "Athena / Answer not saved" : "Athena / Scope check"}
      </p>
      <h3 ref={heading} tabIndex={-1} id={`${inputId}-heading`} className="font-heading text-2xl font-medium">
        {saving ? "Saving footing details…" : error ? "We couldn’t save that answer." : baseline.question}
      </h3>
      <p className="sr-only" aria-live="polite">
        {status === "saving" ? "Saving clarification." : status === "saved" ? "Clarification saved." : status === "refreshing" ? (finalized ? "Reloading estimate." : "Loading the latest clarification.") : ""}
      </p>
      {status === "saved" ? (
        <div className="space-y-4">
          <h4 ref={restoredHeading} tabIndex={-1} className="font-medium">Answer saved</h4>
          <ScopeClarificationSummary clarification={baseline} />
          <Button className="min-h-11 w-full" onClick={onContinue}>Continue to Items</Button>
          <Button variant="outline" className="min-h-11 w-full" onClick={() => {
            setStatus("editing");
            requestAnimationFrame(() => input.current?.focus());
          }}>Reopen clarification</Button>
          <Button variant="link" className="min-h-11 w-full" onClick={onBack}>Back to scope</Button>
        </div>
      ) : finalized ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground">The estimate is now read-only. Return to Scope to review the saved work.</p>
          <Button ref={finalizedBackButton} type="button" variant="outline" className="min-h-11 w-full" disabled={busy} onClick={() => void returnToFinalizedScope()}>
            {busy ? "Reloading estimate…" : "Back to scope"}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {saving ? "Keep this page open while TradeOS saves your answer." : "This changes whether replacement belongs in your estimate. One answer is enough to continue."}
          </p>
          <div className="space-y-2 border-y border-border py-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
              {saving ? "Saving to estimate" : error ? "Estimate items and pricing" : "Not checked yet"}
            </p>
            <p>{saving || error
              ? "Estimate items and pricing stay the same during an answer save."
              : "Keep footing suitability as a site-check assumption. Replacement stays unconfirmed until a site check — review before pricing it."}</p>
          </div>
          {showLatest ? <div className="space-y-1 rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Latest saved answer</p>
            <ScopeClarificationSummary clarification={baseline} />
          </div> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor={inputId}>Have site-check details?</Label>
              <p id={`${inputId}-example`} className="text-sm text-muted-foreground">Example field note: 24 in × 12 in, sound concrete.</p>
              <Input
                ref={input}
                id={inputId}
                value={detail}
                maxLength={1000}
                aria-describedby={`${inputId}-example`}
                aria-invalid={error !== null}
                className="min-h-11"
                readOnly={busy}
                onChange={(event) => {
                  setDetail(event.target.value);
                  setSubmitted(null);
                }}
              />
            </div>
            {conflict ? (
              <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void refresh()}>
                {status === "refreshing" ? "Loading latest answer…" : "Load latest answer"}
              </Button>
            ) : (
              <>
                <Button type="submit" className="min-h-11 w-full" disabled={busy || !detail.trim()}>
                  {status === "saving" && submitted?.kind === "details" ? "Saving answer…" : error && submitted?.kind === "details" ? "Retry answer save" : "Save answer & continue"}
                </Button>
                <Button type="button" variant="outline" className="min-h-11 w-full whitespace-normal" disabled={busy} onClick={() => void save({ kind: "site_check_assumption" })}>
                  {status === "saving" && submitted?.kind === "site_check_assumption" ? "Saving assumption…" : error && submitted?.kind === "site_check_assumption" ? "Retry assumption save" : "Keep site-check assumption"}
                </Button>
              </>
            )}
            <Button type="button" variant="link" className="min-h-11 w-full" disabled={busy} onClick={onBack}>Back to scope</Button>
          </form>
        </>
      )}
    </section>
  );
}
