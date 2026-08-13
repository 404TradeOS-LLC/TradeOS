import { AthenaEventError } from "../modules/athena-events/errors";
import { createInMemoryAthenaEventRepository } from "../modules/athena-events/fixtures/inMemoryRepository";
import { publishAthenaEvent } from "../modules/athena-events/publisher";
import type { AthenaEventSubscriber, AthenaPublishEventInput } from "../modules/athena-events/types";

const ORG_ID = "org-1";

function buildInput(overrides: Partial<AthenaPublishEventInput> = {}): AthenaPublishEventInput {
  return {
    orgId: ORG_ID,
    type: "ProposalSent",
    version: "1.0.0",
    entity: { type: "proposal", id: "proposal-1" },
    actor: { type: "user", id: "user-1" },
    payload: { proposalId: "proposal-1" },
    correlationId: "corr-1",
    idempotencyKey: "proposal-1:sent:v1",
    ...overrides,
  };
}

describe("athena-events publisher", () => {
  it("creates the event and fans out deliveries only to subscribers matching the event type", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const matching: AthenaEventSubscriber = { id: "sub-proposal", eventType: "ProposalSent", handler: jest.fn().mockResolvedValue(undefined) };
    const nonMatching: AthenaEventSubscriber = { id: "sub-job", eventType: "JobApproved", handler: jest.fn().mockResolvedValue(undefined) };

    const result = await publishAthenaEvent(repository, buildInput(), [matching, nonMatching]);

    expect(result.deduplicated).toBe(false);
    expect(result.deliveriesCreated).toBe(1);
    expect(result.event.type).toBe("ProposalSent");
    expect(result.event.orgId).toBe(ORG_ID);

    const due = await repository.findDuePendingDeliveries(ORG_ID, 10);
    expect(due).toHaveLength(1);
    expect(due[0].subscriberId).toBe("sub-proposal");
    expect(due[0].eventId).toBe(result.event.id);
  });

  it("returns the original event on a duplicate idempotency key without creating a second row or re-fanning-out", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const subscriber: AthenaEventSubscriber = { id: "sub-proposal", eventType: "ProposalSent", handler: jest.fn().mockResolvedValue(undefined) };

    const first = await publishAthenaEvent(repository, buildInput(), [subscriber]);
    expect(first.deduplicated).toBe(false);
    expect(first.deliveriesCreated).toBe(1);

    const second = await publishAthenaEvent(repository, buildInput({ payload: { proposalId: "proposal-1", changed: true } }), [subscriber]);

    expect(second.deduplicated).toBe(true);
    expect(second.deliveriesCreated).toBe(0);
    expect(second.event.id).toBe(first.event.id);
    // The duplicate call's differing payload must never overwrite the
    // original persisted event.
    expect(second.event.payload).toEqual(first.event.payload);

    const due = await repository.findDuePendingDeliveries(ORG_ID, 10);
    expect(due).toHaveLength(1);
  });

  it("reconciles a concurrent winner returned by the repository without surfacing a storage error", async () => {
    // Simulates the TOCTOU window between the fast-path idempotency SELECT and
    // the authoritative conflict-safe insert. The repository reports the
    // already-persisted winner with a different event id and no new
    // deliveries; publisher.ts must expose that as deduplicated:true.
    const repository = createInMemoryAthenaEventRepository();
    const real = repository.createEventWithDeliveries.bind(repository);
    let winner: Awaited<ReturnType<typeof real>> | undefined;
    repository.createEventWithDeliveries = async (event, subscriberIds) => {
      winner = await real({ ...event, id: "concurrent-winner" }, subscriberIds);
      return { event: winner.event, deliveries: [] };
    };

    const result = await publishAthenaEvent(repository, buildInput(), []);

    expect(result.deduplicated).toBe(true);
    expect(result.deliveriesCreated).toBe(0);
    expect(result.event.id).toBe("concurrent-winner");
    expect(result.event.id).toBe(winner?.event.id);
    expect(await repository.findDuePendingDeliveries(ORG_ID, 10)).toHaveLength(0);
  });

  it("re-throws a genuine storage failure", async () => {
    const repository = createInMemoryAthenaEventRepository();
    repository.createEventWithDeliveries = async () => {
      throw new Error("database unavailable");
    };

    await expect(publishAthenaEvent(repository, buildInput(), [])).rejects.toThrow("database unavailable");
  });

  it("succeeds with deliveriesCreated: 0 when no subscriber matches the event type", async () => {
    const repository = createInMemoryAthenaEventRepository();

    const result = await publishAthenaEvent(repository, buildInput(), []);

    expect(result.deduplicated).toBe(false);
    expect(result.deliveriesCreated).toBe(0);
    expect(await repository.findDuePendingDeliveries(ORG_ID, 10)).toHaveLength(0);
  });

  it("throws on an unregistered type/version pair", async () => {
    const repository = createInMemoryAthenaEventRepository();

    await expect(publishAthenaEvent(repository, buildInput({ type: "NotACanonicalEvent" }), [])).rejects.toThrow(AthenaEventError);
    await expect(publishAthenaEvent(repository, buildInput({ version: "9.9.9" }), [])).rejects.toMatchObject({ reasonCode: "unregistered_event_type" });
  });
});
