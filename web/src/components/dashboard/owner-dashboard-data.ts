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
}

export function buildOwnerKpis(input: OwnerKpiInput): OwnerKpi[] {
  return [
    {
      id: "todays-jobs",
      label: "Today's Jobs",
      value: String(input.todaysJobs),
      helper: "Scheduled for field execution today",
      icon: CalendarClock,
      tone: "neutral",
    },
    {
      id: "open-estimates",
      label: "Open Estimates",
      value: String(input.openEstimates),
      helper: "Draft or ready estimates awaiting follow-through",
      icon: ClipboardCheck,
      tone: "neutral",
    },
    {
      id: "revenue-this-week",
      label: "Revenue This Week",
      value: input.revenueThisWeek,
      helper: "Paid invoices recorded this week",
      icon: CircleDollarSign,
      tone: "success",
    },
    {
      id: "invoices-waiting",
      label: "Invoices Waiting",
      value: String(input.invoicesWaiting),
      helper: "Sent, overdue, or partially paid invoices",
      icon: ReceiptText,
      tone: input.invoicesWaiting > 0 ? "attention" : "neutral",
    },
    {
      id: "unscheduled-jobs",
      label: "Unscheduled Jobs",
      value: String(input.unscheduledJobs),
      helper: "Jobs that still need a calendar slot",
      icon: AlertTriangle,
      tone: input.unscheduledJobs > 0 ? "attention" : "neutral",
    },
    {
      id: "overdue-tasks",
      label: "Overdue Tasks",
      value: String(input.overdueTasks),
      helper: "Open project tasks past due",
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

export const mockTodayScheduleItems: OwnerScheduleItem[] = [
  {
    id: "sched-1",
    timeWindow: "7:30 AM",
    title: "Roof leak triage",
    customer: "Morgan Lee",
    address: "1428 Maple Ridge Dr.",
    crew: "Avery + Luis",
    status: "dispatched",
  },
  {
    id: "sched-2",
    timeWindow: "8:15 AM",
    title: "Kitchen lighting rough-in",
    customer: "Hannah Patel",
    address: "88 Meridian Ave.",
    crew: "North crew",
    status: "scheduled",
  },
  {
    id: "sched-3",
    timeWindow: "9:00 AM",
    title: "Panel replacement closeout",
    customer: "Oak Street HOA",
    address: "420 Oak St.",
    crew: "Dana",
    status: "on_site",
  },
  {
    id: "sched-4",
    timeWindow: "10:30 AM",
    title: "Bathroom remodel walkthrough",
    customer: "Jamie Rivera",
    address: "712 Fletcher Pl.",
    crew: "Remodel crew",
    status: "scheduled",
  },
  {
    id: "sched-5",
    timeWindow: "12:00 PM",
    title: "Supply pickup and staging",
    customer: "TradeOS warehouse",
    address: "West yard",
    crew: "Luis",
    status: "scheduled",
  },
  {
    id: "sched-6",
    timeWindow: "1:15 PM",
    title: "Riverside HVAC follow-up",
    customer: "Riverside Commons",
    address: "31 River Rd.",
    crew: "Avery",
    status: "scheduled",
  },
  {
    id: "sched-7",
    timeWindow: "2:45 PM",
    title: "Storm damage inspection",
    customer: "Chen Residence",
    address: "506 Birch Ct.",
    crew: "Dana + Luis",
    status: "scheduled",
  },
  {
    id: "sched-8",
    timeWindow: "4:00 PM",
    title: "Change order review",
    customer: "Cedar Mill Builders",
    address: "144 Cedar Mill Ln.",
    crew: "Owner",
    status: "scheduled",
  },
];

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

export const mockOwnerActivityEntries: OwnerActivityEntry[] = [
  {
    id: "recent-estimate-approved",
    title: "Recent estimate approved",
    description: "Kitchen lighting upgrade estimate v3 was approved and is ready for proposal follow-through.",
    occurredAt: "2026-07-18T14:10:00.000Z",
    category: "Estimate",
    actor: "Morgan Lee",
    tone: "success",
  },
  {
    id: "invoice-paid",
    title: "Invoice paid",
    description: "Final invoice for the Oak Street panel replacement was paid in full.",
    occurredAt: "2026-07-18T12:35:00.000Z",
    category: "Invoice",
    actor: "TradeOS Payments",
    tone: "success",
  },
  {
    id: "job-completed",
    title: "Job completed",
    description: "The Riverside HVAC service call was marked complete by the field team.",
    occurredAt: "2026-07-17T21:20:00.000Z",
    category: "Job",
    actor: "Avery Chen",
    tone: "info",
  },
  {
    id: "customer-review-received",
    title: "Customer review received",
    description: "The homeowner left a five-star review after the completed bathroom remodel walkthrough.",
    occurredAt: "2026-07-17T16:05:00.000Z",
    category: "Customer",
    actor: "Jamie Rivera",
    tone: "warning",
  },
];

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
