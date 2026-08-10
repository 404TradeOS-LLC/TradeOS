import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { createPrismaAthenaMemoryRepository } from "../modules/athena-memory/store";
import type { AthenaMemoryRecord } from "../modules/athena-memory/types";

// Live RLS coverage for the A7 memory table (AGENTS.md: "new RLS-protected
// tables need live integration coverage"; docs task Step 3: "Add tests
// proving tenant isolation"). Mocked-Prisma unit tests
// (athena-memory.service.test.ts) prove AthenaMemoryService's own
// application-level ownership logic; this file proves the database's own
// forced RLS policies independently enforce the same boundary even if that
// application logic were ever bypassed or buggy - kept as its own file,
// mirroring athena-kernel.integration.ts's precedent, rather than appended
// to the shared tests/rls.integration.ts fixture.
const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "70000000-0000-0000-0000-000000000001";
const orgB = "80000000-0000-0000-0000-000000000002";
const ownerA = "70000000-0000-0000-0000-000000000011";
const technicianA1 = "70000000-0000-0000-0000-000000000012";
const technicianA2 = "70000000-0000-0000-0000-000000000013";
const ownerB = "80000000-0000-0000-0000-000000000021";
const membershipOwnerA = "70000000-0000-0000-0000-000000000031";
const membershipTechA1 = "70000000-0000-0000-0000-000000000032";
const membershipTechA2 = "70000000-0000-0000-0000-000000000033";
const membershipOwnerB = "80000000-0000-0000-0000-000000000041";

function memoryRecord(overrides: Partial<AthenaMemoryRecord>): AthenaMemoryRecord {
  const now = new Date().toISOString();
  return {
    id: overrides.id as string,
    version: "1.0.0",
    orgId: orgA,
    scope: "user",
    subjectId: technicianA1,
    kind: "preference.response_style",
    value: "concise",
    source: { kind: "user_message", trusted: true },
    confidence: 0.7,
    retention: { tier: "standard" },
    status: "active",
    visibility: "actor",
    createdByActor: { type: "user", id: technicianA1 },
    updatedByActor: { type: "user", id: technicianA1 },
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides,
  };
}

describe("live row-level security for the A7 athena_memories table", () => {
  const repository = createPrismaAthenaMemoryRepository();
  const userMemoryTechA1 = "70000000-0000-0000-0000-000000000051";
  const orgMemoryOrgA = "70000000-0000-0000-0000-000000000052";
  const userMemoryOwnerB = "80000000-0000-0000-0000-000000000053";

  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Memory Org A" }, { id: orgB, name: "Memory Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "memory-owner-a", email: "memory-owner-a@example.com" },
        { id: technicianA1, authSubject: "memory-tech-a1", email: "memory-tech-a1@example.com" },
        { id: technicianA2, authSubject: "memory-tech-a2", email: "memory-tech-a2@example.com" },
        { id: ownerB, authSubject: "memory-owner-b", email: "memory-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipOwnerA, orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { id: membershipTechA1, orgId: orgA, userId: technicianA1, role: "technician", status: "active" },
        { id: membershipTechA2, orgId: orgA, userId: technicianA2, role: "technician", status: "active" },
        { id: membershipOwnerB, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });

    await inSession(technicianA1, orgA, "technician", () => repository.create(memoryRecord({ id: userMemoryTechA1, subjectId: technicianA1 })));
    await inSession(ownerA, orgA, "owner", () => repository.create(memoryRecord({ id: orgMemoryOrgA, scope: "organization", subjectId: orgA, visibility: "organization", source: { kind: "admin_policy", trusted: true }, createdByActor: { type: "user", id: ownerA }, updatedByActor: { type: "user", id: ownerA } })));
    await inSession(ownerB, orgB, "owner", () => repository.create(memoryRecord({ id: userMemoryOwnerB, orgId: orgB, subjectId: ownerB, createdByActor: { type: "user", id: ownerB }, updatedByActor: { type: "user", id: ownerB } })));
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("lets an actor see their own user-scope memory", async () => {
    const rows = await inSession(technicianA1, orgA, "technician", () => prisma.athenaMemory.findMany({ where: { id: userMemoryTechA1 } }));
    expect(rows).toHaveLength(1);
  });

  it("hides one user's memory from a peer in the same org, even a fellow technician (no admin bypass for user-scope memory)", async () => {
    const asPeer = await inSession(technicianA2, orgA, "technician", () => prisma.athenaMemory.findMany({ where: { id: userMemoryTechA1 } }));
    expect(asPeer).toHaveLength(0);

    const asOwner = await inSession(ownerA, orgA, "owner", () => prisma.athenaMemory.findMany({ where: { id: userMemoryTechA1 } }));
    expect(asOwner).toHaveLength(0);
  });

  it("never exposes another organization's memory, even to that org's owner", async () => {
    const crossOrg = await inSession(ownerB, orgB, "owner", () => prisma.athenaMemory.findMany({ where: { id: userMemoryTechA1 } }));
    expect(crossOrg).toHaveLength(0);

    const crossOrgReverse = await inSession(ownerA, orgA, "owner", () => prisma.athenaMemory.findMany({ where: { id: userMemoryOwnerB } }));
    expect(crossOrgReverse).toHaveLength(0);
  });

  it("lets any org member read organization-scope memory", async () => {
    const asTechnician = await inSession(technicianA1, orgA, "technician", () => prisma.athenaMemory.findMany({ where: { id: orgMemoryOrgA } }));
    expect(asTechnician).toHaveLength(1);
  });

  it("rejects inserting a user-scope row on behalf of a different user (insert policy actor check)", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () => repository.create(memoryRecord({ id: "70000000-0000-0000-0000-000000000099", subjectId: technicianA2 })))
    ).rejects.toBeTruthy();
  });

  it("rejects a non-admin inserting organization-scope memory (insert policy admin check)", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () => repository.create(memoryRecord({ id: "70000000-0000-0000-0000-000000000098", scope: "organization", subjectId: orgA, visibility: "organization" })))
    ).rejects.toBeTruthy();
  });

  it("rejects inserting into a different organization (insert policy org check)", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () => repository.create(memoryRecord({ id: "70000000-0000-0000-0000-000000000097", orgId: orgB })))
    ).rejects.toBeTruthy();
  });

  it("rejects a non-admin updating (correcting) organization-scope memory", async () => {
    await expect(
      inSession(technicianA1, orgA, "technician", () =>
        repository.correct(orgA, orgMemoryOrgA, memoryRecord({ id: "70000000-0000-0000-0000-000000000096", scope: "organization", subjectId: orgA, visibility: "organization", value: "hijacked" }))
      )
    ).rejects.toBeTruthy();
  });

  it("allows an admin-capable actor to correct organization-scope memory", async () => {
    const corrected = await inSession(ownerA, orgA, "owner", () =>
      repository.correct(orgA, orgMemoryOrgA, memoryRecord({ id: "70000000-0000-0000-0000-000000000095", scope: "organization", subjectId: orgA, visibility: "organization", value: "policy-updated", createdByActor: { type: "user", id: ownerA }, updatedByActor: { type: "user", id: ownerA } }))
    );
    expect(corrected.value).toBe("policy-updated");
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
