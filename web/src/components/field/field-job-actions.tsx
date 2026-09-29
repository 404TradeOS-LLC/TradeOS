"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { transitionFieldJobAction, type FieldActionState } from "@/app/actions/field";
import type { FieldJobDetail } from "@/lib/api";

const EMPTY_STATE: FieldActionState = undefined;

type FieldTransition = "startTravel" | "arrive" | "pause" | "resume" | "complete";

const ACTION_COPY: Record<FieldTransition, string> = {
  startTravel: "Start travel",
  arrive: "Arrived",
  pause: "Pause work",
  resume: "Resume work",
  complete: "Complete job",
};

function primaryTransitionFor(status: FieldJobDetail["status"]): FieldTransition | null {
  if (status === "dispatched") return "startTravel";
  if (status === "traveling") return "arrive";
  if (status === "on_site") return "complete";
  if (status === "paused") return "resume";
  return null;
}

function primaryHintFor(transition: FieldTransition) {
  if (transition === "startTravel") return "Updates this assigned job to Traveling.";
  if (transition === "arrive") return "Marks this assigned job On site.";
  if (transition === "complete") return "Completes field work. Invoice handoff stays separate.";
  if (transition === "resume") return "Returns this assigned job to On site.";
  return "";
}

export function FieldJobActions({ job }: { job: FieldJobDetail }) {
  const [state, action, pending] = useActionState(transitionFieldJobAction, EMPTY_STATE);
  const primaryTransition = primaryTransitionFor(job.status);
  const canPause = job.status === "on_site";

  if (!primaryTransition && !canPause) {
    if (["completed", "cancelled"].includes(job.status)) return null;
    return <p className="text-sm text-muted-foreground">The next field action becomes available after dispatch.</p>;
  }

  return (
    <div className="grid gap-3">
      {state?.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      {canPause ? (
        <form action={action} className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="transition" value="pause" />
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            <span>Need to pause?</span>
            <Input name="reason" placeholder="Why are you pausing?" aria-label="Pause reason" />
          </label>
          <Button type="submit" disabled={pending} variant="outline" className="min-h-11 w-full">
            {pending ? "Saving…" : ACTION_COPY.pause}
          </Button>
        </form>
      ) : null}

      {primaryTransition ? (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto max-w-4xl rounded-2xl border border-border/70 bg-card/95 p-2 shadow-(--elev-2) backdrop-blur-xl 2xl:static 2xl:mx-0 2xl:max-w-none 2xl:border-0 2xl:bg-transparent 2xl:p-0 2xl:shadow-none 2xl:backdrop-blur-none">
          <form action={action} className="grid gap-1.5">
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="transition" value={primaryTransition} />
            <Button type="submit" disabled={pending} className="min-h-12 w-full text-sm font-semibold">
              {pending ? "Saving…" : ACTION_COPY[primaryTransition]}
            </Button>
            <p className="px-1 text-center text-[11px] leading-4 text-muted-foreground">
              {primaryHintFor(primaryTransition)}
            </p>
          </form>
        </div>
      ) : null}
    </div>
  );
}
