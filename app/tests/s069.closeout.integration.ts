import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { CloseoutService } from "../modules/closeout/service";

/**
 * S069 — live-PostgreSQL certification evidence for the closeout and
 * warranty workspace: the closeout journey (completed job → closeout →
 * punch create/assign/resolve/verify → ready → handoff) must leave the
 * project's signed history byte-identical.
 *
 * Exercises the REAL CloseoutService (no mocked Prisma) against the
 * disposable database provisioned by scripts/test-integration-db.sh. The
 * service's module-level `prisma` singleton binds to DATABASE_URL, which
 * the integration runner sets to the restricted app-role URL (the same
 * value as TEST_DATABASE_URL), so every query below runs under forced RLS
 * exactly as in production. Service calls run inside
 * runWithDatabaseSession (staff / technician sessions), the same context
 * `requireAuth` + `databaseSession` establishes for the staff routes.
 *
 * The job is seeded `completed` with a completedAt timestamp: field
 * completion itself is JobsService-owned (dispatch → travel → arrive →
 * complete) and the closeout workspace starts at field completion —
 * `createCloseoutForProject` refuses a project with no completed job.
 * What this file proves is the closeout half: the journey creates only
 * new, attributable closeout/punch/warranty records and audit events,
 * and never rewrites the Contract snapshot, the Invoice amount/status,
 * or the Proposal status/pricing.
 *
 * NOT run locally on this VM by default: `npm run test:integration`
 * provisions its disposable database with Docker, which is unavailable
 * here. This file is verified locally only by `tsc --noEmit` and
 * `jest --listTests`; CI is authoritative for the live assertions.
 * (A local PostgreSQL 16 cluster can provision the same disposable
 * database by hand — see the run record in
 * docs/architecture/S069_CLOSEOUT_WARRANTY_EVIDENCE.md §6.)
 */

jest.setTimeout(30_000);

const app = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_URL") } } });
const admin = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_ADMIN_URL") } } });
const service = new CloseoutService();

const orgA = randomUUID();
const orgB = randomUUID();
const staffUser = randomUUID();
const technicianUser = randomUUID();
const staffMembership = randomUUID();
const technicianMembership = randomUUID();
const customerA = randomUUID();
const serviceAddressA = randomUUID();
const projectA = randomUUID();
const proposalA = randomUUID();
const contractA = randomUUID();
const invoiceA = randomUUID();
const jobA = randomUUID();

const staffAuth = { userId: staffUser, orgId: orgA, role: "admin" as const };
const technicianAuth = { userId: technicianUser, orgId: orgA, role: "technician" as const };

const contractSnapshot = {
  proposalId: proposalA,
  finalPrice: "2450.00",
  status: "sent",
  termsText: "S069 snapshot — must not mutate across the closeout journey",
};

describe("S069 closeout and warranty workspace certification (live PostgreSQL)", () => {
  beforeAll(async () => {
    await admin.organization.createMany({
      data: [
        { id: orgA, name: "S069 Org A" },
        { id: orgB, name: "S069 Org B" },
      ],
    });
    await admin.appUser.createMany({
      data: [
        { id: staffUser, authSubject: `s069-${staffUser}`, email: `s069-${staffUser}@example.invalid` },
        { id: technicianUser, authSubject: `s069-${technicianUser}`, email: `s069-tech-${technicianUser}@example.invalid`, fullName: "S069 Technician" },
      ],
    });
    await admin.organizationMembership.createMany({
      data: [
        { id: staffMembership, orgId: orgA, userId: staffUser, role: "admin", status: "active" },
        { id: technicianMembership, orgId: orgA, userId: technicianUser, role: "technician", status: "active" },
      ],
    });
    await admin.customer.create({
      data: { id: customerA, orgId: orgA, name: "S069 Customer A", email: `s069-${customerA}@example.invalid` },
    });
    await admin.serviceAddress.create({
      data: {
        id: serviceAddressA,
        orgId: orgA,
        customerId: customerA,
        addressLine1: "1 S069 Way",
        city: "Terre Haute",
        state: "IN",
        postalCode: "47802",
      },
    });
    await admin.project.create({
      data: { id: projectA, orgId: orgA, customerId: customerA, name: "S069 Project A" },
    });
    await admin.proposal.create({
      data: { id: proposalA, projectId: projectA, status: "accepted", finalPrice: 2450.0, priceLow: 2300.0, priceHigh: 2600.0 },
    });
    await admin.contract.create({
      data: {
        id: contractA,
        projectId: projectA,
        proposalId: proposalA,
        status: "pending_signature",
        termsText: "S069 contract",
        snapshotJson: contractSnapshot,
        signedAt: new Date("2026-11-20T10:00:00.000Z"),
      },
    });
    await admin.invoice.create({
      data: { id: invoiceA, projectId: projectA, proposalId: proposalA, invoiceNumber: 1, status: "sent", amount: 2450.0 },
    });
    await admin.job.create({
      data: {
        id: jobA,
        orgId: orgA,
        projectId: projectA,
        customerId: customerA,
        serviceAddressId: serviceAddressA,
        jobNumber: "JOB-2026-000069",
        title: "S069 Completed Job",
        jobType: "General Contracting",
        status: "completed",
        completedAt: new Date("2026-11-21T15:00:00.000Z"),
        completedById: technicianUser,
        createdById: staffUser,
      },
    });
  });

  afterAll(async () => {
    await admin.activityEvent.deleteMany({ where: { orgId: orgA } });
    await admin.warrantyRecord.deleteMany({ where: { projectId: projectA } });
    await admin.punchItem.deleteMany({ where: { projectId: projectA } });
    await admin.projectCloseout.deleteMany({ where: { projectId: projectA } });
    await admin.job.deleteMany({ where: { id: jobA } });
    await admin.invoice.deleteMany({ where: { id: invoiceA } });
    await admin.contract.deleteMany({ where: { id: contractA } });
    await admin.proposal.deleteMany({ where: { id: proposalA } });
    await admin.project.deleteMany({ where: { id: projectA } });
    await admin.serviceAddress.deleteMany({ where: { id: serviceAddressA } });
    await admin.customer.deleteMany({ where: { id: customerA } });
    await admin.organizationMembership.deleteMany({ where: { id: { in: [staffMembership, technicianMembership] } } });
    await admin.appUser.deleteMany({ where: { id: { in: [staffUser, technicianUser] } } });
    await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await app.$disconnect();
    await admin.$disconnect();
  });

  it("completes the closeout journey and leaves the contract snapshot, invoice, and proposal byte-identical", async () => {
    const contractBefore = await admin.contract.findUniqueOrThrow({ where: { id: contractA } });
    const invoiceBefore = await admin.invoice.findUniqueOrThrow({ where: { id: invoiceA } });
    const proposalBefore = await admin.proposal.findUniqueOrThrow({ where: { id: proposalA } });
    const snapshotBefore = JSON.stringify(contractBefore.snapshotJson);
    const invoiceAmountBefore = invoiceBefore.amount.toString();
    const invoiceStatusBefore = invoiceBefore.status;
    const proposalStatusBefore = proposalBefore.status;
    const proposalPriceBefore = proposalBefore.finalPrice?.toString();

    // Completed job → create the closeout (draft, linked to the job).
    const created = await runWithDatabaseSession(app, staffAuth, () =>
      service.createCloseoutForProject({ orgId: orgA, projectId: projectA, actorUserId: staffUser }),
    );
    expect(created.status).toBe("draft");
    expect(created.jobId).toBe(jobA);
    expect(created.projectId).toBe(projectA);

    // Punch item: create, assign to the technician, resolve as the
    // assigned technician, verify as staff.
    const punch = await runWithDatabaseSession(app, staffAuth, () =>
      service.createPunchItem({
        orgId: orgA,
        projectId: projectA,
        jobId: jobA,
        title: "Touch up paint at entry trim",
        description: "Scuff on the entry trim, north side.",
        priority: "high",
        assignedUserId: technicianUser,
        createdById: staffUser,
      }),
    );
    expect(punch.status).toBe("open");
    expect(punch.assignedUserId).toBe(technicianUser);

    const resolved = await runWithDatabaseSession(app, technicianAuth, () =>
      service.resolvePunchItem(punch.id, orgA, technicianUser, "technician"),
    );
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedById).toBe(technicianUser);

    const verified = await runWithDatabaseSession(app, staffAuth, () =>
      service.verifyPunchItem(punch.id, orgA, staffUser, "admin"),
    );
    expect(verified.status).toBe("verified");

    // Warranty record: quotes the source document's own wording — the
    // service invents no coverage term.
    const warranty = await runWithDatabaseSession(app, staffAuth, () =>
      service.createWarrantyRecord({
        orgId: orgA,
        projectId: projectA,
        jobId: jobA,
        contractId: contractA,
        title: "Workmanship warranty",
        coverageText: "One-year workmanship coverage per the signed contract.",
        sourceType: "contract",
        sourceId: contractA,
        createdById: staffUser,
      }),
    );
    expect(warranty.sourceType).toBe("contract");
    expect(warranty.coverageText).toBe("One-year workmanship coverage per the signed contract.");

    // Ready requires the checklist (completed job, signed contract, final
    // invoice, accepted proposal, zero open punch items) — all present.
    const ready = await runWithDatabaseSession(app, staffAuth, () =>
      service.markCloseoutReady(projectA, orgA, staffUser, "admin"),
    );
    expect(ready.closeout.status).toBe("ready");
    expect(ready.checklist.ready).toBe(true);
    expect(ready.closeout.completedById).toBe(staffUser);

    const handedOff = await runWithDatabaseSession(app, staffAuth, () =>
      service.markCloseoutHandedOff(projectA, orgA, staffUser, "admin"),
    );
    expect(handedOff.status).toBe("handed_off");
    expect(handedOff.handedOffById).toBe(staffUser);

    // The closeout record exists with the acting user recorded.
    const closeoutRow = await admin.projectCloseout.findUniqueOrThrow({ where: { projectId: projectA } });
    expect(closeoutRow.id).toBe(created.id);
    expect(closeoutRow.status).toBe("handed_off");
    expect(closeoutRow.completedById).toBe(staffUser);
    expect(closeoutRow.handedOffById).toBe(staffUser);

    // Every transition recorded exactly one attributable audit event.
    const events = await admin.activityEvent.findMany({
      where: { orgId: orgA, entityId: { in: [created.id, punch.id, warranty.id] } },
      orderBy: { occurredAt: "asc" },
    });
    const byType = (eventType: string) => events.filter((event) => event.eventType === eventType);
    expect(byType("project_closeout.created")).toHaveLength(1);
    expect(byType("project_closeout.created")[0]).toMatchObject({ actorUserId: staffUser, entityId: created.id });
    expect(byType("punch_item.created")).toHaveLength(1);
    expect(byType("punch_item.created")[0]).toMatchObject({ actorUserId: staffUser, entityId: punch.id });
    expect(byType("punch_item.resolved")).toHaveLength(1);
    expect(byType("punch_item.resolved")[0]).toMatchObject({ actorUserId: technicianUser, entityId: punch.id });
    expect(byType("punch_item.verified")).toHaveLength(1);
    expect(byType("punch_item.verified")[0]).toMatchObject({ actorUserId: staffUser, entityId: punch.id });
    expect(byType("warranty_record.created")).toHaveLength(1);
    expect(byType("warranty_record.created")[0]).toMatchObject({ actorUserId: staffUser, entityId: warranty.id });
    expect(byType("project_closeout.ready")).toHaveLength(1);
    expect(byType("project_closeout.ready")[0]).toMatchObject({ actorUserId: staffUser, entityId: created.id });
    expect(byType("project_closeout.handed_off")).toHaveLength(1);
    expect(byType("project_closeout.handed_off")[0]).toMatchObject({ actorUserId: staffUser, entityId: created.id });

    // The signed history is byte-identical: the closeout journey is new
    // attributable records only, never an edit to Contract, Invoice, or
    // Proposal rows.
    const contractAfter = await admin.contract.findUniqueOrThrow({ where: { id: contractA } });
    const invoiceAfter = await admin.invoice.findUniqueOrThrow({ where: { id: invoiceA } });
    const proposalAfter = await admin.proposal.findUniqueOrThrow({ where: { id: proposalA } });
    expect(JSON.stringify(contractAfter.snapshotJson)).toBe(snapshotBefore);
    expect(contractAfter.status).toBe(contractBefore.status);
    expect(contractAfter.signedAt?.toISOString()).toBe(contractBefore.signedAt?.toISOString());
    expect(invoiceAfter.amount.toString()).toBe(invoiceAmountBefore);
    expect(invoiceAfter.status).toBe(invoiceStatusBefore);
    expect(proposalAfter.status).toBe(proposalStatusBefore);
    expect(proposalAfter.finalPrice?.toString()).toBe(proposalPriceBefore);
    expect(proposalAfter.priceLow?.toString()).toBe(proposalBefore.priceLow?.toString());
    expect(proposalAfter.priceHigh?.toString()).toBe(proposalBefore.priceHigh?.toString());
  });

  it("cross-org punch resolve returns 404 and records no event", async () => {
    const punch = await admin.punchItem.create({
      data: {
        orgId: orgA,
        projectId: projectA,
        jobId: jobA,
        title: "Cross-org resolve probe",
        status: "open",
        createdById: staffUser,
      },
    });
    try {
      await expect(
        runWithDatabaseSession(app, staffAuth, () => service.resolvePunchItem(punch.id, orgB, staffUser, "admin")),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect((await admin.punchItem.findUniqueOrThrow({ where: { id: punch.id } })).status).toBe("open");
      expect(
        await admin.activityEvent.count({
          where: { entityType: "punch_item", entityId: punch.id, eventType: "punch_item.resolved" },
        }),
      ).toBe(0);
    } finally {
      await admin.punchItem.delete({ where: { id: punch.id } });
    }
  });
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for S069 PostgreSQL integration evidence`);
  return value;
}
