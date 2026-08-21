import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { SupplierIntegrationService } from "../modules/supplier-integration/service";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "31000000-0000-0000-0000-000000000001";
const orgB = "32000000-0000-0000-0000-000000000002";
const orgAUser = "31000000-0000-0000-0000-000000000011";
const orgBReviewer = "32000000-0000-0000-0000-000000000021";
const orgAMembership = "31000000-0000-0000-0000-000000000031";
const orgBMembership = "32000000-0000-0000-0000-000000000041";
const supplierA = "31000000-0000-0000-0000-000000000051";
const materialA = "31000000-0000-0000-0000-000000000061";
const queueA = "31000000-0000-0000-0000-000000000071";

describe("supplier queue review RLS", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Supplier Review Org A" },
        { id: orgB, name: "Supplier Review Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: orgAUser, authSubject: "supplier-review-org-a", email: "supplier-review-a@example.com" },
        { id: orgBReviewer, authSubject: "supplier-review-org-b", email: "supplier-review-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: orgAMembership, orgId: orgA, userId: orgAUser, role: "admin", status: "active" },
        { id: orgBMembership, orgId: orgB, userId: orgBReviewer, role: "owner", status: "active" },
      ],
    });
    await adminClient.supplier.create({
      data: { id: supplierA, orgId: orgA, name: "Supplier Review Fixture" },
    });
    await adminClient.material.create({
      data: {
        id: materialA,
        orgId: orgA,
        name: "Supplier Review Material",
        unitOfMeasure: "EA",
        unitCost: 100,
        wasteFactorPct: 0,
        supplierId: supplierA,
      },
    });
    await adminClient.supplierPriceUpdate.create({
      data: {
        id: queueA,
        orgId: orgA,
        supplierId: supplierA,
        materialId: materialA,
        currentUnitCost: 100,
        proposedUnitCost: 125,
        status: "pending",
        source: "supplier-feed",
      },
    });
  });

  afterAll(async () => {
    await Promise.all([appClient.$disconnect(), adminClient.$disconnect()]);
  });

  it.each(["approve", "reject"] as const)(
    "denies an orgB reviewer attempting to %s an orgA supplier price update without mutating it",
    async (operation) => {
      const service = new SupplierIntegrationService();
      const actor = { userId: orgBReviewer, orgId: orgB, role: "owner" as const };

      await expect(
        runWithDatabaseSession(
          appClient,
          actor,
          () => service[operation](queueA, orgA, actor),
          `supplier-review-cross-tenant-${operation}`
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      const [queue, material, audits] = await Promise.all([
        adminClient.supplierPriceUpdate.findUnique({ where: { id: queueA } }),
        adminClient.material.findUnique({ where: { id: materialA } }),
        adminClient.materialPriceAudit.findMany({ where: { materialId: materialA } }),
      ]);

      expect(queue).toMatchObject({
        orgId: orgA,
        supplierId: supplierA,
        materialId: materialA,
        status: "pending",
        reviewedByUserId: null,
        reviewedAt: null,
      });
      expect(Number(queue?.currentUnitCost)).toBe(100);
      expect(Number(queue?.proposedUnitCost)).toBe(125);
      expect(Number(material?.unitCost)).toBe(100);
      expect(audits).toEqual([]);
    }
  );
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for supplier review RLS integration tests`);
  return value;
}
