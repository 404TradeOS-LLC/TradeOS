// A8 Event Integration contracts (docs/athena/roadmap/
// A8-event-integration-implementation-plan.md, C008 in docs/athena/
// contracts/README.md). AthenaBusinessEvent below carries every C008-
// required field verbatim plus the contract's documented "Optional: replay
// metadata, causation ID" extension (causationId, isReplay, replayedAt) -
// the same "layer additive optional fields around a numbered contract"
// posture A6 (AthenaAction/C005) and A7 (AthenaMemoryRecord/C006) already
// established. assertValidAthenaBusinessEvent (validation.ts) is the
// runtime boundary that enforces exactly this field set for
// athena:contracts.

export type AthenaEventActorType = "user" | "system" | "athena";

export interface AthenaEventActorRef {
  type: AthenaEventActorType;
  id: string | null;
}

export interface AthenaBusinessEvent<TPayload = unknown> {
  id: string;
  type: string;
  version: string;
  orgId: string;
  entity: { type: string; id: string };
  actor: AthenaEventActorRef;
  occurredAt: string;
  payload: TPayload;
  correlationId: string;
  idempotencyKey: string;
  causationId?: string;
  isReplay?: boolean;
  replayedAt?: string;
}

export interface AthenaPublishEventInput<TPayload = unknown> {
  orgId: string;
  type: string;
  version: string;
  entity: { type: string; id: string };
  actor: AthenaEventActorRef;
  // Defaults to now() at publish time when absent.
  occurredAt?: string;
  payload: TPayload;
  correlationId: string;
  idempotencyKey: string;
  causationId?: string;
}

export interface AthenaPublishEventResult {
  event: AthenaBusinessEvent;
  deliveriesCreated: number;
  // true when idempotencyKey already existed and no new row/fan-out was
  // created - the publish() dedup path (10-events/README.md
  // "Deduplication").
  deduplicated: boolean;
}

export const athenaEventDeliveryStatuses = ["pending", "succeeded", "failed", "dead_letter"] as const;
export type AthenaEventDeliveryStatus = (typeof athenaEventDeliveryStatuses)[number];

export interface AthenaEventDelivery {
  id: string;
  orgId: string;
  eventId: string;
  subscriberId: string;
  status: AthenaEventDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string;
  lastError?: string;
  lastAttemptAt?: string;
  succeededAt?: string;
  isReplay: boolean;
  replayedFromId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AthenaEventDeadLetter {
  id: string;
  orgId: string;
  deliveryId: string;
  eventId: string;
  subscriberId: string;
  failureReason: string;
  payloadSnapshot: unknown;
  attemptCount: number;
  createdAt: string;
}

export interface AthenaEventSubscriberContext {
  orgId: string;
  // Service-principal session, never the original event's actor - dispatch
  // re-derives a scoped session per docs/athena/10-events/README.md's
  // "Subscribers... must re-enter a service-owned scoped database session".
  actor: { type: "system"; id: string };
}

export type AthenaEventSubscriberHandler = (event: AthenaBusinessEvent, ctx: AthenaEventSubscriberContext) => Promise<void>;

export interface AthenaEventSubscriber {
  id: string;
  eventType: string;
  handler: AthenaEventSubscriberHandler;
}

export interface AthenaEventActor {
  type: AthenaEventActorType;
  id: string | null;
  orgId: string;
}
