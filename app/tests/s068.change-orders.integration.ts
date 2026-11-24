import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { ChangeOrdersService } from "../modules/change-orders/service";

/**
 * S068 — live-PostgreSQL certification evidence for the change-order
 * approve/reject audit trail.
 *
 * Exercises the REAL ChangeOrdersService (no mocked Prisma) against the
 * disposable database provisioned by scripts/test-integration-db.sh. The
 * service's module-level `prisma` singleton binds to DATABASE_URL, which
 * the integration runner sets to the restricted app-role URL (the same
 * value as TEST_DATABASE_URL), so every query below runs under forced RLS
 * exactly as in production. Approve/reject run inside
 * runWithDatabaseSession (staff session), the same context `requireAuth` +
 * `databaseSession` establishes for the staff routes.
 *
 * NOT run locally on this VM: there is no Docker here, so
 * `npm run test:integration` cannot provision the disposable database.
 * This file is verified locally only by `tsc --noEmit` and
 * `jest --listTests`; CI is authoritative for the live assertions.
 */

jest.setTimeout(30_000);

const app = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_URL") } } });
const admin = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_ADMIN_URL") } } });
const service = new ChangeOrdersService();

const orgA = randomUUID();
const orgB = randomUUID();
const staffUser = randomUUID();
const staffMembership = randomUUID();
const customerA = randomUUID();
const customerB = randomUUID();
const projectA = randomUUID();
const projectB = randomUUID();
const proposalA = randomUUID();
const contractA = randomUUID();
const changeOrderA = randomUUID();
const changeOrderB = randomUUID();
const lineItemA = randomUUID();

const staffAuth = { userId: staffUser, orgId: orgA, role: "admin" as const };

const contractSnapshot = {
  proposalId: proposalA,
  finalPrice: "1234.56",
  status: "sent",
  termsText: "S068 snapshot — must not mutate on change-order approval",
};

describe("S068 change-order approval certification (live PostgreSQL)", () => {
  beforeAll(async () => {
    await admin.organization.createMany({
      data: [
        { id: orgA, name: "S068 Org A" },
        { id: orgB, name: "S068 Org B" },
      ],
    });
    await admin.appUser.create({
      data: { id: staffUser, authSubject: `s068-${staffUser}`, email: `s068-${staffUser}@example.invalid` },
    });
    await admin.organizationMembership.create({
      data: { id: staffMembership, orgId: orgA, userId: staffUser, role: "admin", status: "active" },
    });
    await admin.customer.createMany({
      data: [
        { id: customerA, orgId: orgA, name: "S068 Customer A", email: `s068-${customerA}@example.invalid` },
        { id: customerB, orgId: orgB, name: "S068 Customer B", email: `s068-${customerB}@example.invalid` },
      ],
    });
    await admin.project.createMany({
      data: [
        { id: projectA, orgId: orgA, customerId: customerA, name: "S068 Project A" },
        { id: projectB, orgId: orgB, customerId: customerB, name: "S068 Project B" },
      ],
    });
    await admin.proposal.create({
      data: { id: proposalA, projectId: projectA, status: "sent", finalPrice: 1234.56 },
    });
    await admin.contract.create({
      data: {
        id: contractA,
        projectId: projectA,
        proposalId: proposalA,
        status: "pending_signature",
        termsText: "S068 contract",
        snapshotJson: contractSnapshot,
      },
    });
    await admin.changeOrder.createMany({
      data: [
        { id: changeOrderA, projectId: projectA, coNumber: 1, description: "S068 Change A", status: "draft", amount: 0 },
        { id: changeOrderB, projectId: projectB, coNumber: 1, description: "S068 Change B", status: "draft", amount: 0 },
      ],
    });
    await admin.changeOrderLineItem.create({
      data: {
        id: lineItemA,
        changeOrderId: changeOrderA,
        description: "Additional excavation",
        quantity: 2,
        unitCost: 25,
        lineCost: 50,
        sortOrder: 1,
      },
    });
  });

  afterAll(async () => {
    await admin.activityEvent.deleteMany({ where: { entityId: { in: [changeOrderA, changeOrderB] } } });
    await admin.changeOrderLineItem.deleteMany({ where: { changeOrderId: { in: [changeOrderA, changeOrderB] } } });
    await admin.changeOrder.deleteMany({ where: { id: { in: [changeOrderA, changeOrderB] } } });
    await admin.contract.deleteMany({ where: { id: contractA } });
    await admin.proposal.deleteMany({ where: { id: proposalA } });
    await admin.project.deleteMany({ where: { id: { in: [projectA, projectB] } } });
    await admin.customer.deleteMany({ where: { id: { in: [customerA, customerB] } } });
    await admin.organizationMembership.deleteMany({ where: { id: staffMembership } });
    await admin.appUser.deleteMany({ where: { id: staffUser } });
    await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await app.$disconnect();
    await admin.$disconnect();
  });

  it("approve sets status approved, writes exactly one attributable event, and leaves the contract snapshot and proposal pricing untouched", async () => {
    const contractBefore = await admin.contract.findUniqueOrThrow({ where: { id: contractA } });
    const proposalBefore = await admin.proposal.findUniqueOrThrow({ where: { id: proposalA } });
    const snapshotBefore = JSON.stringify(contractBefore.snapshotJson);
    const finalPriceBefore = proposalBefore.finalPrice?.toString();

    const approved = await runWithDatabaseSession(app, staffAuth, () =>
      service.approve(changeOrderA, orgA, staffUser),
    );

    expect(approved.status).toBe("approved");
    expect(approved.amount).toBe(50);
    expect(approved.approvedAt).toBeTruthy();

    const events = await admin.activityEvent.findMany({
      where: { orgId: orgA, entityType: "change_order", entityId: changeOrderA },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "change_order.approved",
      actorUserId: staffUser,
    });
    expect(events[0].title).toBe("Change order #1 approved");
    expect(events[0].metadataJson).toMatchObject({
      previousStatus: "draft",
      newStatus: "approved",
      coNumber: 1,
      projectId: projectA,
      amount: 50,
    });

    // The linked contract snapshot and proposal pricing are byte-identical:
    // an approved change order is a new attributable record, never an edit
    // to the signed history.
    const contractAfter = await admin.contract.findUniqueOrThrow({ where: { id: contractA } });
    const proposalAfter = await admin.proposal.findUniqueOrThrow({ where: { id: proposalA } });
    expect(JSON.stringify(contractAfter.snapshotJson)).toBe(snapshotBefore);
    expect(proposalAfter.finalPrice?.toString()).toBe(finalPriceBefore);
    expect(proposalAfter.priceLow?.toString()).toBe(proposalBefore.priceLow?.toString());
    expect(proposalAfter.priceHigh?.toString()).toBe(proposalBefore.priceHigh?.toString());
  });

  it("cross-org approve returns 404 and records no event", async () => {
    await expect(
      runWithDatabaseSession(app, staffAuth, () => service.approve(changeOrderB, orgA, staffUser)),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect((await admin.changeOrder.findUniqueOrThrow({ where: { id: changeOrderB } })).status).toBe("draft");
    expect(
      await admin.activityEvent.count({ where: { entityType: "change_order", entityId: changeOrderB } }),
    ).toBe(0);
  });
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for S068 PostgreSQL integration evidence`);
  return value;
}
