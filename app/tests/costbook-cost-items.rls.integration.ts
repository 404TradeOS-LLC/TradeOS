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
const divisionA = "73000000-0000-0000-0000-000000000031";
const divisionB = "83000000-0000-0000-0000-000000000032";
const categoryA = "73000000-0000-0000-0000-000000000041";
const categoryB = "83000000-0000-0000-0000-000000000042";
const subcategoryA = "73000000-0000-0000-0000-000000000051";
const subcategoryB = "83000000-0000-0000-0000-000000000052";
const costItemA = "73000000-0000-0000-0000-000000000061";
const costItemB = "83000000-0000-0000-0000-000000000062";

// The CostItem service adds explicit parent/reference validation. These live
// tests independently prove the existing database RLS still enforces the
// organization boundary underneath that application-level defense in depth.
describe("live CostItem row-level security", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "CostItem RLS Org A" },
        { id: orgB, name: "CostItem RLS Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "costitem-owner-a", email: "costitem-owner-a@example.com" },
        { id: technicianA, authSubject: "costitem-technician-a", email: "costitem-technician-a@example.com" },
        { id: ownerB, authSubject: "costitem-owner-b", email: "costitem-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { orgId: orgA, userId: technicianA, role: "technician", status: "active" },
        { orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });
    await adminClient.division.createMany({
      data: [
        { id: divisionA, orgId: orgA, code: "CI-A", name: "Org A Division" },
        { id: divisionB, orgId: orgB, code: "CI-B", name: "Org B Division" },
      ],
    });
    await adminClient.category.createMany({
      data: [
        { id: categoryA, divisionId: divisionA, code: "CAT-A", name: "Org A Category" },
        { id: categoryB, divisionId: divisionB, code: "CAT-B", name: "Org B Category" },
      ],
    });
    await adminClient.subcategory.createMany({
      data: [
        { id: subcategoryA, categoryId: categoryA, code: "SUB-A", name: "Org A Subcategory" },
        { id: subcategoryB, categoryId: categoryB, code: "SUB-B", name: "Org B Subcategory" },
      ],
    });
    await adminClient.costItem.createMany({
      data: [
        { id: costItemA, orgId: orgA, subcategoryId: subcategoryA, code: "ITEM-A", name: "Org A Cost Item", unitOfMeasure: "EA" },
        { id: costItemB, orgId: orgB, subcategoryId: subcategoryB, code: "ITEM-B", name: "Org B Cost Item", unitOfMeasure: "EA" },
      ],
    });
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("shows a read-only Costbook actor only their organization's CostItems", async () => {
    const rows = await inSession(technicianA, orgA, "technician", () =>
      prisma.costItem.findMany({ orderBy: { code: "asc" } })
    );

    expect(rows.map((row) => row.id)).toEqual([costItemA]);
  });

  it("hides a cross-organization CostItem from an owner", async () => {
    const rows = await inSession(ownerA, orgA, "owner", () =>
      prisma.costItem.findMany({ where: { id: costItemB } })
    );

    expect(rows).toEqual([]);
  });

  it("rejects a CostItem write that supplies another organization id", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.costItem.create({
          data: {
            orgId: orgB,
            subcategoryId: subcategoryB,
            code: "CROSS-ORG-ATTEMPT",
            name: "Cross Org Attempt",
            unitOfMeasure: "EA",
          },
        })
      )
    ).rejects.toBeTruthy();
  });
});

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "costitem-integration-test");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live CostItem RLS integration tests`);
  return value;
}
