import type { ChangeOrder, Contract, ContractEvent, Invoice, InvoiceDelivery, Project, ProjectFile, ProjectTask, Proposal, ProposalDelivery, SiteVisit } from "@/lib/api";
import { getStatusLabel } from "@/domain";
import { getInvoiceDisplayStatus as deriveInvoiceDisplayStatus, getInvoiceRunningBalance as deriveInvoiceRunningBalance } from "@/lib/invoice-presentation";

export interface WorkflowEvent {
  id: string;
  title: string;
  description: string;
  at: string | null;
  active: boolean;
  category: "estimate" | "proposal" | "contract" | "invoice" | "project" | "file" | "notification" | "site_visit" | "change_order" | "task";
}

export interface WorkflowNotification {
  id: string;
  title: string;
  description: string;
  at: string | null;
  status: "ready" | "attention" | "completed";
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Not set";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatInvoiceCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Not set";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

/**
 * Formats an ISO instant in a specific IANA timezone. Falls back to "UTC"
 * (labeled) for an empty/invalid timezone rather than silently falling
 * through to the runtime's default. Shared by any surface rendering
 * organization-timezone-aware schedule times (dispatch, dashboard "today").
 */
export function formatScheduleInZone(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
  } catch {
    return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} (UTC)`;
  }
}

export function getProposalDisplayStatus(proposal: Proposal) {
  if ((proposal.status === "sent" || proposal.status === "viewed") && proposal.sentAt) {
    const sentAt = new Date(proposal.sentAt).getTime();
    const ageMs = Date.now() - sentAt;
    if (ageMs > 1000 * 60 * 60 * 24 * 30) return "expired";
  }
  return proposal.status;
}

export function getInvoiceDisplayStatus(invoice: Invoice) {
  return deriveInvoiceDisplayStatus(invoice);
}

export function getInvoiceRunningBalance(invoice: Invoice) {
  return deriveInvoiceRunningBalance(invoice);
}

// Backend delivery/event records use dotted event-type names (e.g.
// "proposal.viewed", "contract.signed"). Humanize what we recognize; fall
// back to the raw event type (label-cased) for anything new so an
// unrecognized event still renders instead of disappearing silently.
const EVENT_TYPE_TITLES: Record<string, string> = {
  "proposal.sent": "Proposal sent",
  "proposal.resent": "Proposal resent",
  "proposal.viewed": "Proposal viewed",
  "proposal.accepted": "Proposal accepted",
  "proposal.rejected": "Proposal declined",
  "proposal.declined": "Proposal declined",
  "invoice.sent": "Invoice sent",
  "invoice.viewed": "Invoice viewed",
  "invoice.paid": "Invoice paid",
  "contract.sent": "Contract sent",
  "contract.viewed": "Contract viewed",
  "contract.signed": "Contract signed",
  "contract.voided": "Contract voided",
};

function humanizeEventType(eventType: string) {
  return EVENT_TYPE_TITLES[eventType] ?? getStatusLabel(eventType.split(".").pop() ?? eventType);
}

function describeDeliveryChannel(deliveryChannel: string, recipientEmail: string | null) {
  if (deliveryChannel === "email" && recipientEmail) return `Delivered by email to ${recipientEmail}.`;
  if (deliveryChannel === "email") return "Delivered by email.";
  if (deliveryChannel === "portal") return "Viewed in the customer portal.";
  return "Recorded in the document timeline.";
}

function mapDeliveryEvents(
  id: string,
  category: WorkflowEvent["category"],
  records: Array<{ eventType: string; deliveryChannel?: string; recipientEmail?: string | null; occurredAt: string }>
): WorkflowEvent[] {
  return records
    .map((record, index) => ({
      id: `${id}-${record.eventType}-${index}`,
      title: humanizeEventType(record.eventType),
      description: describeDeliveryChannel(record.deliveryChannel ?? "system", record.recipientEmail ?? null),
      at: record.occurredAt,
      active: true,
      category,
    }))
    .sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime());
}

export function buildProposalTimeline(proposal: Proposal & { deliveries?: ProposalDelivery[] }): WorkflowEvent[] {
  const created: WorkflowEvent = {
    id: `${proposal.id}-draft`,
    title: "Draft created",
    description: "The proposal draft is ready for internal review and pricing.",
    at: proposal.createdAt,
    active: true,
    category: "proposal",
  };

  if (proposal.deliveries && proposal.deliveries.length > 0) {
    return [created, ...mapDeliveryEvents(proposal.id, "proposal", proposal.deliveries)];
  }

  // Legacy fallback for proposals recorded before delivery-history tracking
  // landed: reconstruct from the timestamp fields already on the record.
  return [
    created,
    {
      id: `${proposal.id}-sent`,
      title: "Proposal sent",
      description: "The customer-facing PDF has been issued.",
      at: proposal.sentAt,
      active: Boolean(proposal.sentAt),
      category: "proposal",
    },
    {
      id: `${proposal.id}-viewed`,
      title: "Proposal viewed",
      description: "The customer review milestone was recorded.",
      at: proposal.viewedAt,
      active: Boolean(proposal.viewedAt),
      category: "proposal",
    },
    {
      id: `${proposal.id}-responded`,
      title: getProposalDisplayStatus(proposal) === "declined" ? "Proposal declined" : "Proposal accepted",
      description:
        getProposalDisplayStatus(proposal) === "declined"
          ? "The customer declined the current scope or pricing."
          : "The customer approved the proposal and the job can move to contract.",
      at: proposal.respondedAt,
      active: Boolean(proposal.respondedAt),
      category: "proposal",
    },
  ];
}

export function buildContractTimeline(contract: Contract & { events?: ContractEvent[] }): WorkflowEvent[] {
  const created: WorkflowEvent = {
    id: `${contract.id}-created`,
    title: "Contract created",
    description: "The signable agreement was generated from the accepted proposal.",
    at: contract.createdAt,
    active: true,
    category: "contract",
  };

  if (contract.events && contract.events.length > 0) {
    return [created, ...mapDeliveryEvents(contract.id, "contract", contract.events)];
  }

  return [
    created,
    {
      id: `${contract.id}-signed`,
      title: "Contract signed",
      description: "Signature, timestamp, and audit details were captured.",
      at: contract.signedAt,
      active: Boolean(contract.signedAt),
      category: "contract",
    },
  ];
}

export function buildInvoiceTimeline(invoice: Invoice & { deliveries?: InvoiceDelivery[] }): WorkflowEvent[] {
  const created: WorkflowEvent = {
    id: `${invoice.id}-created`,
    title: invoice.type === "progress" ? "Progress invoice generated" : "Invoice generated",
    description: "Billing is ready for customer delivery.",
    at: invoice.createdAt,
    active: true,
    category: "invoice",
  };
  const due: WorkflowEvent = {
    id: `${invoice.id}-due`,
    title: "Invoice due",
    description: invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}.` : "Due date has not been set yet.",
    at: invoice.dueDate,
    active: Boolean(invoice.dueDate),
    category: "invoice",
  };

  if (invoice.deliveries && invoice.deliveries.length > 0) {
    return [created, ...mapDeliveryEvents(invoice.id, "invoice", invoice.deliveries), due];
  }

  return [
    created,
    {
      id: `${invoice.id}-sent`,
      title: "Invoice sent",
      description: "The customer can review and download the billing PDF.",
      at: invoice.sentAt,
      active: Boolean(invoice.sentAt),
      category: "invoice",
    },
    due,
    {
      id: `${invoice.id}-paid`,
      title: "Invoice paid",
      description: "Payment status has been marked complete.",
      at: invoice.paidAt,
      active: Boolean(invoice.paidAt),
      category: "invoice",
    },
  ];
}

export function buildProjectActivity(project: Project & {
  estimates: Array<{ id: string; version: number; createdAt?: string; totalPrice: number }>;
  siteVisits: SiteVisit[];
  projectFiles: ProjectFile[];
  proposals: Proposal[];
  contracts: Contract[];
  invoices: Invoice[];
  changeOrders: ChangeOrder[];
  tasks: ProjectTask[];
  customer?: { id: string; name: string; createdAt: string } | null;
}): WorkflowEvent[] {
  const events: WorkflowEvent[] = [];

  if (project.customer) {
    events.push({
      id: `${project.customer.id}-created`,
      title: "Customer created",
      description: `${project.customer.name} was added to the TradeOS customer record.`,
      at: project.customer.createdAt,
      active: true,
      category: "project",
    });
  }

  events.push({
    id: `${project.id}-created`,
    title: "Project created",
    description: `${project.name} entered the TradeOS workflow.`,
    at: project.createdAt,
    active: true,
    category: "project",
  });

  for (const estimate of project.estimates) {
    events.push({
      id: estimate.id,
      title: "Estimate created",
      description: `Estimate v${estimate.version} totals ${formatCurrency(estimate.totalPrice)}.`,
      at: estimate.createdAt ?? project.createdAt,
      active: true,
      category: "estimate",
    });
  }

  for (const proposal of project.proposals) {
    events.push(...buildProposalTimeline(proposal));
  }

  for (const contract of project.contracts) {
    events.push(...buildContractTimeline(contract));
  }

  for (const invoice of project.invoices) {
    events.push(...buildInvoiceTimeline(invoice));
  }

  for (const siteVisit of project.siteVisits) {
    events.push({
      id: siteVisit.id,
      title: "Site visit captured",
      description: siteVisit.detailsJson?.arrivalAt
        ? "Arrival, measurements, and field notes were recorded."
        : "Field notes and intake context were saved for estimating.",
      at: siteVisit.createdAt,
      active: true,
      category: "site_visit",
    });
  }

  for (const changeOrder of project.changeOrders) {
    events.push({
      id: `${changeOrder.id}-created`,
      title: `Change Order ${changeOrder.coNumber}`,
      description: `${changeOrder.description} for ${formatCurrency(changeOrder.amount)}.`,
      at: changeOrder.createdAt,
      active: true,
      category: "change_order",
    });

    if (changeOrder.approvedAt) {
      events.push({
        id: `${changeOrder.id}-approved`,
        title: `Change Order ${changeOrder.coNumber} approved`,
        description: "The scope change is approved and ready for execution.",
        at: changeOrder.approvedAt,
        active: true,
        category: "change_order",
      });
    }

    if (changeOrder.rejectedAt) {
      events.push({
        id: `${changeOrder.id}-rejected`,
        title: `Change Order ${changeOrder.coNumber} rejected`,
        description: "The scope change was rejected and should not proceed.",
        at: changeOrder.rejectedAt,
        active: true,
        category: "change_order",
      });
    }
  }

  for (const task of project.tasks) {
    events.push({
      id: `${task.id}-created`,
      title: "Task created",
      description: task.title,
      at: task.createdAt,
      active: true,
      category: "task",
    });

    if (task.completedAt) {
      events.push({
        id: `${task.id}-completed`,
        title: "Task completed",
        description: task.title,
        at: task.completedAt,
        active: true,
        category: "task",
      });
    }
  }

  for (const file of project.projectFiles.slice(0, 4)) {
    events.push({
      id: file.id,
      title: "Attachment added",
      description: `${file.fileName} was saved to the project record.`,
      at: file.createdAt,
      active: true,
      category: "file",
    });
  }

  return events.sort((a, b) => {
    const aTime = a.at ? new Date(a.at).getTime() : 0;
    const bTime = b.at ? new Date(b.at).getTime() : 0;
    return bTime - aTime;
  });
}

export function buildProjectNotifications(project: Project & { proposals: Proposal[]; contracts: Contract[]; invoices: Invoice[] }): WorkflowNotification[] {
  const notices: WorkflowNotification[] = [];

  for (const proposal of project.proposals) {
    const status = getProposalDisplayStatus(proposal);
    if (status === "sent") {
      notices.push({
        id: `${proposal.id}-proposal-sent`,
        title: "Proposal sent",
        description: "Mock notification framework is ready to deliver the proposal issue event.",
        at: proposal.sentAt,
        status: "ready",
      });
    }
    if (status === "viewed") {
      notices.push({
        id: `${proposal.id}-proposal-viewed`,
        title: "Proposal viewed",
        description: "Follow up while the customer is actively reviewing the scope.",
        at: proposal.viewedAt,
        status: "attention",
      });
    }
    if (status === "accepted") {
      notices.push({
        id: `${proposal.id}-proposal-accepted`,
        title: "Proposal accepted",
        description: "Kick off the contract and production handoff.",
        at: proposal.respondedAt,
        status: "completed",
      });
    }
  }

  for (const contract of project.contracts) {
    if (contract.status === "signed") {
      notices.push({
        id: `${contract.id}-contract-signed`,
        title: "Contract signed",
        description: "Audit data is captured and the file is ready for download.",
        at: contract.signedAt,
        status: "completed",
      });
    }
  }

  for (const invoice of project.invoices) {
    const status = getInvoiceDisplayStatus(invoice);
    if (status === "overdue") {
      notices.push({
        id: `${invoice.id}-invoice-due`,
        title: "Invoice due",
        description: "Outstanding balance needs follow-up with the customer.",
        at: invoice.dueDate,
        status: "attention",
      });
    }
    if (status === "paid") {
      notices.push({
        id: `${invoice.id}-invoice-paid`,
        title: "Invoice paid",
        description: "Payment was recorded and the invoice balance is closed.",
        at: invoice.paidAt,
        status: "completed",
      });
    }
  }

  return notices.sort((a, b) => {
    const aTime = a.at ? new Date(a.at).getTime() : 0;
    const bTime = b.at ? new Date(b.at).getTime() : 0;
    return bTime - aTime;
  });
}
