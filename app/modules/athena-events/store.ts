import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import type { AthenaBusinessEvent, AthenaEventActorType, AthenaEventDeadLetter, AthenaEventDelivery, AthenaEventDeliveryStatus } from "./types";

// Application-service-owned persistence seam for A8 events (mirrors
// athena-memory/store.ts's posture verbatim): this is the only file in
// athena-events allowed to import Prisma/db/client - service.ts,
// publisher.ts, dispatch.ts, replay.ts, and every fixture reach persistence
// exclusively through the AthenaEventRepository interface below, never this
// module's internals directly. Enforced by
// athena-events.import-boundary.test.ts.

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

export interface AthenaEventRepository {
  findByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<AthenaBusinessEvent | null>;
  // Atomic: inserts the event row and one pending delivery row per
  // subscriberId in a single transaction, so a publish() call never leaves
  // an event persisted without its full fan-out (or vice versa).
  createEventWithDeliveries(event: AthenaBusinessEvent, subscriberIds: string[]): Promise<{ event: AthenaBusinessEvent; deliveries: AthenaEventDelivery[] }>;
  findEventById(orgId: string, id: string): Promise<AthenaBusinessEvent | null>;
  // status in ('pending', 'failed') and nextAttemptAt <= now, ordered by
  // nextAttemptAt ascending - the pull-based dispatch worker's claim query.
  findDuePendingDeliveries(orgId: string, limit: number): Promise<AthenaEventDelivery[]>;
  getEventForDelivery(delivery: AthenaEventDelivery): Promise<AthenaBusinessEvent | null>;
  markDeliverySucceeded(id: string): Promise<void>;
  markDeliveryFailedAndReschedule(id: string, attemptCount: number, nextAttemptAt: string, lastError: string): Promise<void>;
  // Atomic: transitions the delivery to 'dead_letter' AND inserts the
  // AthenaEventDeadLetter row in the same transaction.
  deadLetterDelivery(id: string, attemptCount: number, failureReason: string, payloadSnapshot: unknown): Promise<AthenaEventDeadLetter>;
  findDeadLetterById(orgId: string, id: string): Promise<AthenaEventDeadLetter | null>;
  listDeadLetters(orgId: string, eventId?: string): Promise<AthenaEventDeadLetter[]>;
  // Creates a NEW delivery row with isReplay=true, replayedFromId set to the
  // dead-lettered delivery's id, status='pending', attemptCount=0. Does not
  // touch the original delivery/dead-letter row.
  createReplayDelivery(orgId: string, eventId: string, subscriberId: string, replayedFromDeliveryId: string): Promise<AthenaEventDelivery>;
}

export function createPrismaAthenaEventRepository(): AthenaEventRepository {
  return {
    async findByIdempotencyKey(orgId, idempotencyKey) {
      const row = await prisma.athenaEvent.findFirst({ where: { orgId, idempotencyKey } });
      return row ? toEventRecord(row) : null;
    },

    // Every real request already runs inside runWithDatabaseSession's own
    // outer transaction, and Prisma does not allow a nested $transaction()
    // on that already-active Prisma.TransactionClient. runInDatabaseTransaction
    // (app/db/requestSession.ts, the same helper athena-memory/store.ts's
    // correct() uses) reuses that ambient transaction when one is active and
    // opens a real one only for callers outside a request session - so this
    // fan-out is still atomic either way. Delivery rows are inserted
    // sequentially (not Promise.all) to keep the transaction's query order
    // deterministic.
    async createEventWithDeliveries(event, subscriberIds) {
      const result = await runInDatabaseTransaction(prisma, async (tx) => {
        const eventRow = await tx.athenaEvent.create({ data: toEventCreateData(event) });
        const deliveryRows: AthenaEventDeliveryRow[] = [];
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
        return { eventRow, deliveryRows };
      });
      return { event: toEventRecord(result.eventRow), deliveries: result.deliveryRows.map(toDeliveryRecord) };
    },

    async findEventById(orgId, id) {
      const row = await prisma.athenaEvent.findFirst({ where: { id, orgId } });
      return row ? toEventRecord(row) : null;
    },

    // Plain SELECT, no claim/lock step (e.g. no `FOR UPDATE SKIP LOCKED`):
    // acceptable only because nothing in this milestone invokes the dispatch
    // worker concurrently or at all in production (plan doc: "pull-based...
    // no distributed platform yet"). A future scheduler that runs more than
    // one dispatch worker against the same org must add row claiming here
    // first, or two workers could dispatch the same delivery twice.
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
