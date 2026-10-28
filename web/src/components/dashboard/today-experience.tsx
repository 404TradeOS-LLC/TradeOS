"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCheck, ChevronDown, ChevronRight, ClipboardList, Clock3, ExternalLink, Filter, ListTodo, MapPin, RefreshCw, Search, ShieldCheck, Sparkles, Users, WifiOff, X } from "lucide-react";
import { AthenaWorkspace } from "@/components/athena/athena-workspace";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { canUseUniversalCreate } from "@/lib/universal-create-access";
import { buildUniversalCreateHref } from "@/lib/universal-create";
import type { TodayData, TodayAttentionItem, TodayWorkItem } from "@/lib/today-model";
import { TodayTaskEditor } from "./today-task-editor";
import { canUpdateTodayTask, type TodayTaskStatus } from "@/lib/today-task-actions";
import type { TodayTaskTarget } from "@/lib/today-model";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import "./today-experience.css";

type View = "today" | "attention" | "work";
type Selection = { task?: TodayTaskTarget; title: string; context: string; href: string; action: string; status?: string; assignee?: string | null; dueAt?: string | null; source?: string };
const ICONS = [BriefcaseBusiness, Users, ListTodo, AlertTriangle, CheckCheck, CalendarClock];
function localTime(value: string | null | undefined, timeZone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unscheduled";
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function localDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(new Date(value));
}
function AttentionRow({ item, onOpen }: { item: TodayAttentionItem; onOpen: (item: Selection) => void }) {
  return <li className="today-attention-row">
    <span className={cn("today-record-icon", item.priority === "urgent" ? "text-destructive bg-destructive/10" : "text-warning bg-warning/10")}><AlertTriangle size={19} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1"><span className={cn("text-[10px] font-semibold uppercase tracking-wider", item.priority === "urgent" ? "text-destructive" : "text-warning")}>{item.priority} · {item.source}</span><h3 className="mt-1 text-sm font-medium">{item.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.context}</p>{item.assignee ? <p className="text-xs text-muted-foreground">{item.assignee}</p> : null}</div>
    <button type="button" className="today-row-action" onClick={() => onOpen(item)} aria-label={`${item.action}: ${item.title}`}>{item.action}<ChevronRight size={14} aria-hidden="true" /></button>
  </li>;
}
function WorkRow({ item, onOpen, timeZone, showDate = false }: { item: TodayWorkItem; onOpen: (item: Selection) => void; timeZone: string; showDate?: boolean }) {
  return <li><button type="button" className="today-work-row" onClick={() => onOpen({ ...item, action: item.kind === "task" ? "Open task workspace" : "Open work", source: item.kind })}>
    <time className="w-20 shrink-0 text-xs text-muted-foreground">{showDate && item.start ? <span className="mb-1 block font-medium text-accent-foreground">{localDate(item.start, timeZone)}</span> : null}{localTime(item.start, timeZone)}</time>
    <span className={cn("today-record-icon", item.kind === "task" ? "text-warning bg-warning/10" : "text-primary bg-primary/10")}>{item.kind === "task" ? <ClipboardList size={18} /> : item.kind === "visit" ? <MapPin size={18} /> : <BriefcaseBusiness size={18} />}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.context}</span><span className="text-xs text-muted-foreground">{item.assignee || "Unassigned"} · {item.status.replaceAll("_", " ")}</span></span><ChevronRight className="shrink-0 text-muted-foreground" size={16} />
  </button></li>;
}
function Timeline({ work, timeZone, onOpen }: { work: TodayWorkItem[]; timeZone: string; onOpen: (item: Selection) => void }) {
  const scheduled = work.filter(item => item.start && Number.isFinite(Date.parse(item.start)));
  return <section className="today-panel"><div className="today-panel-heading"><div><h2>Day timeline</h2><p>Scheduled work · {timeZone}</p></div><span className="text-xs text-muted-foreground" title="Crew-location tracking is not connected">Map unavailable</span></div>
    {scheduled.length ? <div className="today-timeline" tabIndex={0} aria-label="Scrollable daily timeline"><div className="today-timeline-inner">
      <div className="today-hours">{[0,4,8,12,16,20,24].map(hour => <span key={hour}>{hour === 0 || hour === 24 ? 12 : hour > 12 ? hour - 12 : hour}{hour >= 12 && hour < 24 ? " PM" : " AM"}</span>)}</div>
      {scheduled.map(item => {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(item.start!));
        const hour = Number(parts.find(p => p.type === "hour")?.value) + Number(parts.find(p => p.type === "minute")?.value) / 60;
        const start = Math.min(96, Math.max(0, hour / 24 * 100));
        const minutes = item.end ? (Date.parse(item.end) - Date.parse(item.start!)) / 60000 : 60;
        const width = Math.min(100 - start, Math.max(8, Math.min(100, minutes / 1440 * 100)));
        return <div className="today-timeline-lane" key={item.id}><button type="button" style={{ marginLeft: `${start}%`, width: `${width}%` }} className="today-timeline-block" onClick={() => onOpen({ ...item, action: "Open scheduled work", source: item.kind })}><span>{item.title}</span><small>{localTime(item.start, timeZone)}{item.end ? ` – ${localTime(item.end, timeZone)}` : ""}</small></button></div>;
      })}
    </div></div> : <p className="today-empty">No scheduled work is available in this view. Open Dispatch to coordinate the next job.</p>}
    <Link className="today-panel-footer" href="/dispatch">Open full dispatch <ArrowRight size={15} /></Link>
  </section>;
}
function ContextWorkspace({ selected, onClose, timeZone, role, online, onTaskSaved }: { selected: Selection | null; onClose: () => void; timeZone: string; role: string; online: boolean; onTaskSaved: (status: TodayTaskStatus) => void }) {
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useBodyScrollLock(Boolean(selected));
  useEffect(() => {
    if (selected && !ref.current?.open) ref.current?.showModal();
    if (!selected && ref.current?.open) ref.current.close();
  }, [selected]);
  return <dialog ref={ref} className="today-dialog" aria-labelledby="today-context-title" onClose={onClose} onCancel={event => { if (saving) event.preventDefault(); }} onClick={event => { if (!saving && event.target === event.currentTarget) onClose(); }}>
    {selected ? <div className="today-context"><div className="flex items-start justify-between gap-4"><div><p className="today-eyebrow">{selected.source || "Work"} workspace</p><h2 id="today-context-title" className="mt-3 font-heading text-2xl font-semibold">{selected.title}</h2></div><button type="button" autoFocus disabled={saving} onClick={onClose} aria-label="Close workspace" className="today-icon-button"><X size={20} /></button></div><p className="mt-5 text-sm leading-7 text-muted-foreground">{selected.context}</p><dl className="my-6 grid grid-cols-2 gap-5 rounded-xl border border-border p-4 text-sm"><div><dt className="text-xs text-muted-foreground">Responsible party</dt><dd className="mt-1">{selected.assignee || "Not assigned"}</dd></div><div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1 capitalize">{selected.status?.replaceAll("_", " ") || "Requires review"}</dd></div>{selected.dueAt ? <div><dt className="text-xs text-muted-foreground">Due</dt><dd className="mt-1">{localDate(selected.dueAt, selected.task || ["task", "tasks", "job tasks"].includes(selected.source?.toLowerCase() || "") ? "UTC" : timeZone)}</dd></div> : null}</dl>{selected.task && canUpdateTodayTask(role, selected.task) ? <TodayTaskEditor key={selected.task.taskId} task={selected.task} online={online} onBusy={setSaving} onSaved={onTaskSaved} /> : null}<Link href={selected.href} aria-disabled={saving || undefined} onClick={event => { if (saving) event.preventDefault(); else onClose(); }} className={buttonVariants({ className: "w-full min-h-11" })}>{selected.action}<ExternalLink size={16} /></Link><p className="mt-4 text-xs leading-6 text-muted-foreground">Review details, history, and permitted actions in the source workspace. Today refreshes from saved records; an item stays open until its source is resolved.</p></div> : null}
  </dialog>;
}
export function TodayExperience({ data, initialView = "today" }: { data: TodayData; initialView?: View }) {
  const router = useRouter();
  const [pending, refresh] = useTransition();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [workKind, setWorkKind] = useState("all");
  const [athenaOpen, setAthenaOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(data.generatedAt);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const tick = () => { setNow(new Date().toISOString()); if (navigator.onLine && document.visibilityState === "visible" && !refDialogOpen()) refresh(() => router.refresh()); };
    connection();
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    const timer = window.setInterval(tick, 60_000);
    return () => { clearInterval(timer); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); };
  }, [router]);
  const timeZone = data.viewer.timeZone;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(now)));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const unavailable = data.sources.filter(s => s.state === "unavailable" || s.state === "partial");
  const attentionCount = data.stats.find(s => s.id === "attention")?.value;
  const attentionBadge = attentionCount == null ? "—" : String(attentionCount);
  const stale = Date.parse(now) - Date.parse(data.generatedAt) > 180_000;
  const roleLabel = data.viewer.presentation === "owner" ? "Owner" : data.viewer.presentation === "office" ? "Office manager" : "Field crew";
  const attention = data.attention.filter(item => (source === "all" || item.source === source) && (priority === "all" || item.priority === priority) && (assignee === "all" || item.assignee === assignee) && `${item.title} ${item.context} ${item.assignee || ""}`.toLowerCase().includes(query.toLowerCase()));
  const restrictedSources = data.sources.filter(s => s.state === "restricted");
  const work = data.work.filter(item => workKind === "all" || item.kind === workKind);
  const next = data.attention[0] || data.progress[0];
  const allSources = [...new Set(data.attention.map(item => item.source))];
  const assignees = [...new Set(data.attention.map(item => item.assignee).filter(Boolean))] as string[];
  return <div className="today-experience" aria-busy={pending}>
    <div className="today-page-toolbar"><div className="flex min-w-0 items-center gap-3"><span className="today-eyebrow">Command center</span><span className="today-role"><ShieldCheck size={12} />{roleLabel}</span></div><div className="flex items-center gap-2"><ThemeToggle /><button type="button" className="today-icon-button" disabled={pending || !online} onClick={() => refresh(() => router.refresh())} aria-label="Refresh Today"><RefreshCw size={17} className={pending ? "animate-spin" : ""} /></button></div></div>
    {taskFeedback ? <p role="status" className="today-service-notice"><CheckCheck size={16} />{taskFeedback}</p> : null}
    {!online ? <p role="status" className="today-service-notice"><WifiOff size={16} />Offline. Showing the last loaded records; reconnect before making changes.</p> : stale ? <p role="status" className="today-service-notice">This view may be stale. Refresh to load current records.</p> : null}
    {initialView === "today" ? <section className="today-hero"><div className="today-hero-image" aria-hidden="true" /><div className="today-hero-content"><p className="today-eyebrow">Your day. Under control.</p><h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Today<span className="text-primary">.</span></h1><p className="mt-3 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(now))} · {localTime(now, timeZone)}</p><h2 className="mt-6 font-heading text-xl font-semibold sm:text-2xl">{greeting}, {data.viewer.name}.</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{attentionCount == null ? "Some attention sources are unavailable. Review the visible items before assuming everything is clear." : attentionCount > 0 ? `${attentionCount} items need attention. Start with the highest-priority action, then keep today's work moving.` : "No unresolved items in the available attention sources. Review today's work and your next commitments."}</p>{next ? <button className="today-primary mt-5" type="button" onClick={() => setSelected(next)}>{next.action}<ArrowRight size={16} /></button> : <Link href={data.viewer.presentation === "field" ? "/field" : "/dispatch"} className="today-primary mt-5">Review today’s work <ArrowRight size={16} /></Link>}</div><div className="today-hero-caption"><span className="size-1.5 rounded-full bg-primary" />{data.companyName || "TradeOS"} · {timeZone}</div></section> : <div className="py-4"><Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back to Today</Link><h1 className="mt-5 font-heading text-3xl font-semibold">{initialView === "attention" ? "Needs You" : "Today’s Work"}</h1><p className="mt-2 text-sm text-muted-foreground">{initialView === "attention" ? "Decisions and unresolved actions, ordered by urgency." : "Scheduled work, assignments, and the next commitment."}</p></div>}
    <nav className="today-view-nav" aria-label="Today views"><Link aria-current={initialView === "today" ? "page" : undefined} href="/dashboard">Overview</Link><Link aria-current={initialView === "attention" ? "page" : undefined} href="/dashboard/needs-you">Needs You <span>{attentionBadge}</span></Link><Link aria-current={initialView === "work" ? "page" : undefined} href="/dashboard/work">Today’s Work</Link><span className="ml-auto hidden text-xs text-muted-foreground sm:block">Snapshot {localTime(data.generatedAt, timeZone)}</span></nav>
    {unavailable.length ? <details className="today-service-notice"><summary className="cursor-pointer">{unavailable.length} sources need a refresh · available records remain usable</summary><ul className="mt-2 space-y-2 text-xs">{unavailable.map(s => <li key={s.id}>{s.label}: {s.message || s.state}</li>)}</ul></details> : null}
    {initialView === "today" ? <section aria-label="Operational indicators" className="today-stats">{data.stats.map((stat, index) => { const Icon = ICONS[index % ICONS.length]; return <Link href={stat.href} key={stat.id} className="today-stat"><span className="today-record-icon bg-primary/10 text-primary"><Icon size={19} /></span><div><p className="font-heading text-2xl font-semibold tabular-nums">{stat.value == null ? "—" : stat.value}</p><p className="mt-1 text-xs font-medium">{stat.label}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{stat.helper}</p></div><ChevronRight className="ml-auto shrink-0 text-muted-foreground" size={14} /></Link>; })}</section> : null}
    <div className={cn("today-main-grid", initialView !== "today" && "today-main-grid-expanded")}>
      {initialView !== "work" ? <section className="today-panel today-attention"><div className="today-panel-heading"><div><h2>Needs You <span className="today-count">{attentionBadge}</span></h2><p>Unresolved actions · loaded records</p></div>{initialView === "today" ? <Link href="/dashboard/needs-you">View all <ChevronRight size={14} /></Link> : <Filter size={17} className="text-muted-foreground" />}</div>
        {initialView === "attention" ? <div className="today-queue-filters"><label className="today-search"><Search size={16} /><input aria-label="Search attention items" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search work, customer, or action…" /></label><div className="flex flex-wrap gap-2"><select aria-label="Filter by source" value={source} onChange={e => setSource(e.target.value)}><option value="all">All sources</option>{allSources.map(s => <option key={s}>{s}</option>)}</select><select aria-label="Filter by priority" value={priority} onChange={e => setPriority(e.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option></select><select aria-label="Filter by assignee" value={assignee} onChange={e => setAssignee(e.target.value)}><option value="all">All assignees</option>{assignees.map(s => <option key={s}>{s}</option>)}</select></div><p className="text-xs text-muted-foreground" role="status">{attention.length} matching loaded records</p></div> : null}
        {attention.length ? <ul>{attention.slice(0, initialView === "today" ? 4 : undefined).map(item => <AttentionRow key={item.id} item={item} onOpen={setSelected} />)}</ul> : <div className="today-empty"><CheckCheck className="mb-3 text-primary" size={24} /><p>{query || source !== "all" || priority !== "all" || assignee !== "all" ? "No items match these filters." : unavailable.length ? "No attention items loaded from the available sources. Check source status above." : "Nothing is waiting on you in the available sources."}</p></div>}
      </section> : null}
      {initialView !== "attention" ? <section className="today-panel today-work"><div className="today-panel-heading"><div><h2>Today’s Work</h2><p>{data.viewer.presentation === "field" ? "Your assigned field work" : "Jobs, tasks, and site visits"}</p></div><Link href="/dispatch">Dispatch <ChevronRight size={14} /></Link></div><div className="today-work-tabs" role="group" aria-label="Filter today's work">{([["all", "All"], ["job", "Jobs"], ...(data.viewer.presentation !== "field" || data.work.some(item => item.kind === "task") ? [["task", "Tasks"]] : []), ...(data.work.some(item => item.kind === "visit") ? [["visit", "Site visits"]] : [])]).map(([value,label]) => <button type="button" aria-pressed={workKind === value} onClick={() => setWorkKind(value)} key={value}>{label}</button>)}</div>{work.length ? <ul>{work.slice(0, initialView === "today" ? 6 : undefined).map(item => <WorkRow key={item.id} item={item} timeZone={timeZone} onOpen={setSelected} />)}</ul> : <p className="today-empty">No {workKind === "all" ? "work" : workKind === "visit" ? "site visits" : `${workKind}s`} loaded for this view.</p>}<Link href={data.viewer.presentation === "field" ? "/field" : "/dispatch?view=all&status=unscheduled"} className="today-panel-footer">{data.viewer.presentation === "field" ? "Open my field day" : "Review unscheduled work"}<ArrowRight size={15} /></Link></section> : null}
      {initialView !== "attention" ? <Timeline work={work} timeZone={timeZone} onOpen={setSelected} /> : null}
    </div>
    {initialView !== "attention" && data.upcoming?.length ? <section className="today-panel mt-4"><div className="today-panel-heading"><div><h2>Coming up</h2><p>Next commitments in the organization week</p></div><Link href="/dispatch?mode=week">View week <ChevronRight size={14} /></Link></div><ul>{data.upcoming.slice(0, 6).map(item => <WorkRow key={item.id} item={item} onOpen={setSelected} timeZone={timeZone} showDate />)}</ul></section> : null}
    {initialView === "today" && data.progress.length ? <section className="today-panel mt-4"><div className="today-panel-heading"><div><h2>Continue working</h2><p>Normal progression, ready when you are</p></div></div><div className="today-progress">{data.progress.slice(0, 4).map(item => <button type="button" key={item.id} onClick={() => setSelected(item)}><span className="text-xs text-muted-foreground">{item.source}</span><span className="mt-2 block text-sm font-medium">{item.title}</span><span className="mt-3 flex items-center gap-2 text-xs text-accent-foreground">{item.action}<ArrowRight size={14} /></span></button>)}</div></section> : null}
    <section className="today-panel today-athena mt-4"><button type="button" className="today-athena-toggle" aria-label="Athena Operations partner" aria-expanded={athenaOpen} aria-controls="today-athena-body" onClick={() => setAthenaOpen(!athenaOpen)}><Sparkles size={22} className="text-primary" /><span className="flex-1 text-left"><span className="font-heading text-lg font-semibold">Athena</span><span className="ml-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Operations partner</span><span className="mt-1 block text-xs text-muted-foreground">{data.attention[0] ? `Start here: ${data.attention[0].title}` : "Bring your next operational question."}</span></span><ChevronDown size={18} className={cn("transition-transform", athenaOpen && "rotate-180")} /></button><div id="today-athena-body" hidden={!athenaOpen} className="border-t border-border p-4 sm:p-5">{data.athenaEnabled ? <><div className="mb-5 grid gap-2 md:grid-cols-3">{data.attention.slice(0,3).map((item,i) => <button type="button" className="rounded-xl border border-border bg-background p-3 text-left text-sm" key={item.id} onClick={() => setSelected(item)}><span className="mr-2 text-primary">0{i+1}</span>{item.title}<span className="mt-2 block text-xs text-muted-foreground">{item.action} →</span></button>)}</div><AthenaWorkspace selectedScope={{ page: initialView === "attention" ? "/dashboard/needs-you" : initialView === "work" ? "/dashboard/work" : "/dashboard" }} /></> : <p className="text-sm text-muted-foreground">Athena is unavailable for this workspace. Your operational records remain available above.</p>}</div></section>
    <section className="today-quick-create" aria-label="Quick create"><p className="today-eyebrow">Start something</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{(["estimate", "job", "customer", "invoice", "task"] as const).filter(kind => canUseUniversalCreate(kind, data.viewer.role, data.athenaEnabled)).map(kind => <Link className="today-create-link" key={kind} href={buildUniversalCreateHref(kind, "/dashboard")}><ClipboardList size={17} />New {kind}<ArrowRight size={14} className="ml-auto" /></Link>)}</div></section>
    {restrictedSources.length ? <details className="mt-5 rounded-lg border border-border p-4 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Workspace capabilities and access</summary><ul className="mt-3 space-y-3">{restrictedSources.map(item => <li key={item.id}><span className="font-medium text-foreground">{item.label}. </span>{item.message}</li>)}</ul></details> : null}
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-muted-foreground"><span>Contractor-built. Field-ready.</span><span className="flex items-center gap-2"><Clock3 size={12} />{timeZone} · refreshes every minute</span></footer>
    <ContextWorkspace selected={selected} onClose={() => setSelected(null)} timeZone={timeZone} role={data.viewer.role} online={online} onTaskSaved={status => { setTaskFeedback(`Task saved as ${status.replaceAll("_", " ")}. Refreshing operational records.`); setSelected(null); refresh(() => router.refresh()); }} />
  </div>;
}
function refDialogOpen() { return Boolean(document.querySelector("dialog[open]")); }
