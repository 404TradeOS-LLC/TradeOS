import { computeNextRetry } from "./retryPolicy";
import type { AthenaEventRepository } from "./store";
import type { AthenaEventDelivery, AthenaEventSubscriber, AthenaEventSubscriberContext } from "./types";

// Reason string persisted on the delivery/dead-letter row when dispatch
// refuses to proceed because the event no longer resolves under the
// delivery's own orgId immediately before invocation - see the "replay is
// not authorization" comment below.
const ENTITY_OWNERSHIP_REVALIDATION_FAILED = "entity_ownership_revalidation_failed";
const SUBSCRIBER_NOT_FOUND = "subscriber_not_found";
const SUBSCRIBER_HANDLER_FAILED = "subscriber_handler_failed";

// Never persist a raw stack trace or an error message we haven't judged
// safe - the plan doc's "safe payload snapshot and a failure reason"
// requirement, applied to every failure path here, not only dead-letters.
function safeFailureReason(error: unknown): string {
  return error instanceof Error ? SUBSCRIBER_HANDLER_FAILED : "unknown_failure";
}

export interface AthenaEventRetryPolicy {
  computeNextRetry: typeof computeNextRetry;
}

const DEFAULT_RETRY_POLICY: AthenaEventRetryPolicy = { computeNextRetry };

export interface AthenaEventDispatchOutcome {
  status: "succeeded" | "rescheduled" | "dead_lettered";
}

async function handleDispatchFailure(
  repository: AthenaEventRepository,
  delivery: AthenaEventDelivery,
  payloadSnapshot: unknown,
  reason: string,
  retryPolicy: AthenaEventRetryPolicy
): Promise<AthenaEventDispatchOutcome> {
  const nextAttemptCount = delivery.attemptCount + 1;
  const { nextAttemptAt, exhausted } = retryPolicy.computeNextRetry(nextAttemptCount);
  if (exhausted) {
    // Dead-lettering never rolls back the original business mutation
    // (10-events/README.md: "Failed subscribers do not roll back
    // already-committed business state") - it only records that this
    // subscriber's delivery is exhausted.
    await repository.deadLetterDelivery(delivery.id, nextAttemptCount, reason, payloadSnapshot);
    return { status: "dead_lettered" };
  }
  await repository.markDeliveryFailedAndReschedule(delivery.id, nextAttemptCount, nextAttemptAt.toISOString(), reason);
  return { status: "rescheduled" };
}

// Dispatches exactly one delivery row. Pull-based only - no caller in
// production code invokes this in A8; it exists for tests and a future
// scheduler (plan doc "Delivery/retry").
export async function dispatchAthenaEventDelivery(
  repository: AthenaEventRepository,
  delivery: AthenaEventDelivery,
  subscribers: AthenaEventSubscriber[],
  retryPolicy: AthenaEventRetryPolicy = DEFAULT_RETRY_POLICY
): Promise<AthenaEventDispatchOutcome> {
  const event = await repository.getEventForDelivery(delivery);
  if (!event) {
    return handleDispatchFailure(repository, delivery, null, ENTITY_OWNERSHIP_REVALIDATION_FAILED, retryPolicy);
  }

  const subscriber = subscribers.find((candidate) => candidate.id === delivery.subscriberId);
  if (!subscriber) {
    return handleDispatchFailure(repository, delivery, event.payload, SUBSCRIBER_NOT_FOUND, retryPolicy);
  }

  // "Replay is not authorization" (10-events/README.md), applied to every
  // dispatch attempt - replayed or first-attempt alike, per the plan doc's
  // "Tenant-Scoped Subscriber Execution" section. A8's generic dispatcher
  // has no live per-domain entity-ownership lookup available to it (that
  // requires knowing each event type's owning service/table, which is out
  // of scope for this milestone's infrastructure-only event pipeline), so
  // the enforceable version of "re-check that the referenced entity still
  // belongs to this org" available at this layer is: re-fetch the event by
  // id *and* orgId from the repository immediately before invoking the
  // handler, rather than trusting the `event` object already loaded above.
  // A null result or an id mismatch means the event no longer resolves
  // under delivery.orgId, so dispatch is refused and the delivery is marked
  // failed (or dead-lettered on exhaustion) with a distinct reason string
  // rather than silently proceeding on stale trust. A future milestone with
  // a live per-domain entity lookup (e.g. asking the proposals/jobs/
  // invoices service directly whether entity.id still belongs to orgId)
  // should replace this re-fetch with that real check - this is a
  // deliberately narrower stand-in documented as such, not the final word.
  const revalidatedEvent = await repository.findEventById(delivery.orgId, delivery.eventId);
  if (!revalidatedEvent || revalidatedEvent.id !== event.id) {
    return handleDispatchFailure(repository, delivery, event.payload, ENTITY_OWNERSHIP_REVALIDATION_FAILED, retryPolicy);
  }

  // Scoped session derived entirely from the delivery row's own orgId
  // (never from caller input) - 10-events/README.md: "Subscribers... must
  // re-enter a service-owned scoped database session with organization,
  // actor or service principal, role/capability context... before reading
  // or writing tenant data."
  const ctx: AthenaEventSubscriberContext = {
    orgId: delivery.orgId,
    correlationId: revalidatedEvent.correlationId,
    // Event ID plus subscriber identity is stable across process restarts and
    // replay attempts. Subscribers use this key to suppress a duplicate side
    // effect when a worker dies after the side effect but before acknowledgement.
    idempotencyKey: `event:${revalidatedEvent.id}:subscriber:${subscriber.id}`,
    attempt: delivery.attemptCount + 1,
    actor: { type: "system", id: delivery.subscriberId },
  };

  try {
    await subscriber.handler(revalidatedEvent, ctx);
  } catch (error) {
    return handleDispatchFailure(repository, delivery, revalidatedEvent.payload, safeFailureReason(error), retryPolicy);
  }

  await repository.markDeliverySucceeded(delivery.id);
  return { status: "succeeded" };
}

export interface AthenaEventDispatchDueSummary {
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

// Pulls due pending/retrying deliveries for one org and dispatches each
// independently - one subscriber's failure/exception must never prevent
// another due delivery (even for the same event) from being processed, so
// every dispatch is wrapped in its own try/catch. Pull-based only: not
// wired to any cron/route/scheduler in this milestone.
export async function dispatchDueAthenaEventDeliveries(
  repository: AthenaEventRepository,
  orgId: string,
  subscribers: AthenaEventSubscriber[],
  limit: number
): Promise<AthenaEventDispatchDueSummary> {
  const due = await repository.findDuePendingDeliveries(orgId, limit);
  const summary: AthenaEventDispatchDueSummary = { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };

  for (const delivery of due) {
    summary.processed += 1;
    try {
      const outcome = await dispatchAthenaEventDelivery(repository, delivery, subscribers);
      if (outcome.status === "succeeded") {
        summary.succeeded += 1;
      } else if (outcome.status === "dead_lettered") {
        summary.deadLettered += 1;
      } else {
        summary.failed += 1;
      }
    } catch {
      // A dispatch call throwing outright (e.g. a storage error escaping
      // the repository) must not stop the remaining due deliveries from
      // being attempted.
      summary.failed += 1;
    }
  }

  return summary;
}
