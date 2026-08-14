import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { createPrismaAthenaApprovalStore } from "../modules/athena-approvals/store";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "c1000000-0000-0000-0000-000000000001";
const orgB = "c2000000-0000-0000-0000-000000000002";
const adminA = "c1000000-0000-0000-0000-000000000011";
const technicianA1 = "c1000000-0000-0000-0000-000000000012";
const technicianA2 = "c1000000-0000-0000-0000-000000000013";
const ownerB = "c2000000-0000-0000-0000-000000000021";
const membershipAdminA = "c1000000-0000-0000-0000-000000000031";
const membershipTechA1 = "c1000000-0000-0000-0000-000000000032";
const membershipTechA2 = "c1000000-0000-0000-0000-000000000033";
const membershipOwnerB = "c2000000-0000-0000-0000-000000000041";

describe("live row-level security for Athena approvals", () => {
  const store = createPrismaAthenaApprovalStore();
  const approvalTechA1 = "c1000000-0000-0000-0000-000000000051";

  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Approvals Org A" }, { id: orgB, name: "Approvals Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: adminA, authSubject: "approvals-admin-a", email: "approvals-admin-a@example.com" },
        { id: technicianA1, authSubject: "approvals-tech-a1", email: "approvals-tech-a1@example.com" },
        { id: technicianA2, authSubject: "approvals-tech-a2", email: "approvals-tech-a2@example.com" },
        { id: ownerB, authSubject: "approvals-owner-b", email: "approvals-owner-b@example.com" },
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
      store.create({
        approvalId: approvalTechA1,
        userId: technicianA1,
        organizationId: orgA,
        actionId: "tradeos.athena.fixture.high-risk:1",
        toolId: "tradeos.athena.fixture.high-risk",
        toolVersion: "1.0.0",
        riskLevel: "high",
        approvedAt: new Date(0),
        approvedBy: "pending",
        expiration: new Date("2026-08-15T00:00:00.000Z"),
        status: "pending",
        idempotencyKey: "idem-approval-a1",
        inputHash: "hash-approval-a1",
        planId: "plan-approval-a1",
        stepId: "step-approval-a1",
        metadata: { source: "integration-test" },
      })
    );
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("lets a requester read their own approval request", async () => {
    const rows = await inSession(technicianA1, orgA, "technician", () => prisma.athenaApproval.findMany({ where: { id: approvalTechA1 } }));
    expect(rows).toHaveLength(1);
  });

  it("hides one user's approval request from a peer technician in the same org", async () => {
    const rows = await inSession(technicianA2, orgA, "technician", () => prisma.athenaApproval.findMany({ where: { id: approvalTechA1 } }));
    expect(rows).toHaveLength(0);
  });

  it("lets an org admin read and grant the approval request", async () => {
    const rows = await inSession(adminA, orgA, "admin", () => prisma.athenaApproval.findMany({ where: { id: approvalTechA1 } }));
    expect(rows).toHaveLength(1);

    const granted = await inSession(adminA, orgA, "admin", () => store.grant(approvalTechA1, adminA));
    expect(granted.status).toBe("granted");
    expect(granted.approvedBy).toBe(adminA);
  });

  it("never exposes another organization's approval request", async () => {
    const rows = await inSession(ownerB, orgB, "owner", () => prisma.athenaApproval.findMany({ where: { id: approvalTechA1 } }));
    expect(rows).toHaveLength(0);
  });

  it("rejects inserting an approval request on behalf of a different user", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () =>
        store.create({
          approvalId: randomUUID(),
          userId: technicianA2,
          organizationId: orgA,
          actionId: "tradeos.athena.fixture.high-risk:spoof",
          toolId: "tradeos.athena.fixture.high-risk",
          toolVersion: "1.0.0",
          riskLevel: "high",
          approvedAt: new Date(0),
          approvedBy: "pending",
          expiration: new Date("2026-08-15T00:00:00.000Z"),
          status: "pending",
          idempotencyKey: "idem-approval-spoof",
          inputHash: "hash-approval-spoof",
          planId: "plan-approval-spoof",
          stepId: "step-approval-spoof",
          metadata: {},
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects a requester trying to self-grant their own approval row", async () => {
    const pendingId = randomUUID();
    await inSession(technicianA1, orgA, "technician", () =>
      store.create({
        approvalId: pendingId,
        userId: technicianA1,
        organizationId: orgA,
        actionId: `tradeos.athena.fixture.high-risk:${pendingId}`,
        toolId: "tradeos.athena.fixture.high-risk",
        toolVersion: "1.0.0",
        riskLevel: "high",
        approvedAt: new Date(0),
        approvedBy: "pending",
        expiration: new Date("2026-08-15T00:00:00.000Z"),
        status: "pending",
        idempotencyKey: `idem-${pendingId}`,
        inputHash: `hash-${pendingId}`,
        planId: `plan-${pendingId}`,
        stepId: `step-${pendingId}`,
        metadata: {},
      })
    );

    await expect(inSession(technicianA1, orgA, "technician", () => store.grant(pendingId, technicianA1))).rejects.toBeTruthy();
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
