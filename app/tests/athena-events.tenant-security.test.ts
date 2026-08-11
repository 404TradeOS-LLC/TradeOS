import { dispatchAthenaEventDelivery } from "../modules/athena-events/dispatch";
import { AthenaEventError } from "../modules/athena-events/errors";
import { createInMemoryAthenaEventRepository } from "../modules/athena-events/fixtures/inMemoryRepository";
import { publishAthenaEvent } from "../modules/athena-events/publisher";
import { createAthenaEventService } from "../modules/athena-events/service";
import { ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS, ATHENA_EVENT_RETRY_BASE_DELAY_MS } from "../modules/athena-events/retryPolicy";
import type { AthenaEventRepository } from "../modules/athena-events/store";
import type { AthenaEventActor, AthenaEventSubscriber, AthenaPublishEventInput } from "../modules/athena-events/types";

// A8 tenant-security coverage (docs/athena/roadmap/
// A8-event-integration-implementation-plan.md "Required Tests":
// athena-events.tenant-security.test.ts; docs/athena/09-security/README.md's
// "Tenant isolation" invariant; docs/athena/10-events/README.md's
// "Replay is not authorization" and "Publisher And Subscriber Rules").
// Exercises the application layer (service.ts) and the dispatch layer
// (dispatch.ts) against the in-memory repository fixture - no live database
// needed; the database-floor proof lives in athena-events.rls.integration.ts.

const ORG_A = "org-a";
const ORG_B = "org-b";

function actorFor(orgId: string, userId: string): AthenaEventActor {
  return { type: "user", id: userId, orgId };
}

function buildInput(overrides: Partial<AthenaPublishEventInput> = {}): AthenaPublishEventInput {
  return {
    orgId: ORG_A,
    type: "ProposalSent",
    version: "1.0.0",
    entity: { type: "proposal", id: "proposal-1" },
    actor: { type: "user", id: "user-a1" },
    payload: { proposalId: "proposal-1" },
    correlationId: "corr-1",
    idempotencyKey: "proposal-1:sent:v1",
    ...overrides,
  };
}

async function dispatchOneDeliveryToDeadLetter(
  repository: AthenaEventRepository,
  orgId: string,
  subscriber: AthenaEventSubscriber
): Promise<string> {
  let due = await repository.findDuePendingDeliveries(orgId, 10);
  let lastOutcome;
  for (let attempt = 1; attempt <= ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS; attempt += 1) {
    lastOutcome = await dispatchAthenaEventDelivery(repository, due[0], [subscriber]);
    if (attempt < ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS) {
      jest.setSystemTime(new Date(Date.now() + ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2 ** attempt));
      due = await repository.findDuePendingDeliveries(orgId, 10);
    }
  }
  if (lastOutcome?.status !== "dead_lettered") {
    throw new Error("test setup expected the delivery to exhaust its retry budget");
  }
  const [deadLetter] = await repository.listDeadLetters(orgId);
  return deadLetter.id;
}

describe("athena-events tenant security", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // 1. Cross-org read denial: an event published under org A cannot be read
  // via getById(orgB, actorB, eventId) - service.ts's getById returns null
  // on an actor/orgId mismatch (anti-enumeration posture), it never throws.
  it("never returns an org A event through getById called with org B's org/actor", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const service = createAthenaEventService({ repository, subscribers: [] });

    const { event } = await service.publish(buildInput({ orgId: ORG_A }));

    const asOrgB = await service.getById(ORG_B, actorFor(ORG_B, "user-b1"), event.id);
    expect(asOrgB).toBeNull();

    // Same posture even if a caller's actor object lies about its own org -
    // the service checks actor.orgId === orgId, not just the orgId argument.
    const spoofedActor = await service.getById(ORG_B, actorFor(ORG_A, "user-a1"), event.id);
    expect(spoofedActor).toBeNull();

    // Control: org A can read its own event.
    const asOrgA = await service.getById(ORG_A, actorFor(ORG_A, "user-a1"), event.id);
    expect(asOrgA?.id).toBe(event.id);
  });

  // 2. Cross-org dead-letter read denial: listDeadLetters(orgB, actorB)
  // never returns org A's dead letters, for any eventId filter.
  it("never returns org A's dead letters through listDeadLetters called as org B, for any eventId filter", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const failingSubscriber: AthenaEventSubscriber = { id: "sub-fail", eventType: "ProposalSent", handler: jest.fn().mockRejectedValue(new Error("boom")) };
    const service = createAthenaEventService({ repository, subscribers: [failingSubscriber] });

    const { event } = await service.publish(buildInput({ orgId: ORG_A }));
    await dispatchOneDeliveryToDeadLetter(repository, ORG_A, failingSubscriber);

    const actorB = actorFor(ORG_B, "user-b1");
    expect(await service.listDeadLetters(ORG_B, actorB)).toEqual([]);
    expect(await service.listDeadLetters(ORG_B, actorB, event.id)).toEqual([]);
    expect(await service.listDeadLetters(ORG_B, actorB, "nonexistent-event-id")).toEqual([]);
    expect(await service.listDeadLetters(ORG_B, actorB, undefined)).toEqual([]);

    // Control: org A can see its own dead letter.
    const asOrgA = await service.listDeadLetters(ORG_A, actorFor(ORG_A, "user-a1"));
    expect(asOrgA).toHaveLength(1);
  });

  // 3. Cross-org replay denial: replayDeadLetter(orgB, actorB,
  // deadLetterIdFromOrgA) throws AthenaEventError with a denial/not-found
  // reasonCode, not a generic crash.
  it("refuses to replay org A's dead letter when called as org B", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const failingSubscriber: AthenaEventSubscriber = { id: "sub-fail", eventType: "ProposalSent", handler: jest.fn().mockRejectedValue(new Error("boom")) };
    const service = createAthenaEventService({ repository, subscribers: [failingSubscriber] });

    await service.publish(buildInput({ orgId: ORG_A }));
    const deadLetterId = await dispatchOneDeliveryToDeadLetter(repository, ORG_A, failingSubscriber);

    const actorB = actorFor(ORG_B, "user-b1");
    await expect(service.replayDeadLetter(ORG_B, actorB, deadLetterId)).rejects.toThrow(AthenaEventError);
    await expect(service.replayDeadLetter(ORG_B, actorB, deadLetterId)).rejects.toMatchObject({
      reasonCode: expect.stringMatching(/^(authorization_denied|not_found)$/),
    });

    // Control: org A can replay its own dead letter.
    const replayed = await service.replayDeadLetter(ORG_A, actorFor(ORG_A, "user-a1"), deadLetterId);
    expect(replayed.status).toBe("pending");
    expect(replayed.isReplay).toBe(true);
  });

  // 4. Replay re-authorization at the dispatch layer: when a delivery's
  // orgId no longer resolves to an existing event under that org (simulated
  // here by overriding the repository's findEventById re-check, the same
  // technique athena-events.replay.test.ts already uses for replay.ts's
  // equivalent defense-in-depth check), dispatchAthenaEventDelivery must
  // refuse to invoke the subscriber handler at all and must reschedule or
  // dead-letter with the entity_ownership_revalidation_failed reason.
  it("never invokes the subscriber handler when the post-fetch ownership re-check finds the event no longer resolves under the delivery's org", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const handler = jest.fn().mockResolvedValue(undefined);
    const subscriber: AthenaEventSubscriber = { id: "sub-1", eventType: "ProposalSent", handler };

    await publishAthenaEvent(repository, buildInput({ orgId: ORG_A }), [subscriber]);
    const [delivery] = await repository.findDuePendingDeliveries(ORG_A, 10);
    expect(delivery).toBeDefined();

    // getEventForDelivery (the first, non-authoritative fetch) still
    // resolves normally; only the second, immediately-pre-dispatch
    // re-validation call (findEventById) is forced to fail, simulating the
    // entity having stopped resolving under this org between the two
    // checks.
    const brokenRepository: AthenaEventRepository = {
      ...repository,
      findEventById: async () => null,
    };

    const outcome = await dispatchAthenaEventDelivery(brokenRepository, delivery, [subscriber]);

    expect(handler).not.toHaveBeenCalled();
    expect(outcome.status).toBe("rescheduled");

    jest.setSystemTime(new Date(Date.now() + ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2));
    const [rescheduled] = await repository.findDuePendingDeliveries(ORG_A, 10);
    expect(rescheduled.lastError).toBe("entity_ownership_revalidation_failed");
  });

  // Same proof, but through the full retry budget so the failure reason is
  // also visible on the persisted dead-letter row (the shape a real
  // operator/auditor would actually see).
  it("dead-letters with the entity_ownership_revalidation_failed reason once the retry budget is exhausted, without ever invoking the handler", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const handler = jest.fn().mockResolvedValue(undefined);
    const subscriber: AthenaEventSubscriber = { id: "sub-1", eventType: "ProposalSent", handler };

    await publishAthenaEvent(repository, buildInput({ orgId: ORG_A }), [subscriber]);
    let [delivery] = await repository.findDuePendingDeliveries(ORG_A, 10);

    const brokenRepository: AthenaEventRepository = {
      ...repository,
      findEventById: async () => null,
    };

    let lastOutcome;
    for (let attempt = 1; attempt <= ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      lastOutcome = await dispatchAthenaEventDelivery(brokenRepository, delivery, [subscriber]);
      if (attempt < ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS) {
        jest.setSystemTime(new Date(Date.now() + ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2 ** attempt));
        [delivery] = await repository.findDuePendingDeliveries(ORG_A, 10);
      }
    }

    expect(handler).not.toHaveBeenCalled();
    expect(lastOutcome?.status).toBe("dead_lettered");

    const [deadLetter] = await repository.listDeadLetters(ORG_A);
    expect(deadLetter.failureReason).toBe("entity_ownership_revalidation_failed");
  });

  // 5. Subscriber context is service-derived, not caller-derived:
  // dispatchAthenaEventDelivery has no caller-supplied orgId parameter at
  // all - confirmed by its signature (repository, delivery, subscribers,
  // retryPolicy?) - so the AthenaEventSubscriberContext.orgId a handler
  // receives can only ever come from the delivery row itself.
  it("always passes the delivery's own orgId as the subscriber context orgId, never anything caller-supplied", async () => {
    const repository = createInMemoryAthenaEventRepository();
    let capturedOrgId: string | undefined;
    let capturedActorType: string | undefined;
    const handler = jest.fn(async (_event, ctx) => {
      capturedOrgId = ctx.orgId;
      capturedActorType = ctx.actor.type;
    });
    const subscriber: AthenaEventSubscriber = { id: "sub-1", eventType: "ProposalSent", handler };

    await publishAthenaEvent(repository, buildInput({ orgId: ORG_A }), [subscriber]);
    const [delivery] = await repository.findDuePendingDeliveries(ORG_A, 10);

    const outcome = await dispatchAthenaEventDelivery(repository, delivery, [subscriber]);

    expect(outcome.status).toBe("succeeded");
    expect(capturedOrgId).toBe(delivery.orgId);
    expect(capturedOrgId).toBe(ORG_A);
    // The subscriber context actor is always the service/system principal,
    // never the original event's actor (which was "user" in buildInput()).
    expect(capturedActorType).toBe("system");

    // dispatchAthenaEventDelivery's own signature has no orgId parameter
    // besides what the delivery row already carries - there is no caller
    // input capable of overriding ctx.orgId even if a malicious subscriber
    // list tried to smuggle one in via the delivery object's other fields.
    expect(dispatchAthenaEventDelivery.length).toBeLessThanOrEqual(4);
  });

  // 6. Publish does not trust an unregistered actor-org combination in a
  // way that leaks data: idempotency dedup is scoped to (orgId,
  // idempotencyKey), never idempotencyKey alone (store.ts's
  // findByIdempotencyKey(orgId, idempotencyKey) and the in-memory fixture's
  // equivalent org-scoped filter). A colliding idempotencyKey string across
  // two different orgs must not cause org A's publish to be treated as a
  // duplicate of org B's event.
  it("does not dedupe idempotency keys across organizations", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const service = createAthenaEventService({ repository, subscribers: [] });
    const sharedIdempotencyKey = "shared-key-collision:v1";

    const orgBResult = await service.publish(
      buildInput({ orgId: ORG_B, actor: { type: "user", id: "user-b1" }, idempotencyKey: sharedIdempotencyKey, correlationId: "corr-b" })
    );
    expect(orgBResult.deduplicated).toBe(false);

    const orgAResult = await service.publish(
      buildInput({ orgId: ORG_A, actor: { type: "user", id: "user-a1" }, idempotencyKey: sharedIdempotencyKey, correlationId: "corr-a" })
    );

    expect(orgAResult.deduplicated).toBe(false);
    expect(orgAResult.event.id).not.toBe(orgBResult.event.id);
    expect(orgAResult.event.orgId).toBe(ORG_A);
    expect(orgBResult.event.orgId).toBe(ORG_B);

    // Each org can independently read only its own event under that shared
    // idempotency key.
    const eventAsOrgA = await service.getById(ORG_A, actorFor(ORG_A, "user-a1"), orgAResult.event.id);
    expect(eventAsOrgA?.orgId).toBe(ORG_A);
    const orgBEventAsOrgA = await service.getById(ORG_A, actorFor(ORG_A, "user-a1"), orgBResult.event.id);
    expect(orgBEventAsOrgA).toBeNull();
  });
});
