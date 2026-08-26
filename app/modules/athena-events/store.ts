import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { getRequestDatabaseClient, runInDatabaseTransaction } from "../../db/requestSession";
import type { AthenaBusinessEvent, AthenaEventActorType, AthenaEventDeadLetter, AthenaEventDelivery, AthenaEventDeliveryStatus } from "./types";

type AthenaEventRow = Awaited<ReturnType<typeof prisma.athenaEvent.findFirstOrThrow>>;
type AthenaEventDeliveryRow = Awaited<ReturnType<typeof prisma.athenaEventDelivery.findFirstOrThrow>>;
type AthenaEventDeadLetterRow = Awaited<ReturnType<typeof prisma.athenaEventDeadLetter.findFirstOrThrow>>;

export function runAthenaEventTransaction<T>(operation: () => Promise<T>): Promise<T> {
  return runInDatabaseTransaction(prisma, operation);
}

function toEventRecord(row: AthenaEventRow): AthenaBusinessEvent {
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    orgId: row.orgId,
    entity: { type: row.entityType, id: row.entityId },
    actor: { type: row.actorType as AthenaEventActorType, id: row.actorId },
    occurredAt: row.occurredAt.toISOString(),
    payload: row.payloadJson,
    correlationId: row.correlationId,
    idempotencyKey: row.idempotencyKey,
    causationId: row.causationId ?? undefined,
    isReplay: row.isReplay,
    replayedAt: row.replayedAt?.toISOString(),
  };
}

function toEventCreateData(event: AthenaBusinessEvent) {
  return {
    id: event.id,
    orgId: event.orgId,
    type: event.type,
    version: event.version,
    entityType: event.entity.type,
    entityId: event.entity.id,
    actorType: event.actor.type,
    actorId: event.actor.id,
    occurredAt: new Date(event.occurredAt),
    payloadJson: event.payload as Prisma.InputJsonValue,
    correlationId: event.correlationId,
    idempotencyKey: event.idempotencyKey,
    causationId: event.causationId,
    isReplay: event.isReplay ?? false,
    replayedAt: event.replayedAt ? new Date(event.replayedAt) : undefined,
  };
}

function toDeliveryRecord(row: AthenaEventDeliveryRow): AthenaEventDelivery {
  return {
    id: row.id,
    orgId: row.orgId,
    eventId: row.eventId,
    subscriberId: row.subscriberId,
    status: row.status as AthenaEventDeliveryStatus,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lastError: row.lastError ?? undefined,
    lastAttemptAt: row.lastAttemptAt?.toISOString(),
    succeededAt: row.succeededAt?.toISOString(),
    isReplay: row.isReplay,
    replayedFromId: row.replayedFromId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDeadLetterRecord(row: AthenaEventDeadLetterRow): AthenaEventDeadLetter {
  return {
    id: row.id,
    orgId: row.orgId,
    deliveryId: row.deliveryId,
    eventId: row.eventId,
    subscriberId: row.subscriberId,
    failureReason: row.failureReason,
    payloadSnapshot: row.payloadSnapshotJson,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
  };
}

// Preserve the post-A12 savepoint isolation already on main: best-effort event
// operations outside the required transactional wrapper must not poison an
// ambient request transaction when PostgreSQL rejects an event query/write.
async function withRepositorySavepoint<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const activeTransaction = getRequestDatabaseClient();
  if (!activeTransaction) {
    return runInDatabaseTransaction(prisma, operation);
  }

  const savepoint = `athena_events_${randomUUID().replace(/-/g, "")}`;
  await activeTransaction.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
  try {
    const result = await operation(activeTransaction);
    await activeTransaction.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
    return result;
  } catch (error) {
    await activeTransaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
    throw error;
  }
}

export interface AthenaEventRepository {
  findByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<AthenaBusinessEvent | null>;
  createEventWithDeliveries(event: AthenaBusinessEvent, subscriberIds: string[]): Promise<{ event: AthenaBusinessEvent; deliveries: AthenaEventDelivery[] }>;
  findEventById(orgId: string, id: string): Promise<AthenaBusinessEvent | null>;
  findDuePendingDeliveries(orgId: string, limit: number): Promise<AthenaEventDelivery[]>;
  getEventForDelivery(delivery: AthenaEventDelivery): Promise<AthenaBusinessEvent | null>;
  markDeliverySucceeded(id: string): Promise<void>;
  markDeliveryFailedAndReschedule(id: string, attemptCount: number, nextAttemptAt: string, lastError: string): Promise<void>;
  deadLetterDelivery(id: string, attemptCount: number, failureReason: string, payloadSnapshot: unknown): Promise<AthenaEventDeadLetter>;
  findDeadLetterById(orgId: string, id: string): Promise<AthenaEventDeadLetter | null>;
  listDeadLetters(orgId: string, eventId?: string): Promise<AthenaEventDeadLetter[]>;
  createReplayDelivery(orgId: string, eventId: string, subscriberId: string, replayedFromDeliveryId: string): Promise<AthenaEventDelivery>;
}

export function createPrismaAthenaEventRepository(): AthenaEventRepository {
  return {
    async findByIdempotencyKey(orgId, idempotencyKey) {
      return withRepositorySavepoint(async (tx) => {
        const row = await tx.athenaEvent.findFirst({ where: { orgId, idempotencyKey } });
        return row ? toEventRecord(row) : null;
      });
    },

    async createEventWithDeliveries(event, subscriberIds) {
      const result = await withRepositorySavepoint(async (tx) => {
        // Conflict-safe insertion is required inside an ambient business
        // transaction: a normal unique-constraint exception would abort the
        // PostgreSQL transaction before the concurrent winner can be read.
        const inserted = await tx.athenaEvent.createMany({
          data: toEventCreateData(event),
          skipDuplicates: true,
        });

        const eventRow = await tx.athenaEvent.findFirst({
          where: { orgId: event.orgId, idempotencyKey: event.idempotencyKey },
        });
        if (!eventRow) {
          throw new Error("Athena event could not be reconciled after idempotent insert");
        }

        const deliveryRows: AthenaEventDeliveryRow[] = [];
        if (inserted.count > 0) {
          for (const subscriberId of subscriberIds) {
            const deliveryRow = await tx.athenaEventDelivery.create({
              data: {
                id: randomUUID(),
                orgId: event.orgId,
                eventId: eventRow.id,
                subscriberId,
                status: "pending",
                attemptCount: 0,
                nextAttemptAt: new Date(),
                isReplay: false,
              },
            });
            deliveryRows.push(deliveryRow);
          }
        }
        return { eventRow, deliveryRows };
      });
      return { event: toEventRecord(result.eventRow), deliveries: result.deliveryRows.map(toDeliveryRecord) };
    },

    async findEventById(orgId, id) {
      const row = await prisma.athenaEvent.findFirst({ where: { id, orgId } });
      return row ? toEventRecord(row) : null;
    },

    async findDuePendingDeliveries(orgId, limit) {
      const rows = await prisma.athenaEventDelivery.findMany({
        where: { orgId, status: { in: ["pending", "failed"] }, nextAttemptAt: { lte: new Date() } },
        orderBy: { nextAttemptAt: "asc" },
        take: limit,
      });
      return rows.map(toDeliveryRecord);
    },

    async getEventForDelivery(delivery) {
      const row = await prisma.athenaEvent.findFirst({ where: { id: delivery.eventId, orgId: delivery.orgId } });
      return row ? toEventRecord(row) : null;
    },

    async markDeliverySucceeded(id) {
      const now = new Date();
      await prisma.athenaEventDelivery.update({ where: { id }, data: { status: "succeeded", succeededAt: now, lastAttemptAt: now } });
    },

    async markDeliveryFailedAndReschedule(id, attemptCount, nextAttemptAt, lastError) {
      await prisma.athenaEventDelivery.update({
        where: { id },
        data: { status: "failed", attemptCount, nextAttemptAt: new Date(nextAttemptAt), lastError, lastAttemptAt: new Date() },
      });
    },

    async deadLetterDelivery(id, attemptCount, failureReason, payloadSnapshot) {
      const deadLetterRow = await runInDatabaseTransaction(prisma, async (tx) => {
        const deliveryRow = await tx.athenaEventDelivery.update({
          where: { id },
          data: { status: "dead_letter", attemptCount, lastError: failureReason, lastAttemptAt: new Date() },
        });
        return tx.athenaEventDeadLetter.create({
          data: {
            id: randomUUID(),
            orgId: deliveryRow.orgId,
            deliveryId: deliveryRow.id,
            eventId: deliveryRow.eventId,
            subscriberId: deliveryRow.subscriberId,
            failureReason,
            payloadSnapshotJson: (payloadSnapshot ?? null) as Prisma.InputJsonValue,
            attemptCount,
          },
        });
      });
      return toDeadLetterRecord(deadLetterRow);
    },

    async findDeadLetterById(orgId, id) {
      const row = await prisma.athenaEventDeadLetter.findFirst({ where: { id, orgId } });
      return row ? toDeadLetterRecord(row) : null;
    },

    async listDeadLetters(orgId, eventId) {
      const rows = await prisma.athenaEventDeadLetter.findMany({
        where: { orgId, ...(eventId ? { eventId } : {}) },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDeadLetterRecord);
    },

    async createReplayDelivery(orgId, eventId, subscriberId, replayedFromDeliveryId) {
      const row = await prisma.athenaEventDelivery.create({
        data: {
          id: randomUUID(),
          orgId,
          eventId,
          subscriberId,
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: new Date(),
          isReplay: true,
          replayedFromId: replayedFromDeliveryId,
        },
      });
      return toDeliveryRecord(row);
    },
  };
}
