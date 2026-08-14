import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import type { AthenaAuditEvent, AthenaAuditRepository, AthenaAuditStore } from "./types";

type AuditCorrelation = {
  actionId?: string | null;
  approvalId?: string | null;
};

const TERMINAL_AUDIT_EVENTS = new Set<AthenaAuditEvent["eventType"]>(["execution_completed", "failure"]);

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
  };
}

export function createPrismaAthenaAuditStore(): AthenaAuditRepository {
  return {
    async record(event) {
      const priorAction =
        event.eventType === "execution_completed" && (!event.actionId || !event.approvalId)
          ? await prisma.athenaAuditEvent.findFirst({
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

      await prisma.athenaAuditEvent.create({
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
      const rows = await prisma.athenaAuditEvent.findMany({
        where: {
          orgId: query.organizationId,
          OR: [{ approvalId: query.approvalId }, { actionId: query.actionId }],
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
      });
      return rows.map(toAuditEvent);
    },
  };
}
