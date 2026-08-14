import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import type { AthenaAuditEvent, AthenaAuditStore } from "./types";

type AuditCorrelation = {
  actionId?: string | null;
  approvalId?: string | null;
};

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

export function createInMemoryAthenaAuditStore(events: AthenaAuditEvent[] = []): AthenaAuditStore & { events: AthenaAuditEvent[] } {
  return {
    events,
    async record(event) {
      const priorAction =
        event.eventType === "execution_completed"
          ? [...events].reverse().find((candidate) => candidate.executionId === event.executionId && candidate.eventType === "action_attempted")
          : undefined;
      events.push(withInheritedActionCorrelation(event, priorAction));
    },
  };
}

export function createPrismaAthenaAuditStore(): AthenaAuditStore {
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
  };
}
