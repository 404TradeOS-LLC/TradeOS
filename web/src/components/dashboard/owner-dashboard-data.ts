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
    },
    {
      id: "open-estimates",
      label: "Open Estimates",
      value: String(input.openEstimates),
      helper: `Draft or ready estimates in the ${input.scopeLabel}`,
      icon: ClipboardCheck,
      tone: "neutral",
    },
    {
      id: "revenue-this-week",
      label: "Revenue This Week",
      value: input.revenueThisWeek,
      helper: `Paid invoices recorded this week in the ${input.scopeLabel}`,
      icon: CircleDollarSign,
      tone: "success",
    },
    {
      id: "invoices-waiting",
      label: "Invoices Waiting",
      value: String(input.invoicesWaiting),
      helper: `Sent, overdue, or partially paid invoices in the ${input.scopeLabel}`,
      icon: ReceiptText,
      tone: input.invoicesWaiting > 0 ? "attention" : "neutral",
    },
    {
      id: "unscheduled-jobs",
      label: "Unscheduled Jobs",
      value: String(input.unscheduledJobs),
      helper: `Active jobs that still need a calendar slot in the ${input.scopeLabel}`,
      icon: AlertTriangle,
      tone: input.unscheduledJobs > 0 ? "attention" : "neutral",
    },
    {
      id: "overdue-tasks",
      label: "Overdue Tasks",
      value: String(input.overdueTasks),
      helper: `Open project tasks past due in the ${input.scopeLabel}`,
      icon: ListTodo,
      tone: input.overdueTasks > 0 ? "attention" : "neutral",
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
  status: "scheduled" | "dispatched" | "on_site";
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
    label: "Create Estimate",
    href: "/projects",
    helper: "Start from a project workspace",
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
    href: "/projects",
    helper: "Open active project work",
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
    helper: "Costbook workspace is not a routed web surface yet",
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
