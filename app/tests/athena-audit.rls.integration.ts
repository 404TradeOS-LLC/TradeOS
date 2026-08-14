import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { createPrismaAthenaAuditStore } from "../modules/athena-audit/store";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "d1000000-0000-0000-0000-000000000001";
const orgB = "d2000000-0000-0000-0000-000000000002";
const adminA = "d1000000-0000-0000-0000-000000000011";
const technicianA1 = "d1000000-0000-0000-0000-000000000012";
const technicianA2 = "d1000000-0000-0000-0000-000000000013";
const ownerB = "d2000000-0000-0000-0000-000000000021";
const membershipAdminA = "d1000000-0000-0000-0000-000000000031";
const membershipTechA1 = "d1000000-0000-0000-0000-000000000032";
const membershipTechA2 = "d1000000-0000-0000-0000-000000000033";
const membershipOwnerB = "d2000000-0000-0000-0000-000000000041";

describe("live row-level security for Athena audit events", () => {
  const store = createPrismaAthenaAuditStore();
  const auditEventId = randomUUID();

  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Audit Org A" }, { id: orgB, name: "Audit Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: adminA, authSubject: "audit-admin-a", email: "audit-admin-a@example.com" },
        { id: technicianA1, authSubject: "audit-tech-a1", email: "audit-tech-a1@example.com" },
        { id: technicianA2, authSubject: "audit-tech-a2", email: "audit-tech-a2@example.com" },
        { id: ownerB, authSubject: "audit-owner-b", email: "audit-owner-b@example.com" },
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

    await inSession(technicianA1, orgA, "technician", () =>
      store.record({
        id: auditEventId,
        timestamp: new Date("2026-08-14T12:00:00.000Z"),
        actor: { userId: technicianA1, role: "technician" },
        organization: orgA,
        eventType: "approval_requested",
        metadata: { toolId: "tradeos.athena.fixture.high-risk" },
        requestId: "request-audit-a1",
        traceId: "trace-audit-a1",
        executionId: randomUUID(),
        actionId: "action-audit-a1",
        approvalId: randomUUID(),
      })
    );
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("lets an actor read their own audit event", async () => {
    const rows = await inSession(technicianA1, orgA, "technician", () => prisma.athenaAuditEvent.findMany({ where: { id: auditEventId } }));
    expect(rows).toHaveLength(1);
  });

  it("hides a user-authored audit event from a peer technician in the same org", async () => {
    const rows = await inSession(technicianA2, orgA, "technician", () => prisma.athenaAuditEvent.findMany({ where: { id: auditEventId } }));
    expect(rows).toHaveLength(0);
  });

  it("lets an org admin read all audit events in the org", async () => {
    const rows = await inSession(adminA, orgA, "admin", () => prisma.athenaAuditEvent.findMany({ where: { id: auditEventId } }));
    expect(rows).toHaveLength(1);
  });

  it("never exposes another organization's audit event", async () => {
    const rows = await inSession(ownerB, orgB, "owner", () => prisma.athenaAuditEvent.findMany({ where: { id: auditEventId } }));
    expect(rows).toHaveLength(0);
  });

  it("rejects inserting an audit event on behalf of a different actor", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () =>
        store.record({
          id: randomUUID(),
          timestamp: new Date(),
          actor: { userId: technicianA2, role: "technician" },
          organization: orgA,
          eventType: "failure",
          metadata: { reasonCode: "spoof" },
        })
      )
    ).rejects.toBeTruthy();
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
