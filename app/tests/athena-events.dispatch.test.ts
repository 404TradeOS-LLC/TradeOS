import { dispatchAthenaEventDelivery, dispatchDueAthenaEventDeliveries } from "../modules/athena-events/dispatch";
import { createInMemoryAthenaEventRepository } from "../modules/athena-events/fixtures/inMemoryRepository";
import { publishAthenaEvent } from "../modules/athena-events/publisher";
import { ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS, ATHENA_EVENT_RETRY_BASE_DELAY_MS } from "../modules/athena-events/retryPolicy";
import type { AthenaEventSubscriber, AthenaPublishEventInput } from "../modules/athena-events/types";

const ORG_ID = "org-1";
const START = new Date("2026-01-01T00:00:00.000Z");

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

describe("athena-events dispatch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marks a delivery succeeded when the subscriber handler resolves", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const subscriber: AthenaEventSubscriber = { id: "sub-ok", eventType: "ProposalSent", handler: jest.fn().mockResolvedValue(undefined) };
    await publishAthenaEvent(repository, buildInput(), [subscriber]);

    const [delivery] = await repository.findDuePendingDeliveries(ORG_ID, 10);
    const outcome = await dispatchAthenaEventDelivery(repository, delivery, [subscriber]);

    expect(outcome.status).toBe("succeeded");
    expect(subscriber.handler).toHaveBeenCalledTimes(1);
    // A succeeded delivery must no longer show up as due.
    expect(await repository.findDuePendingDeliveries(ORG_ID, 10)).toHaveLength(0);
  });

  it("increments the attempt count and reschedules a failing delivery before it is exhausted", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const subscriber: AthenaEventSubscriber = { id: "sub-fail", eventType: "ProposalSent", handler: jest.fn().mockRejectedValue(new Error("boom")) };
    await publishAthenaEvent(repository, buildInput(), [subscriber]);

    const [delivery] = await repository.findDuePendingDeliveries(ORG_ID, 10);
    const outcome = await dispatchAthenaEventDelivery(repository, delivery, [subscriber]);
    expect(outcome.status).toBe("rescheduled");

    // Immediately after the failure the backoff window has not elapsed yet.
    expect(await repository.findDuePendingDeliveries(ORG_ID, 10)).toHaveLength(0);

    jest.setSystemTime(new Date(START.getTime() + ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2));
    const [rescheduled] = await repository.findDuePendingDeliveries(ORG_ID, 10);
    expect(rescheduled).toBeDefined();
    expect(rescheduled.attemptCount).toBe(1);
    expect(rescheduled.status).toBe("failed");
  });

  it("dead-letters a delivery once it exhausts its retry budget, persisting a dead-letter row", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const subscriber: AthenaEventSubscriber = { id: "sub-fail", eventType: "ProposalSent", handler: jest.fn().mockRejectedValue(new Error("boom")) };
    await publishAthenaEvent(repository, buildInput(), [subscriber]);

    let due = await repository.findDuePendingDeliveries(ORG_ID, 10);
    let lastOutcome;
    for (let attempt = 1; attempt <= ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      lastOutcome = await dispatchAthenaEventDelivery(repository, due[0], [subscriber]);
      if (attempt < ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS) {
        expect(lastOutcome.status).toBe("rescheduled");
        jest.setSystemTime(new Date(Date.now() + ATHENA_EVENT_RETRY_BASE_DELAY_MS * 2 ** attempt));
        due = await repository.findDuePendingDeliveries(ORG_ID, 10);
        expect(due).toHaveLength(1);
      }
    }

    expect(lastOutcome?.status).toBe("dead_lettered");
    expect(await repository.findDuePendingDeliveries(ORG_ID, 10)).toHaveLength(0);

    const deadLetters = await repository.listDeadLetters(ORG_ID);
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0].attemptCount).toBe(ATHENA_EVENT_MAX_DELIVERY_ATTEMPTS);
    expect(deadLetters[0].failureReason).toBe("subscriber_handler_failed");
    expect(deadLetters[0].payloadSnapshot).toEqual({ proposalId: "proposal-1" });
  });

  it("does not let one subscriber's handler throwing prevent another subscriber's delivery of the same event from succeeding", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const failing: AthenaEventSubscriber = { id: "sub-fail", eventType: "ProposalSent", handler: jest.fn().mockRejectedValue(new Error("boom")) };
    const succeeding: AthenaEventSubscriber = { id: "sub-ok", eventType: "ProposalSent", handler: jest.fn().mockResolvedValue(undefined) };
    await publishAthenaEvent(repository, buildInput(), [failing, succeeding]);

    const summary = await dispatchDueAthenaEventDeliveries(repository, ORG_ID, [failing, succeeding], 10);

    expect(summary.processed).toBe(2);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.deadLettered).toBe(0);
    expect(failing.handler).toHaveBeenCalledTimes(1);
    expect(succeeding.handler).toHaveBeenCalledTimes(1);
  });

  it("dispatchDueAthenaEventDeliveries only processes deliveries whose nextAttemptAt has passed", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const failing: AthenaEventSubscriber = { id: "sub-fail", eventType: "ProposalSent", handler: jest.fn().mockRejectedValue(new Error("boom")) };
    const succeeding: AthenaEventSubscriber = { id: "sub-ok", eventType: "JobApproved", handler: jest.fn().mockResolvedValue(undefined) };

    await publishAthenaEvent(repository, buildInput(), [failing]);
    // Push this delivery's nextAttemptAt into the future via one direct
    // failed dispatch, before publishing the second event.
    const [proposalDelivery] = await repository.findDuePendingDeliveries(ORG_ID, 10);
    const outcome = await dispatchAthenaEventDelivery(repository, proposalDelivery, [failing]);
    expect(outcome.status).toBe("rescheduled");

    // Still at the same fake "now" - this second event's delivery is due
    // immediately.
    await publishAthenaEvent(
      repository,
      buildInput({ type: "JobApproved", version: "1.0.0", entity: { type: "job", id: "job-1" }, idempotencyKey: "job-1:approved:v1" }),
      [succeeding]
    );

    const summary = await dispatchDueAthenaEventDeliveries(repository, ORG_ID, [failing, succeeding], 10);

    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(succeeding.handler).toHaveBeenCalledTimes(1);
    // The rescheduled proposal delivery must not have been touched again.
    expect(failing.handler).toHaveBeenCalledTimes(1);
  });
});
