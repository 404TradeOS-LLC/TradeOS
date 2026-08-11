import { dispatchAthenaEventDelivery } from "../modules/athena-events/dispatch";
import { AthenaEventError } from "../modules/athena-events/errors";
import { createInMemoryAthenaEventRepository } from "../modules/athena-events/fixtures/inMemoryRepository";
import { publishAthenaEvent } from "../modules/athena-events/publisher";
import { replayAthenaDeadLetter } from "../modules/athena-events/replay";
import { ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS, ATHENA_EVENT_RETRY_BASE_DELAY_MS } from "../modules/athena-events/retryPolicy";
import type { AthenaEventRepository } from "../modules/athena-events/store";
import type { AthenaBusinessEvent, AthenaEventDeadLetter, AthenaEventSubscriber } from "../modules/athena-events/types";

const ORG_A = "org-a";
const ORG_B = "org-b";
const OCCURRED_AT = "2026-01-01T00:00:00.000Z";

async function createDeadLetter(
  repository: AthenaEventRepository,
  orgId: string
): Promise<{ event: AthenaBusinessEvent; deadLetter: AthenaEventDeadLetter }> {
  const subscriber: AthenaEventSubscriber = { id: "sub-fail", eventType: "ProposalSent", handler: jest.fn().mockRejectedValue(new Error("boom")) };
  const { event } = await publishAthenaEvent(
    repository,
    {
      orgId,
      type: "ProposalSent",
      version: "1.0.0",
      entity: { type: "proposal", id: "proposal-1" },
      actor: { type: "user", id: "user-1" },
      occurredAt: OCCURRED_AT,
      payload: { proposalId: "proposal-1" },
      correlationId: "corr-1",
      idempotencyKey: `${orgId}:proposal-1:sent:v1`,
    },
    [subscriber]
  );

  let due = await repository.findDuePendingDeliveries(orgId, 10);
  for (let attempt = 1; attempt <= ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS; attempt += 1) {
    await dispatchAthenaEventDelivery(repository, due[0], [subscriber]);
    if (attempt < ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS) {
      jest.setSystemTime(new Date(Date.now() + ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2 ** attempt));
      due = await repository.findDuePendingDeliveries(orgId, 10);
    }
  }

  const [deadLetter] = await repository.listDeadLetters(orgId);
  return { event, deadLetter };
}

describe("athena-events replay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(OCCURRED_AT));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a new pending delivery preserving the original occurredAt and stamping replay metadata", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const { event, deadLetter } = await createDeadLetter(repository, ORG_A);

    const delivery = await replayAthenaDeadLetter(repository, { orgId: ORG_A, deadLetterId: deadLetter.id });

    expect(delivery.status).toBe("pending");
    expect(delivery.attemptCount).toBe(0);
    expect(delivery.isReplay).toBe(true);
    expect(delivery.replayedFromId).toBe(deadLetter.deliveryId);
    expect(delivery.eventId).toBe(deadLetter.eventId);
    expect(delivery.subscriberId).toBe(deadLetter.subscriberId);

    const storedEvent = await repository.findEventById(ORG_A, event.id);
    expect(storedEvent?.occurredAt).toBe(OCCURRED_AT);
    expect(event.occurredAt).toBe(OCCURRED_AT);
  });

  it("refuses replay when the dead letter belongs to a different org than the caller", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const { deadLetter } = await createDeadLetter(repository, ORG_A);

    await expect(replayAthenaDeadLetter(repository, { orgId: ORG_B, deadLetterId: deadLetter.id })).rejects.toThrow(AthenaEventError);
    await expect(replayAthenaDeadLetter(repository, { orgId: ORG_B, deadLetterId: deadLetter.id })).rejects.toMatchObject({ reasonCode: "not_found" });
  });

  it("refuses replay when the underlying event no longer resolves under the caller's org", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const { deadLetter } = await createDeadLetter(repository, ORG_A);

    // Defense-in-depth path: the dead letter row itself resolves under
    // ORG_A, but the underlying event does not (simulated here since a real
    // repository can never let an org-scoped dead letter outlive its own
    // event's org boundary - this drives the same code path replay.ts
    // exercises for that defense-in-depth check).
    const brokenRepository: AthenaEventRepository = {
      ...repository,
      findEventById: async () => null,
    };

    await expect(replayAthenaDeadLetter(brokenRepository, { orgId: ORG_A, deadLetterId: deadLetter.id })).rejects.toThrow(AthenaEventError);
    await expect(replayAthenaDeadLetter(brokenRepository, { orgId: ORG_A, deadLetterId: deadLetter.id })).rejects.toMatchObject({
      reasonCode: "authorization_denied",
    });
  });
});
