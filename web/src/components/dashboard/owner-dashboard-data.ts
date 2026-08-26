import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileText,
  ListTodo,
  type LucideIcon,
  ReceiptText,
  Settings,
  Users,
  Wrench,
} from "lucide-react";

export interface OwnerKpi {
  id: string;
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: "neutral" | "attention" | "success";
  href?: string;
}

export interface OwnerKpiInput {
  todaysJobs: number;
  openEstimates: number;
  revenueThisWeek: string;
  invoicesWaiting: number;
  unscheduledJobs: number;
  overdueTasks: number;
  scopeLabel: string;
}

export function buildOwnerKpis(input: OwnerKpiInput): OwnerKpi[] {
  return [
    {
      id: "todays-jobs",
      label: "Today's Jobs",
      value: String(input.todaysJobs),
      helper: `Scheduled for field execution today in the ${input.scopeLabel}`,
      icon: CalendarClock,
      tone: "neutral",
      // view=all is required: DispatchPage defaults an omitted `view` to
      // "attention" (needsAttention=true), but this KPI counts every
      // actionable job scheduled today regardless of attention status - the
      // default filter would silently show fewer jobs than the tile.
      href: "/dispatch?scheduled=today&view=all",
    },
    {
      id: "open-estimates",
      label: "Open Estimates",
      value: String(input.openEstimates),
      helper: `Draft or ready estimates in the ${input.scopeLabel}`,
      icon: ClipboardCheck,
      tone: "neutral",
      href: "/dashboard#open-estimates",
    },
    {
      id: "revenue-this-week",
      label: "Revenue This Week",
      value: input.revenueThisWeek,
      helper: "Recorded payment transactions in the current organization week",
      icon: CircleDollarSign,
      tone: "success",
      href: "/dashboard/revenue-this-week",
    },
    {
      id: "invoices-waiting",
      label: "Invoices Waiting",
      value: String(input.invoicesWaiting),
      helper: `Sent, overdue, or partially paid invoices in the ${input.scopeLabel}`,
      icon: ReceiptText,
      tone: input.invoicesWaiting > 0 ? "attention" : "neutral",
      href: "/dashboard#invoices-waiting",
    },
    {
      id: "unscheduled-jobs",
      label: "Unscheduled Jobs",
      value: String(input.unscheduledJobs),
      helper: `Active jobs that still need a calendar slot in the ${input.scopeLabel}`,
      icon: AlertTriangle,
      tone: input.unscheduledJobs > 0 ? "attention" : "neutral",
      // Same view=all reasoning as the "Today's Jobs" tile above.
      href: "/dispatch?status=unscheduled&view=all",
    },
    {
      id: "overdue-tasks",
      label: "Overdue Tasks",
      value: String(input.overdueTasks),
      helper: `Open project tasks past due in the ${input.scopeLabel}`,
      icon: ListTodo,
      tone: input.overdueTasks > 0 ? "attention" : "neutral",
      href: "/dashboard/overdue-tasks",
    },
  ];
}

export interface OwnerScheduleItem {
  id: string;
  timeWindow: string;
  title: string;
  customer: string;
  address: string;
  crew: string;
  status: string;
  href: string;
}

export type OwnerActivityTone = "success" | "info" | "warning";

export interface OwnerActivityEntry {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  category: string;
  actor: string;
  tone: OwnerActivityTone;
}

export interface OwnerQuickAction {
  id: string;
  label: string;
  href?: string;
  helper: string;
  icon: LucideIcon;
}

export const ownerQuickActions: OwnerQuickAction[] = [
  {
    id: "create-estimate",
    label: "Choose Project for Estimate",
    href: "/projects",
    helper: "Open the project that should own the estimate",
    icon: FileText,
  },
  {
    id: "new-job",
    label: "New Job",
    href: "/projects/new",
    helper: "Create the project container",
    icon: Wrench,
  },
  {
    id: "schedule",
    label: "Schedule",
    href: "/dispatch",
    helper: "Jump to the dispatch workspace",
    icon: Clock3,
  },
  {
    id: "customers",
    label: "Customers",
    href: "/customers",
    helper: "Find or add a customer",
    icon: Users,
  },
  {
    id: "costbook",
    label: "Costbook",
    href: "/costbook",
    helper: "Open the pricing workspace foundation",
    icon: ClipboardCheck,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    helper: "Company, team, and defaults",
    icon: Settings,
  },
];
