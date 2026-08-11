import { randomUUID } from "node:crypto";
import { athenaEventAuthorizationDeniedError, athenaEventNotFoundError } from "./errors";
import type { AthenaEventRepository } from "./store";
import type { AthenaEventDelivery } from "./types";

export interface AthenaReplayDeadLetterInput {
  orgId: string;
  deadLetterId: string;
}

// Replays a dead-lettered delivery (10-events/README.md: "Replays preserve
// original occurred time and mark replay metadata"). Deliberately does NOT
// invoke the subscriber handler itself - it only creates a fresh pending
// delivery; actual re-dispatch happens through the normal
// dispatchDueAthenaEventDeliveries pull path later, which re-runs the same
// "replay is not authorization" re-check every other delivery gets (see
// dispatch.ts). This function's own job is the narrower one: replay is not
// authorization at the *replay* boundary either, so it independently
// re-verifies both the dead letter and the underlying event resolve under
// the caller's org before creating anything.
export async function replayAthenaDeadLetter(repository: AthenaEventRepository, input: AthenaReplayDeadLetterInput): Promise<AthenaEventDelivery> {
  const correlationId = randomUUID();

  // Org mismatch and "does not exist" are indistinguishable to the caller -
  // same anti-enumeration posture as every other AthenaXError module.
  const deadLetter = await repository.findDeadLetterById(input.orgId, input.deadLetterId);
  if (!deadLetter) {
    throw athenaEventNotFoundError(correlationId);
  }

  // Defense in depth even though the dead letter row itself is already
  // org-scoped: if the underlying event no longer resolves under this org
  // (e.g. it was reassigned or the dead letter row somehow outlived its
  // event's own org boundary), refuse rather than trusting the dead
  // letter's denormalized orgId alone.
  const event = await repository.findEventById(input.orgId, deadLetter.eventId);
  if (!event) {
    throw athenaEventAuthorizationDeniedError(correlationId);
  }

  // event.occurredAt is never touched here - the new delivery references
  // the same eventId, so the original occurredAt is preserved unchanged by
  // construction (createReplayDelivery does not create or mutate an event
  // row at all, only a delivery row).
  return repository.createReplayDelivery(input.orgId, deadLetter.eventId, deadLetter.subscriberId, deadLetter.deliveryId);
}
