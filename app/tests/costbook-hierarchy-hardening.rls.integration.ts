import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "72000000-0000-0000-0000-000000000001";
const orgB = "82000000-0000-0000-0000-000000000002";
const ownerA = "72000000-0000-0000-0000-000000000011";
const ownerB = "82000000-0000-0000-0000-000000000021";
const membershipOwnerA = "72000000-0000-0000-0000-000000000031";
const membershipOwnerB = "82000000-0000-0000-0000-000000000041";
const divisionA = "72000000-0000-0000-0000-000000000081";
const divisionB = "82000000-0000-0000-0000-000000000082";
const inactiveDivisionA = "72000000-0000-0000-0000-000000000083";
const categoryA = "72000000-0000-0000-0000-000000000091";
const categoryB = "82000000-0000-0000-0000-000000000092";
const inactiveCategoryA = "72000000-0000-0000-0000-000000000093";
const inactiveCategoryUnderInactiveDivisionA = "72000000-0000-0000-0000-000000000094";
const subcategoryA = "72000000-0000-0000-0000-000000000095";

describe("live RLS hardening for Costbook hierarchy", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Hierarchy Hardening Org A" },
        { id: orgB, name: "Hierarchy Hardening Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "hierarchy-hardening-owner-a", email: "hierarchy-hardening-owner-a@example.com" },
        { id: ownerB, authSubject: "hierarchy-hardening-owner-b", email: "hierarchy-hardening-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipOwnerA, orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { id: membershipOwnerB, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });

    await inSession(ownerA, orgA, "owner", () =>
      prisma.division.create({ data: { id: divisionA, orgId: orgA, code: "HARD-A", name: "Hardening A" } })
    );
    await inSession(ownerB, orgB, "owner", () =>
      prisma.division.create({ data: { id: divisionB, orgId: orgB, code: "HARD-B", name: "Hardening B" } })
    );
    await inSession(ownerA, orgA, "owner", () =>
      prisma.division.create({
        data: { id: inactiveDivisionA, orgId: orgA, code: "HARD-A-OFF", name: "Inactive Hardening A", isActive: false },
      })
    );
    await inSession(ownerA, orgA, "owner", () =>
      prisma.category.create({ data: { id: categoryA, divisionId: divisionA, code: "CAT-A", name: "Category A" } })
    );
    await inSession(ownerB, orgB, "owner", () =>
      prisma.category.create({ data: { id: categoryB, divisionId: divisionB, code: "CAT-B", name: "Category B" } })
    );
    await inSession(ownerA, orgA, "owner", () =>
      prisma.category.create({
        data: { id: inactiveCategoryA, divisionId: divisionA, code: "CAT-A-OFF", name: "Inactive Category A", isActive: false },
      })
    );
    await inSession(ownerA, orgA, "owner", () =>
      prisma.category.create({
        data: {
          id: inactiveCategoryUnderInactiveDivisionA,
          divisionId: inactiveDivisionA,
          code: "CAT-A-OFF-DIV",
          name: "Inactive Category Under Inactive Division A",
          isActive: false,
        },
      })
    );
    await inSession(ownerA, orgA, "owner", () =>
      prisma.subcategory.create({
        data: { id: subcategoryA, categoryId: categoryA, code: "SUB-A", name: "Subcategory A", isActive: true },
      })
    );
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("rejects a cross-organization category insert through RLS even when inactive", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.category.create({
          data: { divisionId: divisionB, code: "CROSS-ORG-CAT", name: "Cross-org category", isActive: false },
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects a cross-organization subcategory insert through RLS even when inactive", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.subcategory.create({
          data: { categoryId: categoryB, code: "CROSS-ORG-SUB", name: "Cross-org subcategory", isActive: false },
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects creating an active category beneath an inactive division", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.category.create({
          data: {
            divisionId: inactiveDivisionA,
            code: "ACTIVE-UNDER-INACTIVE",
            name: "Invalid active category",
            isActive: true,
          },
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects reactivating a category when its division is inactive", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.category.update({
          where: { id: inactiveCategoryUnderInactiveDivisionA },
          data: { isActive: true },
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects creating an active subcategory beneath an inactive category", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.subcategory.create({
          data: {
            categoryId: inactiveCategoryA,
            code: "ACTIVE-SUB-INVALID",
            name: "Invalid active subcategory",
            isActive: true,
          },
        })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects deactivating a division while active categories remain", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.division.update({ where: { id: divisionA }, data: { isActive: false } })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects deactivating a category while active subcategories remain", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.category.update({ where: { id: categoryA }, data: { isActive: false } })
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
