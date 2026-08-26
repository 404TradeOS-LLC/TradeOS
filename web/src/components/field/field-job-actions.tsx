"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { transitionFieldJobAction, type FieldActionState } from "@/app/actions/field";
import type { FieldJobDetail } from "@/lib/api";

const EMPTY_STATE: FieldActionState = undefined;

export function FieldJobActions({ job }: { job: FieldJobDetail }) {
  const [state, action, pending] = useActionState(transitionFieldJobAction, EMPTY_STATE);

  const actionCopy = {
    startTravel: "Start travel",
    arrive: "Arrived on site",
    pause: "Pause work",
    resume: "Resume work",
    complete: "Complete job",
  } as const;

  const transitions =
    job.status === "dispatched" ? ["startTravel"]
    : job.status === "traveling" ? ["arrive"]
    : job.status === "on_site" ? ["pause", "complete"]
    : job.status === "paused" ? ["resume"]
    : [];

  return (
    <div className="grid gap-3">
      {state?.error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{state.error}</p> : null}
      {transitions.map((current) => (
        <form key={current} action={action} className="grid gap-2">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="transition" value={current} />
          {current === "pause" ? <Input name="reason" placeholder="Why are you pausing?" aria-label="Pause reason" /> : null}
          <Button type="submit" disabled={pending} variant={current === "complete" ? "default" : "outline"} className="min-h-11 w-full">
            {pending ? "Saving…" : actionCopy[current as keyof typeof actionCopy]}
          </Button>
        </form>
      ))}
      {transitions.length === 0 && !["completed", "cancelled"].includes(job.status) ? <p className="text-sm text-muted-foreground">The next field action becomes available after dispatch.</p> : null}
    </div>
  );
}
