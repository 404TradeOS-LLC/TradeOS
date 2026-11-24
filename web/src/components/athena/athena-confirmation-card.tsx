"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type SaveJobNoteResult = { ok: true } | { ok: false; error: string };

export type AthenaConfirmationCardProps =
  | {
      /** Confirm Write (Figma 653:19069/653:19225): review a proposed job note,
       *  edit it, then confirm it into the existing Job note service. The
       *  write itself arrives as onConfirm — this component performs no fetch
       *  and never touches the backend directly. */
      mode: "confirm-write";
      jobTitle: string;
      jobNumber: string;
      draft: string;
      onConfirm: (body: string) => Promise<SaveJobNoteResult>;
      onClose: () => void;
    }
  | {
      /** Awaiting approval: the kernel returned the action for approval. The
       *  card names the proposed action and points at the real approvals
       *  queue instead of simulating approval or performing a direct write.
       *  Nothing is written from this card. */
      mode: "awaiting-approval";
      summary: string;
      jobNumber?: string;
      canReviewApprovals: boolean;
    };

// Matches the field note form's cap (web/src/app/actions/field.ts) and the
// addJobNote tool's input cap, so a confirmed note cannot exceed what the
// note service already accepts elsewhere.
const MAX_NOTE_LENGTH = 5_000;

type ConfirmWritePhase = "confirm" | "editing" | "saving" | "saved" | "failed";

export function AthenaConfirmationCard(props: AthenaConfirmationCardProps) {
  const [phase, setPhase] = useState<ConfirmWritePhase>("confirm");
  const [text, setText] = useState(props.mode === "confirm-write" ? props.draft : "");
  const [error, setError] = useState<string | null>(null);

  if (props.mode === "awaiting-approval") {
    return (
      <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4" role="status">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-warning">Confirm action</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Awaiting approval
          </span>
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">{props.summary}</p>
        {props.jobNumber ? (
          <p className="mt-1 text-xs text-muted-foreground">Target · {props.jobNumber}</p>
        ) : null}
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Athena proposed this action, but it needs approval before it can run. Nothing is written from this screen.
        </p>
        {props.canReviewApprovals ? (
          <Link
            href="/athena/approvals"
            className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-copper underline-offset-4 hover:underline"
          >
            Open the approvals queue
          </Link>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ask an owner or admin to review it in the Athena approvals queue.
          </p>
        )}
      </div>
    );
  }

  const confirm = async () => {
    const body = text.trim();
    if (!body) {
      setError("Write a note before saving.");
      return;
    }
    // The textarea's maxLength only constrains edited text. A succeeded
    // summary can arrive longer than the cap, so enforce it here too — and
    // keep the oversized draft available for editing instead of silently
    // truncating it.
    if (body.length > MAX_NOTE_LENGTH) {
      setError("Keep notes to 5,000 characters or fewer.");
      setPhase("editing");
      return;
    }
    setError(null);
    setPhase("saving");
    const result = await props.onConfirm(body);
    if (result.ok) {
      setPhase("saved");
    } else {
      setError(result.error);
      setPhase("failed");
    }
  };

  return (
    <div
      className={cn(
        "mt-4 rounded-xl border p-4",
        phase === "saved"
          ? "border-success/30 bg-success/10"
          : phase === "failed"
            ? "border-destructive/30 bg-destructive/10"
            : "border-warning/30 bg-warning/10"
      )}
      role="status"
      aria-label="Confirm job note"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-warning">Confirm action</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
            phase === "saved"
              ? "border-success/30 bg-success/10 text-success"
              : phase === "failed"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-warning/30 bg-warning/10 text-warning"
          )}
        >
          {phase === "saved" ? (
            <>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Saved
            </>
          ) : phase === "failed" ? (
            <>
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Could not save
            </>
          ) : phase === "saving" ? (
            "Saving"
          ) : (
            <>
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Confirm action
            </>
          )}
        </span>
      </div>

      {phase === "saved" ? (
        <>
          <p className="mt-3 text-sm font-medium text-foreground">Saved to the job notes.</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The note is in the job history. The job notes below refresh to show it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={props.onClose}>
              Done
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium text-foreground">Add a job note to {props.jobTitle}</p>
          {phase === "editing" ? (
            <>
              <Textarea
                aria-label="Job note to save"
                value={text}
                maxLength={MAX_NOTE_LENGTH}
                rows={3}
                onChange={(event) => setText(event.target.value)}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {text.length} / {MAX_NOTE_LENGTH.toLocaleString()} characters
              </p>
            </>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">“{text}”</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Target: {props.jobNumber} · This writes through the existing Job note service and stays in project/job history.
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {phase === "failed" ? (
              <Button type="button" size="sm" onClick={() => void confirm()}>
                Retry
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={phase === "saving"} onClick={() => void confirm()}>
                {phase === "saving" ? "Saving…" : "Confirm & save"}
              </Button>
            )}
            {phase !== "editing" && phase !== "saving" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setPhase("editing")}>
                Edit
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" disabled={phase === "saving"} onClick={props.onClose}>
              Not now
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
