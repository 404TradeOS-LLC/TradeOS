import { randomUUID } from "node:crypto";
import { detectSecrets } from "../athena-security/secretProtection";
import { athenaEventInvalidInputError, athenaEventSecretShapedPayloadError, athenaEventUnregisteredEventTypeError } from "./errors";
import { isAthenaEventTypeVersionRegistered } from "./registry";
import type { AthenaEventRepository } from "./store";
import type { AthenaBusinessEvent, AthenaEventSubscriber, AthenaPublishEventInput, AthenaPublishEventResult } from "./types";
import { assertValidAthenaBusinessEvent } from "./validation";

// A8 canonical publisher (docs/athena/roadmap/
// A8-event-integration-implementation-plan.md "Publisher And Subscriber
// Rules"): called by application services after a successful business
// mutation, never by the Action Engine and never by a controller/route
// handler directly - see service.ts's module comment for the supported
// entry point.
export async function publishAthenaEvent<TPayload = unknown>(
  repository: AthenaEventRepository,
  input: AthenaPublishEventInput<TPayload>,
  subscribers: AthenaEventSubscriber[]
): Promise<AthenaPublishEventResult> {
  const correlationId = input.correlationId || randomUUID();

  if (!input.orgId || !input.idempotencyKey || !input.type || !input.version || !input.entity?.type || !input.entity?.id) {
    throw athenaEventInvalidInputError(correlationId, "orgId, type, version, entity, and idempotencyKey are required.");
  }

  // Closed-by-default registry check (10-events/README.md's canonical event
  // list): publishing an unregistered type/version pair fails validation
  // rather than being silently accepted.
  if (!isAthenaEventTypeVersionRegistered(input.type, input.version)) {
    throw athenaEventUnregisteredEventTypeError(correlationId);
  }

  // Idempotency check must happen before any event/delivery row is created
  // (10-events/README.md "Deduplication": "Publication dedupes by (orgId,
  // idempotencyKey)") - a duplicate publish call returns the *original*
  // event and creates no second row, no re-fan-out.
  const existing = await repository.findByIdempotencyKey(input.orgId, input.idempotencyKey);
  if (existing) {
    return { event: existing, deliveriesCreated: 0, deduplicated: true };
  }

  const candidate: AthenaBusinessEvent<TPayload> = {
    id: randomUUID(),
    type: input.type,
    version: input.version,
    orgId: input.orgId,
    entity: input.entity,
    actor: input.actor,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    causationId: input.causationId,
  };

  try {
    assertValidAthenaBusinessEvent(candidate);
  } catch {
    throw athenaEventInvalidInputError(correlationId);
  }

  // A11 hardening: reject rather than silently persist a payload that looks
  // like it carries a credential (task brief "Protect: ... events. Detect:
  // API keys, tokens, passwords, credentials... sanitize before
  // persistence"). Scoped to `payload` only, not the whole candidate - id/
  // type/version/entity/actor/correlationId/idempotencyKey are Athena's own
  // structural fields, never caller-supplied free-form content, so scanning
  // them would only produce false positives on legitimate identifiers.
  if (detectSecrets(candidate.payload).detected) {
    throw athenaEventSecretShapedPayloadError(correlationId);
  }

  const event = candidate as AthenaBusinessEvent;
  // Static/in-process subscriber list only (A8 has no dynamic subscription
  // API) - zero matching subscribers is a valid outcome, not an error, per
  // the plan doc's "an empty subscriber list for that type is valid, not an
  // error" note (this is exactly the state of every production call site in
  // this milestone, since no subscriber ships).
  const subscriberIds = [...new Set(subscribers.filter((subscriber) => subscriber.eventType === input.type).map((subscriber) => subscriber.id))];

  try {
    const { event: created, deliveries } = await repository.createEventWithDeliveries(event, subscriberIds);
    return { event: created, deliveriesCreated: deliveries.length, deduplicated: false };
  } catch (error) {
    // TOCTOU guard for the check-then-insert above: two concurrent publish
    // calls for the same (orgId, idempotencyKey) can both pass the
    // findByIdempotencyKey check before either has inserted. The database's
    // own unique constraint on (org_id, idempotency_key) (migration.sql)
    // prevents a duplicate row either way, but without this catch the
    // loser of the race would surface a raw storage error instead of the
    // documented "duplicate publish call returns the original event"
    // contract (plan doc "Publication: ... Publication is idempotent").
    // Re-querying and returning deduplicated:true only when a row now
    // exists preserves that contract; any other failure (e.g. a real
    // storage outage) still propagates unchanged.
    const raced = await repository.findByIdempotencyKey(input.orgId, input.idempotencyKey);
    if (raced) {
      return { event: raced, deliveriesCreated: 0, deduplicated: true };
    }
    throw error;
  }
}
