import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { createExecutionRecord, recordTransition, persistTelemetryRecord } from "../modules/athena-kernel/executionStore";

// Live RLS coverage for the A1 execution/transition/telemetry tables
// (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md "A1 Execution
// Persistence Decision": "Include live RLS integration coverage if a Prisma
// table or migration is added"). Kept as its own file rather than appended
// to tests/rls.integration.ts so this narrow A1 slice stays independently
// reviewable, per the implementation plan's instruction not to touch
// unrelated dirty files in that shared fixture.
const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "30000000-0000-0000-0000-000000000001";
const orgB = "40000000-0000-0000-0000-000000000002";
const adminA = "30000000-0000-0000-0000-000000000011";
const technicianA1 = "30000000-0000-0000-0000-000000000012";
const technicianA2 = "30000000-0000-0000-0000-000000000013";
const ownerB = "40000000-0000-0000-0000-000000000021";
const membershipAdminA = "30000000-0000-0000-0000-000000000031";
const membershipTechA1 = "30000000-0000-0000-0000-000000000032";
const membershipTechA2 = "30000000-0000-0000-0000-000000000033";
const membershipOwnerB = "40000000-0000-0000-0000-000000000041";

const executionTechA1 = "30000000-0000-0000-0000-000000000051";
const executionOwnerB = "40000000-0000-0000-0000-000000000052";

describe("live row-level security for Athena kernel execution tables", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Athena Org A" }, { id: orgB, name: "Athena Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: adminA, authSubject: "athena-admin-a", email: "athena-admin-a@example.com" },
        { id: technicianA1, authSubject: "athena-tech-a1", email: "athena-tech-a1@example.com" },
        { id: technicianA2, authSubject: "athena-tech-a2", email: "athena-tech-a2@example.com" },
        { id: ownerB, authSubject: "athena-owner-b", email: "athena-owner-b@example.com" },
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
      createExecutionRecord({
        executionId: executionTechA1,
        orgId: orgA,
        requestId: "req-tech-a1",
        traceId: "trace-tech-a1",
        actorUserId: technicianA1,
        canonicalRole: "technician",
        requestSource: "test",
      })
    );
    await inSession(technicianA1, orgA, "technician", () =>
      recordTransition({ executionId: executionTechA1, orgId: orgA, fromState: "created", toState: "context_building", reasonCode: "test_setup", roundTrips: 0 })
    );
    await inSession(technicianA1, orgA, "technician", () =>
      persistTelemetryRecord({
        executionId: executionTechA1,
        orgId: orgA,
        requestId: "req-tech-a1",
        traceId: "trace-tech-a1",
        spanType: "kernel",
        status: "ok",
        durationMs: 5,
        redaction: "metadata_only",
        metadata: { finalState: "context_building" },
      })
    );

    await inSession(ownerB, orgB, "owner", () =>
      createExecutionRecord({
        executionId: executionOwnerB,
        orgId: orgB,
        requestId: "req-owner-b",
        traceId: "trace-owner-b",
        actorUserId: ownerB,
        canonicalRole: "owner",
        requestSource: "test",
      })
    );
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  // Reads below must go through the `prisma` proxy from ../db/client (which
  // resolves to the transaction runWithDatabaseSession opened and where
  // set_config() applied the RLS session vars), never the raw appClient -
  // a raw appClient.<model>.findMany() call opens its own fresh, unscoped
  // connection with no app.org_id/app.user_id/app.role set at all, which
  // would make every query below trivially return zero rows regardless of
  // whether RLS is actually enforcing anything.
  it("lets an actor see their own execution", async () => {
    const rows = await inSession(technicianA1, orgA, "technician", () => prisma.athenaExecution.findMany({ where: { id: executionTechA1 } }));
    expect(rows).toHaveLength(1);
  });

  it("hides one technician's execution from a peer technician in the same org (object-scope, not just org-scope)", async () => {
    const rows = await inSession(technicianA2, orgA, "technician", () => prisma.athenaExecution.findMany({ where: { id: executionTechA1 } }));
    expect(rows).toHaveLength(0);
  });

  it("lets an org admin see every execution in their org regardless of actor", async () => {
    const rows = await inSession(adminA, orgA, "admin", () => prisma.athenaExecution.findMany({ where: { id: executionTechA1 } }));
    expect(rows).toHaveLength(1);
  });

  it("never exposes another organization's execution, even to that org's owner", async () => {
    const rows = await inSession(ownerB, orgB, "owner", () => prisma.athenaExecution.findMany({ where: { id: executionTechA1 } }));
    expect(rows).toHaveLength(0);

    const crossOrgAsAdminA = await inSession(adminA, orgA, "admin", () => prisma.athenaExecution.findMany({ where: { id: executionOwnerB } }));
    expect(crossOrgAsAdminA).toHaveLength(0);
  });

  it("applies the same actor/org scoping to child transition and telemetry rows", async () => {
    const transitionsAsPeer = await inSession(technicianA2, orgA, "technician", () => prisma.athenaExecutionTransition.findMany({ where: { executionId: executionTechA1 } }));
    expect(transitionsAsPeer).toHaveLength(0);

    const transitionsAsOwner = await inSession(technicianA1, orgA, "technician", () => prisma.athenaExecutionTransition.findMany({ where: { executionId: executionTechA1 } }));
    expect(transitionsAsOwner.length).toBeGreaterThan(0);

    const telemetryAsPeer = await inSession(technicianA2, orgA, "technician", () => prisma.athenaTelemetryRecordRow.findMany({ where: { executionId: executionTechA1 } }));
    expect(telemetryAsPeer).toHaveLength(0);

    const telemetryAsAdmin = await inSession(adminA, orgA, "admin", () => prisma.athenaTelemetryRecordRow.findMany({ where: { executionId: executionTechA1 } }));
    expect(telemetryAsAdmin.length).toBeGreaterThan(0);
  });

  it("rejects inserting an execution row on behalf of a different user (insert policy actor check)", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () =>
        createExecutionRecord({
          executionId: "30000000-0000-0000-0000-000000000099",
          orgId: orgA,
          requestId: "req-spoof",
          traceId: "trace-spoof",
          actorUserId: technicianA2,
          canonicalRole: "technician",
          requestSource: "test",
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects inserting an execution row into a different organization (insert policy org check)", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () =>
        createExecutionRecord({
          executionId: "30000000-0000-0000-0000-000000000098",
          orgId: orgB,
          requestId: "req-cross-org",
          traceId: "trace-cross-org",
          actorUserId: technicianA1,
          canonicalRole: "technician",
          requestSource: "test",
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
