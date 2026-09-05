"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addFieldJobNoteAction, type FieldActionState } from "@/app/actions/field";

export function FieldNoteForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(addFieldJobNoteAction, undefined satisfies FieldActionState);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <Textarea name="body" rows={4} maxLength={5000} placeholder="Record what the office should know about this job…" aria-label="Job note" required />
      {state?.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto sm:justify-self-end">
        {pending ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}
