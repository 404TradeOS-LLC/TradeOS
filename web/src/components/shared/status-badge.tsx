import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_TONES: Record<string, string> = {
  accepted: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  active: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  active_job: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  archived: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  blocked: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  change_orders: "border-orange-600/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  closeout: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  complete: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  completed: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  contract: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  dispatched: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  draft: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  estimating: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  estimate: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  field_execution: "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  generated: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  high: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  in_progress: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  low: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  medium: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  needs_attention: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  on_site: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  opportunity: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  lost: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  overdue: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  paid: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "border-orange-600/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  pending_signature: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  partially_paid: "border-orange-600/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  proposal: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  proposed: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  proposal_draft: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  proposal_sent: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  rejected: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  declined: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  expired: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  scheduled: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  sent: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  signed: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  site_visit: "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  todo: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  traveling: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  unassigned: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  unscheduled: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  urgent: "border-rose-700/40 bg-rose-600/15 text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-200",
  viewed: "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  void: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  voided: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  won: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warranty: "border-orange-600/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",

  // Athena kernel execution states (AthenaKernelState) and telemetry span
  // statuses (AthenaTelemetryStatus) - A10 observability. None of these
  // strings collide with an existing key above, so they share the same
  // STATUS_TONES palette rather than a second, parallel tone table.
  ok: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  succeeded: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  error: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  failed: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  denied: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  degraded: "border-orange-600/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  executing: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  routing: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  planning: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  context_building: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  created: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  policy_check: "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  awaiting_approval: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  needs_clarification: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  partially_succeeded: "border-orange-600/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

const STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancelled",
  declined: "Declined",
  dispatched: "Dispatched",
  expired: "Expired",
  on_site: "On Site",
  partially_paid: "Partially Paid",
  pending_signature: "Awaiting Signature",
  proposal_draft: "Proposal Draft",
  proposal_sent: "Proposal Sent",
  unscheduled: "Unscheduled",
  ok: "OK",
  context_building: "Building Context",
  policy_check: "Policy Check",
  awaiting_approval: "Awaiting Approval",
  needs_clarification: "Needs Clarification",
  partially_succeeded: "Partially Succeeded",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replaceAll(" ", "_");

  return (
    <Badge
      variant="outline"
      className={cn("border-border/70 capitalize", STATUS_TONES[normalizedStatus] ?? "bg-muted/60 text-foreground", className)}
    >
      {STATUS_LABELS[normalizedStatus] ?? status.replaceAll("_", " ")}
    </Badge>
  );
}
