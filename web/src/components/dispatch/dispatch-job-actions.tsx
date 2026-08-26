"use client";

import { useState } from "react";
import type { DispatchJob } from "@/lib/api";
import { ClientApiError, clientFetch } from "@/lib/clientApi";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

type ScheduleConflictResult = {
  conflicts: unknown[];
  overrideAllowed: boolean;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function DispatchJobActions({ job, canManageInvoiceReadiness }: { job: DispatchJob; canManageInvoiceReadiness: boolean }) {
  const [open, setOpen] = useState(false);
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"lead" | "technician" | "helper">("technician");
  const [scheduledStart, setScheduledStart] = useState(toLocalInputValue(job.scheduledStart));
  const [scheduledEnd, setScheduledEnd] = useState(toLocalInputValue(job.scheduledEnd));
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string | null>(null);

  async function run(label: string, operation: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    setConflicts(null);
    try {
      await operation();
      window.location.reload();
    } catch (caught) {
      const message = caught instanceof ClientApiError
        ? caught.message + (caught.status ? " (HTTP " + caught.status + ")" : "")
        : caught instanceof Error
          ? caught.message
          : "The dispatcher action failed.";
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  function schedulePayload() {
    const start = toIso(scheduledStart);
    const end = toIso(scheduledEnd);
    if (!start || !end || new Date(end) <= new Date(start)) {
      throw new Error("Enter a valid start and end time.");
    }
    return { scheduledStart: start, scheduledEnd: end, overrideConflict, overrideReason: overrideReason.trim() || undefined };
  }

  async function checkConflicts() {
    setBusy("Checking conflicts");
    setError(null);
    setConflicts(null);
    try {
      const payload = schedulePayload();
      const query = new URLSearchParams({ scheduledFrom: payload.scheduledStart, scheduledTo: payload.scheduledEnd });
      const result = await clientFetch<ScheduleConflictResult>("/schedule/conflicts?" + query.toString());
      const count = Array.isArray(result.conflicts) ? result.conflicts.length : 0;
      setConflicts(count > 0 ? String(count) + " overlapping assignment" + (count === 1 ? "." : "s.") : "No overlapping assignments found.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to check schedule conflicts.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide actions" : "Manage job"}
      </button>

      {open ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-left" aria-label={"Actions for " + job.jobNumber}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Technician user ID
              <input className={fieldClass} value={assignmentUserId} onChange={(event) => setAssignmentUserId(event.target.value)} placeholder="UUID from organization membership" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Assignment role
              <select className={fieldClass} value={assignmentRole} onChange={(event) => setAssignmentRole(event.target.value as typeof assignmentRole)}>
                <option value="technician">Technician</option>
                <option value="lead">Lead</option>
                <option value="helper">Helper</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!assignmentUserId.trim() || busy !== null}
              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              onClick={() => run("Assigning", () => clientFetch("/jobs/" + job.id + "/assignments", { method: "POST", body: JSON.stringify({ userId: assignmentUserId.trim(), assignmentRole, isLead: assignmentRole === "lead" }) }))}
            >
              {busy === "Assigning" ? "Assigning…" : "Assign technician"}
            </button>
            {job.assignedTechnicians.map((technician) => (
              <button
                key={technician.assignmentId ?? technician.userId}
                type="button"
                disabled={!technician.assignmentId || busy !== null}
                className="rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive disabled:opacity-50"
                onClick={() => technician.assignmentId && run("Unassigning", () => clientFetch("/jobs/" + job.id + "/assignments/" + technician.assignmentId, { method: "DELETE", body: JSON.stringify({ reason: "Removed from dispatcher workspace" }) }))}
              >
                Remove {technician.name}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Start
              <input className={fieldClass} type="datetime-local" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-medium text-foreground">
              End
              <input className={fieldClass} type="datetime-local" value={scheduledEnd} onChange={(event) => setScheduledEnd(event.target.value)} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={overrideConflict} onChange={(event) => setOverrideConflict(event.target.checked)} />
            Override a detected conflict
          </label>
          {overrideConflict ? (
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Override reason
              <input className={fieldClass} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Required by owner/admin policy" />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground disabled:opacity-50" onClick={checkConflicts}>
              {busy === "Checking conflicts" ? "Checking…" : "Check conflicts"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              onClick={() => run(job.scheduledStart ? "Rescheduling" : "Scheduling", () => clientFetch("/jobs/" + job.id + "/" + (job.scheduledStart ? "reschedule" : "schedule"), { method: job.scheduledStart ? "POST" : "PUT", body: JSON.stringify(schedulePayload()) }))}
            >
              {busy === "Rescheduling" ? "Rescheduling…" : busy === "Scheduling" ? "Scheduling…" : job.scheduledStart ? "Reschedule" : "Schedule"}
            </button>
            {job.status === "scheduled" ? (
              <button
                type="button"
                disabled={busy !== null}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
                onClick={() => run("Dispatching", () => clientFetch("/jobs/" + job.id + "/dispatch", { method: "POST", body: JSON.stringify({}) }))}
              >
                {busy === "Dispatching" ? "Dispatching…" : "Mark dispatched"}
              </button>
            ) : null}
            {canManageInvoiceReadiness && job.status === "completed" && !job.readyForInvoiceAt ? (
              <button
                type="button"
                disabled={busy !== null}
                className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                onClick={() => run("Marking ready", () => clientFetch("/jobs/" + job.id + "/ready-for-invoice", { method: "POST", body: JSON.stringify({}) }))}
              >
                {busy === "Marking ready" ? "Marking ready…" : "Mark ready for invoice"}
              </button>
            ) : null}
          </div>

          {conflicts ? <p className="text-xs text-muted-foreground" role="status">{conflicts}</p> : null}
          {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
