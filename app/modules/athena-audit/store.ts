import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../db/client";
import { athenaSecurityAuditEventTypes, type AthenaAuditEvent, type AthenaAuditRepository, type AthenaAuditStore, type AthenaSecurityAuditQuery } from "./types";

type AuditCorrelation = {
  actionId?: string | null;
  approvalId?: string | null;
};

const TERMINAL_AUDIT_EVENTS = new Set<AthenaAuditEvent["eventType"]>(["execution_completed", "failure"]);
const SECURITY_AUDIT_EVENTS = new Set<string>(athenaSecurityAuditEventTypes);
const DEFAULT_SECURITY_EVENT_LIMIT = 50;
const MAX_SECURITY_EVENT_LIMIT = 200;

function securityEventLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_SECURITY_EVENT_LIMIT, 1), MAX_SECURITY_EVENT_LIMIT);
}

function isSecurityEvent(event: AthenaAuditEvent): boolean {
  return SECURITY_AUDIT_EVENTS.has(event.eventType);
}

function matchesSecurityQuery(event: AthenaAuditEvent, query: AthenaSecurityAuditQuery): boolean {
  const outcome = event.metadata.outcome;
  return (
    isSecurityEvent(event) &&
    event.organization === query.organizationId &&
    (!query.eventTypes || query.eventTypes.includes(event.eventType as (typeof athenaSecurityAuditEventTypes)[number])) &&
    (!query.actorUserId || event.actor.userId === query.actorUserId) &&
    (!query.outcome || outcome === query.outcome) &&
    (!query.from || event.timestamp >= query.from) &&
    (!query.to || event.timestamp <= query.to)
  );
}

function withInheritedActionCorrelation(event: AthenaAuditEvent, prior?: AuditCorrelation | null): AthenaAuditEvent {
  if (event.eventType !== "execution_completed" || (event.actionId && event.approvalId)) {
    return event;
  }
  return {
    ...event,
    actionId: event.actionId ?? prior?.actionId ?? undefined,
    approvalId: event.approvalId ?? prior?.approvalId ?? undefined,
  };
}

function toAuditEvent(row: {
  id: string;
  createdAt: Date;
  actorUserId: string | null;
  actorRole: string | null;
  orgId: string;
  eventType: string;
  metadataJson: Prisma.JsonValue;
  requestId: string | null;
  traceId: string | null;
  executionId: string | null;
  actionId: string | null;
  approvalId: string | null;
}): AthenaAuditEvent {
  return {
    id: row.id,
    timestamp: row.createdAt,
    actor: { userId: row.actorUserId, role: row.actorRole },
    organization: row.orgId,
    eventType: row.eventType as AthenaAuditEvent["eventType"],
    metadata: (row.metadataJson ?? {}) as Record<string, unknown>,
    requestId: row.requestId ?? undefined,
    traceId: row.traceId ?? undefined,
    executionId: row.executionId ?? undefined,
    actionId: row.actionId ?? undefined,
    approvalId: row.approvalId ?? undefined,
  };
}

export type AthenaTerminalTrackingAuditStore = AthenaAuditStore & {
  hasTerminalEvent(executionId: string): boolean;
};

export function createTerminalTrackingAthenaAuditStore(delegate: AthenaAuditStore): AthenaTerminalTrackingAuditStore {
  const terminalExecutions = new Set<string>();
  return {
    async record(event) {
      await delegate.record(event);
      if (event.executionId && TERMINAL_AUDIT_EVENTS.has(event.eventType)) {
        terminalExecutions.add(event.executionId);
      }
    },
    hasTerminalEvent(executionId) {
      return terminalExecutions.has(executionId);
    },
  };
}

export function createInMemoryAthenaAuditStore(events: AthenaAuditEvent[] = []): AthenaAuditRepository & { events: AthenaAuditEvent[] } {
  return {
    events,
    async record(event) {
      const priorAction =
        event.eventType === "execution_completed"
          ? [...events].reverse().find((candidate) => candidate.executionId === event.executionId && candidate.eventType === "action_attempted")
          : undefined;
      events.push(withInheritedActionCorrelation(event, priorAction));
    },
    async listForApproval(query) {
      return events
        .filter(
          (event) =>
            event.organization === query.organizationId &&
            (event.approvalId === query.approvalId || event.actionId === query.actionId)
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, query.limit);
    },
    async listSecurityEvents(query) {
      return events
        .filter((event) => matchesSecurityQuery(event, query))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, securityEventLimit(query.limit));
    },
  };
}

type AthenaAuditDatabase = Pick<PrismaClient, "athenaAuditEvent">;

export function createPrismaAthenaAuditStore(database: AthenaAuditDatabase = prisma): AthenaAuditRepository {
  return {
    async record(event) {
      const priorAction =
        event.eventType === "execution_completed" && (!event.actionId || !event.approvalId)
          ? await database.athenaAuditEvent.findFirst({
              where: {
                orgId: event.organization,
                executionId: event.executionId,
                eventType: "action_attempted",
              },
              orderBy: { createdAt: "desc" },
              select: { actionId: true, approvalId: true },
            })
          : null;
      const correlatedEvent = withInheritedActionCorrelation(event, priorAction);

      await database.athenaAuditEvent.create({
        data: {
          id: correlatedEvent.id,
          orgId: correlatedEvent.organization,
          actorUserId: correlatedEvent.actor.userId,
          actorRole: correlatedEvent.actor.role,
          requestId: correlatedEvent.requestId,
          traceId: correlatedEvent.traceId,
          executionId: correlatedEvent.executionId,
          actionId: correlatedEvent.actionId,
          approvalId: correlatedEvent.approvalId,
          eventType: correlatedEvent.eventType,
          metadataJson: correlatedEvent.metadata as Prisma.InputJsonValue,
          createdAt: correlatedEvent.timestamp,
        },
      });
    },
    async listForApproval(query) {
      const rows = await database.athenaAuditEvent.findMany({
        where: {
          orgId: query.organizationId,
          OR: [{ approvalId: query.approvalId }, { actionId: query.actionId }],
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
      });
      return rows.map(toAuditEvent);
    },
    async listSecurityEvents(query) {
      const rows = await database.athenaAuditEvent.findMany({
        where: {
          orgId: query.organizationId,
          eventType: { in: [...(query.eventTypes ?? athenaSecurityAuditEventTypes)] },
          actorUserId: query.actorUserId,
          createdAt: { gte: query.from, lte: query.to },
          metadataJson: query.outcome
            ? { path: ["outcome"], equals: query.outcome }
            : undefined,
        },
        orderBy: { createdAt: "desc" },
        take: securityEventLimit(query.limit),
      });
      return rows.map(toAuditEvent);
    },
  };
}
