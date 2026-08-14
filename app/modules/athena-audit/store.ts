import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import type { AthenaAuditEvent, AthenaAuditStore } from "./types";

export function createInMemoryAthenaAuditStore(events: AthenaAuditEvent[] = []): AthenaAuditStore & { events: AthenaAuditEvent[] } {
  return {
    events,
    async record(event) {
      events.push(event);
    },
  };
}

export function createPrismaAthenaAuditStore(): AthenaAuditStore {
  return {
    async record(event) {
      await prisma.athenaAuditEvent.create({
        data: {
          id: event.id,
          orgId: event.organization,
          actorUserId: event.actor.userId,
          actorRole: event.actor.role,
          requestId: event.requestId,
          traceId: event.traceId,
          executionId: event.executionId,
          actionId: event.actionId,
          approvalId: event.approvalId,
          eventType: event.eventType,
          metadataJson: event.metadata as Prisma.InputJsonValue,
          createdAt: event.timestamp,
        },
      });
    },
  };
}
