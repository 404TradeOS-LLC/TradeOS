import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "73000000-0000-0000-0000-000000000001";
const orgB = "83000000-0000-0000-0000-000000000002";
const ownerA = "73000000-0000-0000-0000-000000000011";
const technicianA = "73000000-0000-0000-0000-000000000012";
const ownerB = "83000000-0000-0000-0000-000000000021";
const membershipOwnerA = "73000000-0000-0000-0000-000000000031";
const membershipTechA = "73000000-0000-0000-0000-000000000032";
const membershipOwnerB = "83000000-0000-0000-0000-000000000041";
const equipmentA = "73000000-0000-0000-0000-000000000051";
const equipmentB = "83000000-0000-0000-0000-000000000052";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Costbook equipment RLS integration tests`);
  return value;
}

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "integration-test");
}

describe("live row-level security for Costbook equipment", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Equipment RLS Org A" },
        { id: orgB, name: "Equipment RLS Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "equipment-owner-a", email: "equipment-owner-a@example.com" },
        { id: technicianA, authSubject: "equipment-technician-a", email: "equipment-technician-a@example.com" },
        { id: ownerB, authSubject: "equipment-owner-b", email: "equipment-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipOwnerA, orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { id: membershipTechA, orgId: orgA, userId: technicianA, role: "technician", status: "active" },
        { id: membershipOwnerB, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });

    await inSession(ownerA, orgA, "owner", () =>
      prisma.equipment.create({
        data: {
          id: equipmentA,
          orgId: orgA,
          name: "Org A Lift",
          ownershipCostPerHour: 20,
          operatingCostPerHour: 5,
        },
      })
    );
    await inSession(ownerB, orgB, "owner", () =>
      prisma.equipment.create({
        data: {
          id: equipmentB,
          orgId: orgB,
          name: "Org B Lift",
          ownershipCostPerHour: 25,
          operatingCostPerHour: 6,
        },
      })
    );
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("lets an owner write equipment inside their organization", async () => {
    const updated = await inSession(ownerA, orgA, "owner", () =>
      prisma.equipment.update({ where: { id: equipmentA }, data: { dailyRate: 300 } })
    );

    expect(Number(updated.dailyRate)).toBe(300);
  });

  it("rejects technician equipment writes", async () => {
    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.equipment.update({ where: { id: equipmentA }, data: { name: "Technician Edit Attempt" } })
      )
    ).rejects.toBeTruthy();

    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.equipment.create({
          data: {
            orgId: orgA,
            name: "Technician Create Attempt",
            ownershipCostPerHour: 10,
            operatingCostPerHour: 2,
          },
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects cross-organization equipment writes", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.equipment.update({ where: { id: equipmentB }, data: { name: "Cross Org Edit Attempt" } })
      )
    ).rejects.toBeTruthy();
  });

  it("keeps equipment reads scoped to the authenticated organization", async () => {
    const rows = await inSession(technicianA, orgA, "technician", () =>
      prisma.equipment.findMany({ where: { id: { in: [equipmentA, equipmentB] } }, orderBy: { id: "asc" } })
    );

    expect(rows.map((row) => row.id)).toEqual([equipmentA]);
  });
});
