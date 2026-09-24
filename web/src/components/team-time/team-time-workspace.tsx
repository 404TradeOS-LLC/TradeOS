"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowDownToLine, BriefcaseBusiness, Check, Clock3, Coffee, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamTimeRequest, type TeamTimeAction } from "@/lib/team-time-api";

type Job = { id: string; title: string; scheduled_start: string | null; scheduled_end: string | null };
type Worker = { id: string; name: string; role: string; workerType: "employee" | "subcontractor" | null; active: boolean };
type Shift = {
  id: string; org_id: string; worker_user_id: string; worker_type: "employee" | "subcontractor";
  job_id: string; started_at: string; ended_at: string | null; break_started_at: string | null;
  break_minutes: number; note?: string | null; status: "open" | "pending" | "approved";
  updated_at: string;
};
type WorkspaceData = {
  orgId?: string; role?: string; user: { id: string; name: string }; workerType: Worker["workerType"];
  supervisor: boolean; jobs: Job[]; assignedJobIds?: string[]; shifts: Shift[]; workers: Worker[];
  organizations?: Array<{ id: string; name: string; role: string }>; selectOrganization?: boolean;
};

type Mode = "myday" | "review" | "team" | "handoff";
const fmt = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Now";
const hours = (shift: Shift) => {
  const end = shift.ended_at ? Date.parse(shift.ended_at) : Date.now();
  const breakNow = shift.break_started_at ? Math.max(0, end - Date.parse(shift.break_started_at)) / 60_000 : 0;
  return (Math.max(0, (end - Date.parse(shift.started_at)) / 60_000 - shift.break_minutes - breakNow) / 60).toFixed(2);
};
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""').replace(/^[=+@-]/, "\u200b$&")}"`;

function downloadCsv(rows: Array<{ worker: string; type: string; job: string; shift: Shift }>, type: string) {
  const contents = [["Worker", "Worker type", "Job", "Start", "End", "Break minutes", "Hours"], ...rows.map(({ worker, type: workerType, job, shift }) => [worker, workerType, job, shift.started_at, shift.ended_at, shift.break_minutes, hours(shift)])]
    .map((row) => row.map(csv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", contents], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `tradeos-approved-${type}-hours.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function TeamTimeWorkspace() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [orgId, setOrgId] = useState("");
  const [mode, setMode] = useState<Mode>("myday");
  const [jobId, setJobId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Shift | null>(null);

  const load = useCallback(async (selectedOrg = orgId) => {
    const result = await teamTimeRequest<WorkspaceData>("bootstrap", selectedOrg ? { orgId: selectedOrg } : {});
    setData(result);
    if (result.orgId) setOrgId(result.orgId);
    return result;
  }, [orgId]);

  useEffect(() => {
    let current = true;
    teamTimeRequest<WorkspaceData>("bootstrap").then((result) => {
      if (!current) return;
      setData(result);
      if (result.orgId) setOrgId(result.orgId);
      if (result.supervisor && window.matchMedia("(min-width: 768px)").matches) setMode("review");
    }).catch((cause: unknown) => {
      if (current) setError(cause instanceof Error ? cause.message : "Team & Time could not load.");
    });
    return () => { current = false; };
  }, []);

  const act = async (action: TeamTimeAction, details: Record<string, unknown> = {}) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await teamTimeRequest(action, { orgId, ...details });
      await load(orgId);
      const messages: Partial<Record<TeamTimeAction, string>> = {
        clock_in: "Clocked in to the assigned job.", break_start: "Break started.", break_end: "Break ended.",
        clock_out: "Clocked out. The shift is ready for review.", correct: "Correction saved for manager review.",
        approve: "Hours approved.", reopen: "Hours returned to review.", configure_profile: "Worker type saved.",
      };
      setNotice(messages[action] || "Saved.");
      setEditing(null); setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
    } finally { setBusy(false); }
  };

  const jobs = data?.jobs ?? [];
  const assigned = jobs.filter((job) => (data?.assignedJobIds ?? []).includes(job.id));
  const shifts = data?.shifts ?? [];
  const active = shifts.find((shift) => shift.worker_user_id === data?.user.id && !shift.ended_at);
  const workers = data?.workers ?? [];
  const rows = shifts.map((shift) => ({
    shift,
    worker: workers.find((worker) => worker.id === shift.worker_user_id)?.name ?? (shift.worker_user_id === data?.user.id ? data.user.name : "Team member"),
    job: jobs.find((item) => item.id === shift.job_id)?.title ?? "Assigned job",
  }));
  const pending = rows.filter(({ shift }) => shift.status === "pending");

  if (!data && !error) return <p className="text-sm text-muted-foreground" role="status">Loading your team and assigned work…</p>;
  if (!data) return <Card><CardContent className="space-y-4 pt-6"><p className="text-destructive" role="alert">{error}</p><Button onClick={() => { setError(""); load("").catch((cause) => setError(cause instanceof Error ? cause.message : "Could not connect.")); }}><RefreshCw className="mr-2 size-4"/>Try again</Button></CardContent></Card>;

  if (data.selectOrganization) return <section className="mx-auto max-w-2xl space-y-5"><PageHeading title="Choose your company"/><div className="divide-y rounded-xl border bg-card">{(data.organizations ?? []).map((org) => <button key={org.id} className="flex min-h-14 w-full items-center justify-between px-4 text-left hover:bg-muted" onClick={() => { setError(""); load(org.id).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load that company.")); }}><span>{org.name}</span><span className="text-sm text-muted-foreground">{org.role}</span></button>)}</div>{error && <p role="alert" className="text-destructive">{error}</p>}</section>;

  return <section className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <PageHeading title={mode === "myday" ? "Your work, on the clock." : mode === "review" ? "Hours ready for review." : mode === "team" ? "Team setup" : "Payroll handoff"} subtitle={`Team & Time · Signed in as ${data.user.name}`} />
      {(data.organizations?.length ?? 0) > 1 && <label className="grid gap-1 text-sm">Company<select className="h-10 min-w-52 rounded-md border bg-background px-3" value={orgId} onChange={(event) => { const next = event.target.value; setOrgId(next); load(next).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load that company.")); }}>{data.organizations?.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    </header>

    <nav aria-label="Team and time sections" className="flex gap-1 overflow-x-auto border-b">
      <ModeButton active={mode === "myday"} onClick={() => setMode("myday")}>My day</ModeButton>
      {data.supervisor && <><ModeButton active={mode === "review"} onClick={() => setMode("review")}>Timesheets <span className="ml-1 text-xs text-muted-foreground">{pending.length || ""}</span></ModeButton><ModeButton active={mode === "team"} onClick={() => setMode("team")}>Team</ModeButton><ModeButton active={mode === "handoff"} onClick={() => setMode("handoff")}>Payroll handoff</ModeButton></>}
    </nav>
    {notice && <p role="status" className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0"/>{error}</p>}

    {mode === "myday" && <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
      <Card>
        <CardHeader><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock3 className="size-4 text-primary"/>{active ? "On the clock" : "Your assigned job"}</div><CardTitle className="text-xl">{active ? jobs.find((job) => job.id === active.job_id)?.title ?? "Current job" : assigned[0]?.title ?? "Nothing assigned yet"}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {active ? <><div className="flex flex-wrap items-baseline gap-3"><strong className="text-3xl tabular-nums">{hours(active)} h</strong><span className="text-sm text-muted-foreground">Started {fmt(active.started_at)}{active.break_started_at ? " · On break" : ""}</span></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => act(active.break_started_at ? "break_end" : "break_start", { shiftId: active.id })}><Coffee className="mr-2 size-4"/>{active.break_started_at ? "End break" : "Start break"}</Button><Button disabled={busy} onClick={() => act("clock_out", { shiftId: active.id, note })}>Clock out</Button></div><label className="grid gap-1.5 text-sm">Work note (optional)<textarea className="min-h-20 rounded-md border bg-background px-3 py-2" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you finish today?"/></label></> : data.workerType && assigned.length ? <><label className="grid gap-1.5 text-sm">Assigned job<select className="h-11 rounded-md border bg-background px-3" value={jobId || assigned[0].id} onChange={(event) => setJobId(event.target.value)}>{assigned.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><Button className="min-h-12 w-full sm:w-auto" disabled={busy} onClick={() => act("clock_in", { jobId: jobId || assigned[0].id })}>Clock in to this job <span aria-hidden="true" className="ml-2">→</span></Button></> : <div className="space-y-2 text-sm text-muted-foreground">{data.workerType ? <p>Ask the office to assign you to a TradeOS job.</p> : <p>Your company needs to set your worker type before you can clock in.</p>}</div>}
          <p className="border-t pt-3 text-xs text-muted-foreground">Time is recorded when you submit each action. TradeOS does not verify jobsite location.</p>
        </CardContent>
      </Card>
      <div className="space-y-5"><Card><CardHeader><CardTitle className="text-base">Assigned work</CardTitle></CardHeader><CardContent className="divide-y">{assigned.length ? assigned.map((job) => <div key={job.id} className="flex gap-3 py-3 first:pt-0 last:pb-0"><BriefcaseBusiness className="mt-0.5 size-4 text-muted-foreground"/><div><p className="font-medium">{job.title}</p><p className="text-sm text-muted-foreground">{job.scheduled_start ? fmt(job.scheduled_start) : "Schedule to confirm"}</p></div></div>) : <p className="text-sm text-muted-foreground">No jobs assigned yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Recent shifts</CardTitle></CardHeader><CardContent className="divide-y">{rows.filter(({ shift }) => shift.worker_user_id === data.user.id).slice(0, 4).map(({ shift, job }) => <div key={shift.id} className="py-3 first:pt-0 last:pb-0"><div className="flex justify-between gap-3"><span className="font-medium">{job}</span><span className="tabular-nums">{hours(shift)} h</span></div><p className="mt-1 text-sm text-muted-foreground">{fmt(shift.started_at)} · {shift.status === "approved" ? "Approved" : shift.status === "pending" ? "Waiting for review" : "On the clock"}</p></div>)}{!rows.some(({ shift }) => shift.worker_user_id === data.user.id) && <p className="text-sm text-muted-foreground">Your completed shifts will appear here.</p>}</CardContent></Card></div>
    </div>}

    {mode === "review" && data.supervisor && <><div className="flex flex-col justify-between gap-2 rounded-xl border-l-4 border-primary bg-card px-5 py-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs review</p><h2 className="mt-1 text-xl font-semibold">{pending.length} completed {pending.length === 1 ? "shift" : "shifts"} waiting</h2><p className="mt-1 text-sm text-muted-foreground">Review actual punches before any payroll handoff.</p></div><span className="text-sm text-muted-foreground">{data.user.name} · {data.role}</span></div><div className="divide-y rounded-xl border bg-card">{rows.length ? rows.map(({ shift, worker, job }) => <article key={shift.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{worker}</p><p className="text-sm text-muted-foreground">{shift.worker_type === "employee" ? "W-2 employee" : "Subcontractor"} · {job}</p><p className="mt-1 text-sm">{fmt(shift.started_at)}{shift.ended_at ? ` – ${fmt(shift.ended_at)}` : " – On clock"} · {shift.break_minutes} min break</p></div><div className="flex flex-wrap items-center gap-3"><strong className="tabular-nums">{hours(shift)} h</strong><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{shift.status === "open" ? "On clock" : shift.status === "pending" ? "Review" : "Approved"}</span>{shift.ended_at && <><Button variant="outline" size="sm" onClick={() => setEditing(shift)}>Correct</Button><Button size="sm" disabled={busy} onClick={() => act(shift.status === "approved" ? "reopen" : "approve", { shiftId: shift.id })}>{shift.status === "approved" ? "Reopen" : "Approve"}</Button></>}</div></article>) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No time entries yet. Once a worker clocks out, their shift will appear here.</p>}</div></>}

    {mode === "team" && data.supervisor && <><div className="flex items-center gap-3"><Users className="size-5 text-primary"/><div><h2 className="font-semibold">Set each person’s worker type</h2><p className="text-sm text-muted-foreground">This determines how approved hours are grouped for export.</p></div></div><div className="divide-y rounded-xl border bg-card">{workers.map((worker) => <article key={worker.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{worker.name}</p><p className="text-sm text-muted-foreground">{worker.role} · {worker.workerType === "employee" ? "W-2 employee" : worker.workerType === "subcontractor" ? "Subcontractor" : "Setup needed"}</p></div><div className="flex gap-2">{(["employee", "subcontractor"] as const).map((type) => <Button key={type} size="sm" variant={worker.workerType === type ? "secondary" : "outline"} disabled={busy || worker.workerType === type} onClick={() => act("configure_profile", { workerId: worker.id, workerType: type })}>{type === "employee" ? "W-2 employee" : "Subcontractor"}</Button>)}</div></article>)}</div><p className="text-sm text-muted-foreground">TradeOS records approved hours. It does not collect tax forms or submit payroll.</p></>}

    {mode === "handoff" && data.supervisor && <><Card><CardHeader><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved hours only</p><CardTitle>Prepare hours for your payroll process.</CardTitle><p className="text-sm text-muted-foreground">Downloads stay separate for employees and subcontractors. No provider receives data automatically.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{(["employee", "subcontractor"] as const).map((type) => { const list = rows.filter(({ shift }) => shift.status === "approved" && shift.worker_type === type); const total = list.reduce((sum, { shift }) => sum + Number(hours(shift)), 0).toFixed(2); return <div key={type} className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{type === "employee" ? "W-2 employees" : "Subcontractors"}</p><p className="mt-2 text-2xl font-semibold">{total} h</p><Button className="mt-4" variant="outline" disabled={!list.length} onClick={() => downloadCsv(list.map(({ shift, worker, job }) => ({ worker, type, job, shift })), type)}><ArrowDownToLine className="mr-2 size-4"/>Download CSV</Button></div>; })}</CardContent><div className="border-t px-6 py-4 text-sm text-muted-foreground">Approve shifts on Timesheets first. Confirm your provider’s import format before using the file for payroll or subcontractor payment.</div></Card></>}

    {editing && <CorrectionDialog shift={editing} onClose={() => setEditing(null)} onSave={(fields) => act("correct", fields)} busy={busy} />}
    <p className="text-xs text-muted-foreground">Signed-in team access · Server-validated membership · No location verification or payroll submission</p>
  </section>;
}

function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">TEAM & TIME</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-current={active ? "page" : undefined} onClick={onClick} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{children}</button>;
}

function CorrectionDialog({ shift, onClose, onSave, busy }: { shift: Shift; onClose: () => void; onSave: (fields: Record<string, unknown>) => void; busy: boolean }) {
  const toLocalInput = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
  const [start, setStart] = useState(toLocalInput(shift.started_at));
  const [end, setEnd] = useState(toLocalInput(shift.ended_at));
  const [breakMinutes, setBreakMinutes] = useState(shift.break_minutes);
  const [reason, setReason] = useState("");
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form role="dialog" aria-modal="true" aria-labelledby="team-time-correction-title" className="w-full max-w-lg space-y-4 rounded-t-2xl border bg-card p-5 shadow-xl sm:rounded-2xl" onSubmit={(event) => { event.preventDefault(); onSave({ shiftId: shift.id, startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), breakMinutes: Number(breakMinutes), reason }); }}><div className="flex items-center justify-between"><h2 id="team-time-correction-title" className="text-lg font-semibold">Correct time entry</h2><button type="button" aria-label="Close" className="size-9 rounded-md hover:bg-muted" onClick={onClose}>×</button></div><label className="grid gap-1 text-sm">Clock in<input className="h-11 rounded-md border bg-background px-3" type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)}/></label><label className="grid gap-1 text-sm">Clock out<input className="h-11 rounded-md border bg-background px-3" type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)}/></label><label className="grid gap-1 text-sm">Break minutes<input className="h-11 rounded-md border bg-background px-3" type="number" min={0} max={1440} required value={breakMinutes} onChange={(event) => setBreakMinutes(Number(event.target.value))}/></label><label className="grid gap-1 text-sm">Reason for correction<textarea className="min-h-20 rounded-md border bg-background px-3 py-2" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)}/></label><p className="text-xs text-muted-foreground">The original entry and correction stay in the audit history. Approval resets after a correction.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy}><Check className="mr-2 size-4"/>Save correction</Button></div></form></div>;
}
