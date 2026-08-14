import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { createPrismaAthenaEventRepository } from "../modules/athena-events/store";
import type { AthenaBusinessEvent } from "../modules/athena-events/types";

// Live RLS coverage for the A8 event tables (docs/athena/roadmap/
// A8-event-integration-implementation-plan.md "Event Model And Isolation",
// layer 3 - "Database floor (forced RLS)... Verified against a real
// Postgres instance in athena-events.rls.integration.ts, not a mocked
// client"; AGENTS.md's "new RLS-protected tables need live integration
// coverage" rule). Mirrors athena-memory.rls.integration.ts's and
// athena-kernel.integration.ts's exact scaffolding: two Prisma clients (an
// app client whose sessions run through runWithDatabaseSession's
// set_config()-scoped transaction, and an admin client used ONLY for
// fixture setup/teardown, never for an isolation assertion, since admin
// bypasses RLS). Kept as its own file rather than appended to
// tests/rls.integration.ts, matching every sibling per-module RLS file's
// precedent.
const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "90000000-0000-0000-0000-000000000001";
const orgB = "a0000000-0000-0000-0000-000000000002";
const adminA = "90000000-0000-0000-0000-000000000011";
const technicianA1 = "90000000-0000-0000-0000-000000000012";
const technicianA2 = "90000000-0000-0000-0000-000000000013";
const ownerB = "a0000000-0000-0000-0000-000000000021";
const membershipAdminA = "90000000-0000-0000-0000-000000000031";
const membershipTechA1 = "90000000-0000-0000-0000-000000000032";
const membershipTechA2 = "90000000-0000-0000-0000-000000000033";
const membershipOwnerB = "a0000000-0000-0000-0000-000000000041";

function buildEvent(overrides: Partial<AthenaBusinessEvent> = {}): AthenaBusinessEvent {
  return {
    id: randomUUID(),
    type: "ProposalSent",
    version: "1.0.0",
    orgId: orgA,
    entity: { type: "proposal", id: "proposal-1" },
    actor: { type: "user", id: technicianA1 },
    occurredAt: new Date().toISOString(),
    payload: { proposalId: "proposal-1" },
    correlationId: "corr-1",
    idempotencyKey: `idem-${randomUUID()}`,
    ...overrides,
  };
}

describe("live row-level security for the A8 athena_events tables", () => {
  const repository = createPrismaAthenaEventRepository();

  let eventTechA1Id: string;
  let deliveryTechA1Id: string;
  let deadLetterTechA1Id: string;
  let eventSystemAId: string;
  let eventOwnerBId: string;

  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Events Org A" }, { id: orgB, name: "Events Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: adminA, authSubject: "events-admin-a", email: "events-admin-a@example.com" },
        { id: technicianA1, authSubject: "events-tech-a1", email: "events-tech-a1@example.com" },
        { id: technicianA2, authSubject: "events-tech-a2", email: "events-tech-a2@example.com" },
        { id: ownerB, authSubject: "events-owner-b", email: "events-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipAdminA, orgId: orgA, userId: adminA, role: "admin", status: "active" },
        { id: membershipTechA1, orgId: orgA, userId: technicianA1, role: "technician", status: "active" },
        { id: membershipTechA2, orgId: orgA, userId: technicianA2, role: "technician", status: "active" },
        { id: membershipOwnerB, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });

    const { event: eventTechA1, deliveries: deliveriesTechA1 } = await inSession(technicianA1, orgA, "technician", () =>
      repository.createEventWithDeliveries(buildEvent({ actor: { type: "user", id: technicianA1 } }), ["sub-1"])
    );
    eventTechA1Id = eventTechA1.id;
    deliveryTechA1Id = deliveriesTechA1[0].id;

    const { event: eventSystemA } = await inSession(technicianA1, orgA, "technician", () =>
      repository.createEventWithDeliveries(buildEvent({ actor: { type: "system", id: null }, idempotencyKey: `idem-${randomUUID()}` }), [])
    );
    eventSystemAId = eventSystemA.id;

    const { event: eventOwnerB } = await inSession(ownerB, orgB, "owner", () =>
      repository.createEventWithDeliveries(
        buildEvent({ orgId: orgB, actor: { type: "user", id: ownerB }, idempotencyKey: `idem-${randomUUID()}` }),
        []
      )
    );
    eventOwnerBId = eventOwnerB.id;

    // Admin client only - fixture setup, never an isolation assertion.
    // Dead-letters an existing delivery so the dead-letter visibility test
    // below can exercise the same parent-event-derived policy the delivery
    // test does, without re-running dispatch.ts's real retry loop here.
    const deadLetter = await adminClient.athenaEventDeadLetter.create({
      data: {
        id: randomUUID(),
        orgId: orgA,
        deliveryId: deliveryTechA1Id,
        eventId: eventTechA1Id,
        subscriberId: "sub-1",
        failureReason: "boom",
        payloadSnapshotJson: { proposalId: "proposal-1" },
        attemptCount: 5,
      },
    });
    deadLetterTechA1Id = deadLetter.id;
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  // Reads below must go through the `prisma` proxy from ../db/client (which
  // resolves to the transaction runWithDatabaseSession opened and where
  // set_config() applied the RLS session vars), never the raw appClient -
  // see athena-kernel.integration.ts's identical comment for why.
  it("lets the authoring user see their own event", async () => {
    const rows = await inSession(technicianA1, orgA, "technician", () => prisma.athenaEvent.findMany({ where: { id: eventTechA1Id } }));
    expect(rows).toHaveLength(1);
  });

  it("hides a user-authored event from a peer technician in the same org (object-scope, not just org-scope)", async () => {
    const rows = await inSession(technicianA2, orgA, "technician", () => prisma.athenaEvent.findMany({ where: { id: eventTechA1Id } }));
    expect(rows).toHaveLength(0);
  });

  it("lets an org admin see every event in the org regardless of actor", async () => {
    const rows = await inSession(adminA, orgA, "admin", () => prisma.athenaEvent.findMany({ where: { id: eventTechA1Id } }));
    expect(rows).toHaveLength(1);
  });

  it("lets any org member read a non-user-actor (system/athena) event regardless of actor id", async () => {
    const rows = await inSession(technicianA2, orgA, "technician", () => prisma.athenaEvent.findMany({ where: { id: eventSystemAId } }));
    expect(rows).toHaveLength(1);
  });

  it("never exposes another organization's event, even to that org's owner or an admin of the first org", async () => {
    const asOwnerB = await inSession(ownerB, orgB, "owner", () => prisma.athenaEvent.findMany({ where: { id: eventTechA1Id } }));
    expect(asOwnerB).toHaveLength(0);

    const crossOrgAsAdminA = await inSession(adminA, orgA, "admin", () => prisma.athenaEvent.findMany({ where: { id: eventOwnerBId } }));
    expect(crossOrgAsAdminA).toHaveLength(0);
  });

  it("rejects inserting a user-actor event on behalf of a different user (insert policy actor check)", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () =>
        repository.createEventWithDeliveries(
          buildEvent({ id: randomUUID(), actor: { type: "user", id: technicianA2 }, idempotencyKey: `idem-${randomUUID()}` }),
          []
        )
      )
    ).rejects.toBeTruthy();
  });

  it("rejects inserting an event into a different organization than the session's own org (insert policy org check)", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () =>
        repository.createEventWithDeliveries(buildEvent({ orgId: orgB, idempotencyKey: `idem-${randomUUID()}` }), [])
      )
    ).rejects.toBeTruthy();
  });

  it("scopes delivery visibility to the parent event's own visibility rule", async () => {
    const asPeer = await inSession(technicianA2, orgA, "technician", () => prisma.athenaEventDelivery.findMany({ where: { id: deliveryTechA1Id } }));
    expect(asPeer).toHaveLength(0);

    const asAuthor = await inSession(technicianA1, orgA, "technician", () => prisma.athenaEventDelivery.findMany({ where: { id: deliveryTechA1Id } }));
    expect(asAuthor).toHaveLength(1);

    const asAdmin = await inSession(adminA, orgA, "admin", () => prisma.athenaEventDelivery.findMany({ where: { id: deliveryTechA1Id } }));
    expect(asAdmin).toHaveLength(1);

    const asOwnerB = await inSession(ownerB, orgB, "owner", () => prisma.athenaEventDelivery.findMany({ where: { id: deliveryTechA1Id } }));
    expect(asOwnerB).toHaveLength(0);
  });

  // Regression coverage for a real production incident: `athena_events`
  // didn't exist yet on a database that hadn't received a pending migration,
  // so createEventWithDeliveries failed with a raw Postgres error inside the
  // request's ambient transaction. The caller's try/catch swallowed that JS
  // exception exactly as designed, but the transaction itself was left
  // aborted (Postgres 25P02), so the request's next, unrelated query failed
  // too - even though nothing in application code ever saw that second
  // failure. store.ts's withRepositorySavepoint wraps repository access in
  // its own SAVEPOINT so a failure here only rolls back to that savepoint,
  // not the whole request. This reproduces that exact shape using a real
  // Postgres error already proven above (an RLS insert-policy rejection)
  // rather than dropping a table, then proves the *next* query in the same
  // ambient transaction still succeeds instead of throwing 25P02.
  it("a repository failure does not poison later queries in the same request transaction", async () => {
    await inSession(technicianA1, orgA, "technician", async () => {
      await expect(
        repository.createEventWithDeliveries(buildEvent({ orgId: orgB, idempotencyKey: `idem-${randomUUID()}` }), [])
      ).rejects.toBeTruthy();

      // Before the fix, this would fail with Postgres 25P02 ("current
      // transaction is aborted") even though this query has nothing to do
      // with the failed insert above.
      const rows = await prisma.athenaEvent.findMany({ where: { id: eventTechA1Id } });
      expect(rows).toHaveLength(1);
    });
  });

  it("scopes dead-letter visibility to the parent event's own visibility rule", async () => {
    const asPeer = await inSession(technicianA2, orgA, "technician", () => prisma.athenaEventDeadLetter.findMany({ where: { id: deadLetterTechA1Id } }));
    expect(asPeer).toHaveLength(0);

    const asAuthor = await inSession(technicianA1, orgA, "technician", () => prisma.athenaEventDeadLetter.findMany({ where: { id: deadLetterTechA1Id } }));
    expect(asAuthor).toHaveLength(1);

    const asAdmin = await inSession(adminA, orgA, "admin", () => prisma.athenaEventDeadLetter.findMany({ where: { id: deadLetterTechA1Id } }));
    expect(asAdmin).toHaveLength(1);

    const asOwnerB = await inSession(ownerB, orgB, "owner", () => prisma.athenaEventDeadLetter.findMany({ where: { id: deadLetterTechA1Id } }));
    expect(asOwnerB).toHaveLength(0);
  });
});

// Live-Postgres proof for store.ts's dispatch/DLQ/replay methods
// (markDeliverySucceeded, markDeliveryFailedAndReschedule, deadLetterDelivery,
// findDuePendingDeliveries, createReplayDelivery, getEventForDelivery) - the
// RLS suite above only ever calls createEventWithDeliveries against a real
// database; every other store.ts method was previously exercised only
// against the in-memory fixture (athena-events.dispatch.test.ts,
// athena-events.replay.test.ts), which cannot catch a Prisma-mapping or
// transaction bug specific to the real repository. This block proves those
// methods actually work against Postgres, not just against their own
// hand-rolled in-memory double.
describe("live persistence proof for athena-events store.ts's dispatch/DLQ/replay methods", () => {
  const repository = createPrismaAthenaEventRepository();

  // Self-contained fixtures, deliberately independent of the RLS describe
  // block above: that block's own afterAll deletes orgA/orgB once its tests
  // finish, and Jest runs sibling top-level describe blocks (and their
  // lifecycle hooks) in file order - a shared-fixture version of this block
  // would hit athena_events_org_id_fkey violations once the RLS block's
  // teardown has already run.
  const orgC = "b0000000-0000-0000-0000-000000000001";
  const userC = "b0000000-0000-0000-0000-000000000011";
  const membershipUserC = "b0000000-0000-0000-0000-000000000021";

  beforeAll(async () => {
    await adminClient.organization.create({ data: { id: orgC, name: "Events Org C" } });
    await adminClient.appUser.create({ data: { id: userC, authSubject: "events-store-proof", email: "events-store-proof@example.com" } });
    await adminClient.organizationMembership.create({ data: { id: membershipUserC, orgId: orgC, userId: userC, role: "technician", status: "active" } });
  });

  afterAll(async () => {
    await adminClient.organization.delete({ where: { id: orgC } });
  });

  function inSessionC<T>(operation: () => Promise<T>): Promise<T> {
    return inSession(userC, orgC, "technician", operation);
  }

  async function seedDelivery() {
    const { event, deliveries } = await inSessionC(() =>
      repository.createEventWithDeliveries(buildEvent({ orgId: orgC, actor: { type: "user", id: userC }, idempotencyKey: `idem-${randomUUID()}` }), ["sub-store-proof"])
    );
    return { event, delivery: deliveries[0] };
  }

  it("getEventForDelivery returns the event the delivery references", async () => {
    const { event, delivery } = await seedDelivery();
    const found = await inSessionC(() => repository.getEventForDelivery(delivery));
    expect(found?.id).toBe(event.id);
  });

  it("markDeliverySucceeded transitions the row to succeeded with a timestamp", async () => {
    const { delivery } = await seedDelivery();
    await inSessionC(() => repository.markDeliverySucceeded(delivery.id));
    const [row] = await inSessionC(() => prisma.athenaEventDelivery.findMany({ where: { id: delivery.id } }));
    expect(row.status).toBe("succeeded");
    expect(row.succeededAt).not.toBeNull();
  });

  it("markDeliveryFailedAndReschedule persists attempt count, backoff, and a safe error string", async () => {
    const { delivery } = await seedDelivery();
    const nextAttemptAt = new Date(Date.now() + 60_000).toISOString();
    await inSessionC(() => repository.markDeliveryFailedAndReschedule(delivery.id, 1, nextAttemptAt, "boom"));
    const [row] = await inSessionC(() => prisma.athenaEventDelivery.findMany({ where: { id: delivery.id } }));
    expect(row.status).toBe("failed");
    expect(row.attemptCount).toBe(1);
    expect(row.lastError).toBe("boom");
    expect(row.nextAttemptAt.toISOString()).toBe(nextAttemptAt);
  });

  it("findDuePendingDeliveries excludes a delivery whose nextAttemptAt is in the future", async () => {
    const due = await seedDelivery();
    const notDue = await seedDelivery();
    await inSessionC(() => repository.markDeliveryFailedAndReschedule(notDue.delivery.id, 1, new Date(Date.now() + 3_600_000).toISOString(), "not yet"));

    const results = await inSessionC(() => repository.findDuePendingDeliveries(orgC, 100));
    const ids = results.map((row) => row.id);
    expect(ids).toContain(due.delivery.id);
    expect(ids).not.toContain(notDue.delivery.id);
  });

  it("deadLetterDelivery atomically transitions the delivery and creates the dead-letter row in one transaction", async () => {
    const { delivery } = await seedDelivery();
    const deadLetter = await inSessionC(() => repository.deadLetterDelivery(delivery.id, 5, "exhausted retries", { proposalId: "proposal-1" }));

    expect(deadLetter.deliveryId).toBe(delivery.id);
    expect(deadLetter.failureReason).toBe("exhausted retries");
    expect(deadLetter.payloadSnapshot).toEqual({ proposalId: "proposal-1" });

    const [row] = await inSessionC(() => prisma.athenaEventDelivery.findMany({ where: { id: delivery.id } }));
    expect(row.status).toBe("dead_letter");
    expect(row.attemptCount).toBe(5);
  });

  it("createReplayDelivery creates a fresh pending delivery without mutating the original", async () => {
    const { event, delivery } = await seedDelivery();
    await inSessionC(() => repository.deadLetterDelivery(delivery.id, 5, "exhausted retries", event.payload));

    const replay = await inSessionC(() => repository.createReplayDelivery(orgC, event.id, delivery.subscriberId, delivery.id));

    expect(replay.id).not.toBe(delivery.id);
    expect(replay.isReplay).toBe(true);
    expect(replay.replayedFromId).toBe(delivery.id);
    expect(replay.status).toBe("pending");
    expect(replay.attemptCount).toBe(0);

    const [originalRow] = await inSessionC(() => prisma.athenaEventDelivery.findMany({ where: { id: delivery.id } }));
    expect(originalRow.status).toBe("dead_letter");
  });
});

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "integration-test");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live RLS integration tests`);
  return value;
}
