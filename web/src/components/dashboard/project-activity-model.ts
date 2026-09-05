import type { ActivityEvent } from "../../lib/api";
import type { OwnerActivityEntry, OwnerActivityTone } from "./owner-dashboard-data";

// Titles for the project-scoped activity events ActivityTimelineService
// actually records today (see app/modules/proposals/service.ts,
// app/modules/contracts/service.ts, app/modules/invoices/service.ts, and
// app/backend/controllers/projects.controller.ts). Anything not listed here
// falls back to the event's own `title` field rather than being dropped, so
// a new event type still renders instead of disappearing silently.
const EVENT_TITLES: Record<string, string> = {
  "project.created": "Project created",
  "project.status_changed": "Project status changed",
  "site_visit.created": "Site visit captured",
  "proposal.sent": "Proposal sent",
  "proposal.resent": "Proposal resent",
  "proposal.viewed": "Proposal viewed",
  "proposal.accepted": "Proposal accepted",
  "proposal.declined": "Proposal declined",
  "contract.created": "Contract created",
  "contract.signed": "Contract signed",
  "contract.voided": "Contract voided",
  "invoice.created": "Invoice created",
  "invoice.sent": "Invoice sent",
  "invoice.paid": "Payment recorded",
  "invoice.voided": "Invoice voided",
};

const EVENT_CATEGORIES: Record<string, string> = {
  project: "Project",
  site_visit: "Site visit",
  proposal: "Proposal",
  contract: "Contract",
  invoice: "Invoice",
};

const SUCCESS_EVENT_TYPES = new Set(["proposal.accepted", "contract.signed", "invoice.paid"]);
const WARNING_EVENT_TYPES = new Set(["proposal.declined", "contract.voided", "invoice.voided"]);

function getProjectActivityTone(eventType: string): OwnerActivityTone {
  if (SUCCESS_EVENT_TYPES.has(eventType)) return "success";
  if (WARNING_EVENT_TYPES.has(eventType)) return "warning";
  return "info";
}

function getProjectActivityCategory(eventType: string): string {
  const entity = eventType.split(".")[0];
  return EVENT_CATEGORIES[entity] ?? "Project";
}

/**
 * Maps project-scoped activity events (proposal, contract, invoice, and
 * project lifecycle milestones recorded by ActivityTimelineService) into the
 * same OwnerActivityEntry shape the task activity feed already uses, so
 * Recent Activity reflects real document-workflow movement — not only task
 * status changes.
 */
export function buildProjectActivityEntries(events: ActivityEvent[]): OwnerActivityEntry[] {
  return events.map((event) => ({
    id: event.id,
    title: EVENT_TITLES[event.eventType] ?? event.title,
    description: event.description ?? "Recorded in the project activity timeline.",
    occurredAt: event.occurredAt,
    category: getProjectActivityCategory(event.eventType),
    actor: event.actorUserId ? `User ${event.actorUserId}` : "TradeOS",
    tone: getProjectActivityTone(event.eventType),
  }));
}

/**
 * Interleaves task and project activity entries newest-first into one feed,
 * capped to `limit`, so the dashboard shows one merged timeline instead of
 * two separately-ordered lists.
 */
export function mergeActivityEntries(taskEntries: OwnerActivityEntry[], projectEntries: OwnerActivityEntry[], limit = 8): OwnerActivityEntry[] {
  return [...taskEntries, ...projectEntries].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, limit);
}
