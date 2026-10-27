"use client";

import { useRef, useState } from "react";
import { todayTaskStatuses, updateTodayTaskStatus, type TodayTaskStatus } from "@/lib/today-task-actions";
import type { TodayTaskTarget } from "@/lib/today-model";

export function TodayTaskEditor({ task, online, onBusy, onSaved }: {
  task: TodayTaskTarget;
  online: boolean;
  onBusy: (busy: boolean) => void;
  onSaved: (status: TodayTaskStatus) => void;
}) {
  const [status, setStatus] = useState(task.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !online || !navigator.onLine || status === task.status) return;
    saving.current = true;
    setPending(true);
    setError(null);
    onBusy(true);
    try {
      await updateTodayTaskStatus(task, status as TodayTaskStatus);
      onSaved(status as TodayTaskStatus);
    } catch (error) {
      // No optimistic dismissal or automatic write retry. The source may have
      // changed while this dialog was open, including after a lost response.
      setError(error instanceof Error ? error.message : "Task could not be saved. Refresh the source before trying again.");
    } finally {
      saving.current = false;
      setPending(false);
      onBusy(false);
    }
  }

  return <form onSubmit={save} aria-label="Update task status" aria-busy={pending} className="my-5 space-y-3 rounded-xl border border-border p-4">
    <label htmlFor="today-task-status" className="block text-sm font-medium">Task status</label>
    <select id="today-task-status" value={status} disabled={pending || !online} onChange={event => { setStatus(event.target.value); setError(null); }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
      {todayTaskStatuses.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
    </select>
    <p className="text-xs leading-5 text-muted-foreground">Saves to the project task and records your change in its activity history.</p>
    {error ? <p role="alert" className="text-sm leading-6 text-destructive">{error}</p> : null}
    {!online ? <p role="status" className="text-xs text-muted-foreground">Reconnect before saving. No changes are queued offline.</p> : null}
    <button type="submit" disabled={pending || !online || status === task.status} className="today-primary w-full disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving task…" : "Save task status"}</button>
  </form>;
}
