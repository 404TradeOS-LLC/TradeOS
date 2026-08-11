import { randomUUID } from "node:crypto";
import type { AthenaEventRepository } from "../store";
import type { AthenaBusinessEvent, AthenaEventDeadLetter, AthenaEventDelivery } from "../types";

// Test-only in-memory AthenaEventRepository, same posture as
// athena-memory/fixtures/inMemoryRepository.ts and A6's
// createInMemoryAthenaIdempotencyStore(). Never registered outside test
// setup - production always uses store.ts's createPrismaAthenaEventRepository().
export function createInMemoryAthenaEventRepository(): AthenaEventRepository {
  const events = new Map<string, AthenaBusinessEvent>();
  const deliveries = new Map<string, AthenaEventDelivery>();
  const deadLetters = new Map<string, AthenaEventDeadLetter>();

  return {
    async findByIdempotencyKey(orgId, idempotencyKey) {
      for (const event of events.values()) {
        if (event.orgId === orgId && event.idempotencyKey === idempotencyKey) return { ...event };
      }
      return null;
    },

    async createEventWithDeliveries(event, subscriberIds) {
      events.set(event.id, { ...event });
      const now = new Date().toISOString();
      const created = subscriberIds.map((subscriberId): AthenaEventDelivery => {
        const delivery: AthenaEventDelivery = {
          id: randomUUID(),
          orgId: event.orgId,
          eventId: event.id,
          subscriberId,
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          isReplay: false,
          createdAt: now,
          updatedAt: now,
        };
        deliveries.set(delivery.id, delivery);
        return { ...delivery };
      });
      return { event: { ...event }, deliveries: created };
    },

    async findEventById(orgId, id) {
      const event = events.get(id);
      return event && event.orgId === orgId ? { ...event } : null;
    },

    async findDuePendingDeliveries(orgId, limit) {
      const now = Date.now();
      const matches = [...deliveries.values()]
        .filter((delivery) => delivery.orgId === orgId && (delivery.status === "pending" || delivery.status === "failed") && new Date(delivery.nextAttemptAt).getTime() <= now)
        .sort((a, b) => new Date(a.nextAttemptAt).getTime() - new Date(b.nextAttemptAt).getTime());
      return matches.slice(0, limit).map((delivery) => ({ ...delivery }));
    },

    async getEventForDelivery(delivery) {
      const event = events.get(delivery.eventId);
      return event && event.orgId === delivery.orgId ? { ...event } : null;
    },

    async markDeliverySucceeded(id) {
      const delivery = deliveries.get(id);
      if (!delivery) return;
      const now = new Date().toISOString();
      deliveries.set(id, { ...delivery, status: "succeeded", succeededAt: now, lastAttemptAt: now, updatedAt: now });
    },

    async markDeliveryFailedAndReschedule(id, attemptCount, nextAttemptAt, lastError) {
      const delivery = deliveries.get(id);
      if (!delivery) return;
      const now = new Date().toISOString();
      deliveries.set(id, { ...delivery, status: "failed", attemptCount, nextAttemptAt, lastError, lastAttemptAt: now, updatedAt: now });
    },

    async deadLetterDelivery(id, attemptCount, failureReason, payloadSnapshot) {
      const delivery = deliveries.get(id);
      if (!delivery) {
        throw new Error("createInMemoryAthenaEventRepository.deadLetterDelivery: unknown delivery id");
      }
      const now = new Date().toISOString();
      const updated: AthenaEventDelivery = { ...delivery, status: "dead_letter", attemptCount, lastError: failureReason, lastAttemptAt: now, updatedAt: now };
      deliveries.set(id, updated);

      const deadLetter: AthenaEventDeadLetter = {
        id: randomUUID(),
        orgId: updated.orgId,
        deliveryId: updated.id,
        eventId: updated.eventId,
        subscriberId: updated.subscriberId,
        failureReason,
        payloadSnapshot,
        attemptCount,
        createdAt: now,
      };
      deadLetters.set(deadLetter.id, deadLetter);
      return { ...deadLetter };
    },

    async findDeadLetterById(orgId, id) {
      const deadLetter = deadLetters.get(id);
      return deadLetter && deadLetter.orgId === orgId ? { ...deadLetter } : null;
    },

    async listDeadLetters(orgId, eventId) {
      return [...deadLetters.values()]
        .filter((deadLetter) => deadLetter.orgId === orgId && (!eventId || deadLetter.eventId === eventId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((deadLetter) => ({ ...deadLetter }));
    },

    async createReplayDelivery(orgId, eventId, subscriberId, replayedFromDeliveryId) {
      const now = new Date().toISOString();
      const delivery: AthenaEventDelivery = {
        id: randomUUID(),
        orgId,
        eventId,
        subscriberId,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: now,
        isReplay: true,
        replayedFromId: replayedFromDeliveryId,
        createdAt: now,
        updatedAt: now,
      };
      deliveries.set(delivery.id, delivery);
      return { ...delivery };
    },
  };
}
