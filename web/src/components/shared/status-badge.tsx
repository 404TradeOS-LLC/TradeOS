import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

// Tones map onto the shared semantic tokens (globals.css) rather than raw
// Tailwind palette shades, so a status badge always matches the same
// success/warning/info/destructive language used everywhere else in the
// app - and so the light/dark swap is free (each token flips under .dark).
// "Processing"/category states with no severity (field_execution, viewed,
// policy_check, ...) use the brand copper family per the design system's
// --status-processing: copper convention, rather than inventing a new
// color the design system doesn't define. Neutral/closed states use muted.
//
// Uses --accent/--accent-foreground rather than --primary/--primary-foreground:
// copper itself (--primary, #b87333) is only 3.74:1 as text on the card
// surface - fails WCAG AA's 4.5:1 (confirmed by computing the real contrast
// ratio, the same audit that caught --copper-foreground's failure on solid
// copper buttons). --accent-foreground is a darker copper shade chosen
// specifically to pass as text (6.12:1 light / 13.10:1 dark) while staying
// in the same copper family.
const TONE_SUCCESS = "border-success/20 bg-success/10 text-success";
const TONE_WARNING = "border-warning/20 bg-warning/10 text-warning";
const TONE_INFO = "border-info/20 bg-info/10 text-info";
const TONE_DESTRUCTIVE = "border-destructive/20 bg-destructive/10 text-destructive";
const TONE_DESTRUCTIVE_STRONG = "border-destructive/40 bg-destructive/15 text-destructive";
const TONE_PROCESSING = "border-accent-foreground/20 bg-accent text-accent-foreground";
const TONE_NEUTRAL = "border-border bg-muted text-muted-foreground";

const STATUS_TONES: Record<string, string> = {
  accepted: TONE_SUCCESS,
  active: TONE_SUCCESS,
  active_job: TONE_SUCCESS,
  archived: TONE_NEUTRAL,
  blocked: TONE_DESTRUCTIVE,
  change_orders: TONE_WARNING,
  closeout: TONE_INFO,
  complete: TONE_SUCCESS,
  completed: TONE_SUCCESS,
  contract: TONE_WARNING,
  dispatched: TONE_INFO,
  draft: TONE_WARNING,
  estimating: TONE_INFO,
  estimate: TONE_INFO,
  field_execution: TONE_PROCESSING,
  generated: TONE_INFO,
  high: TONE_DESTRUCTIVE,
  in_progress: TONE_INFO,
  low: TONE_NEUTRAL,
  medium: TONE_WARNING,
  needs_attention: TONE_WARNING,
  on_site: TONE_SUCCESS,
  opportunity: TONE_INFO,
  lost: TONE_DESTRUCTIVE,
  overdue: TONE_DESTRUCTIVE,
  paid: TONE_SUCCESS,
  paused: TONE_WARNING,
  pending_signature: TONE_WARNING,
  partially_paid: TONE_WARNING,
  proposal: TONE_INFO,
  proposed: TONE_INFO,
  proposal_draft: TONE_WARNING,
  proposal_sent: TONE_INFO,
  rejected: TONE_DESTRUCTIVE,
  declined: TONE_DESTRUCTIVE,
  expired: TONE_NEUTRAL,
  scheduled: TONE_INFO,
  sent: TONE_INFO,
  signed: TONE_SUCCESS,
  site_visit: TONE_PROCESSING,
  todo: TONE_NEUTRAL,
  traveling: TONE_INFO,
  unassigned: TONE_NEUTRAL,
  unscheduled: TONE_NEUTRAL,
  urgent: TONE_DESTRUCTIVE_STRONG,
  viewed: TONE_PROCESSING,
  void: TONE_NEUTRAL,
  voided: TONE_NEUTRAL,
  cancelled: TONE_NEUTRAL,
  won: TONE_SUCCESS,
  warranty: TONE_WARNING,

  // Athena kernel execution states (AthenaKernelState) and telemetry span
  // statuses (AthenaTelemetryStatus) - A10 observability. None of these
  // strings collide with an existing key above, so they share the same
  // STATUS_TONES palette rather than a second, parallel tone table.
  ok: TONE_SUCCESS,
  succeeded: TONE_SUCCESS,
  error: TONE_DESTRUCTIVE,
  failed: TONE_DESTRUCTIVE,
  denied: TONE_DESTRUCTIVE,
  degraded: TONE_WARNING,
  executing: TONE_INFO,
  routing: TONE_INFO,
  planning: TONE_INFO,
  context_building: TONE_NEUTRAL,
  created: TONE_NEUTRAL,
  policy_check: TONE_PROCESSING,
  awaiting_approval: TONE_WARNING,
  needs_clarification: TONE_WARNING,
  partially_succeeded: TONE_WARNING,
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
