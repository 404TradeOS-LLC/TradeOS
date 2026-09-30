import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { CompositePriceBenchmarkService } from "../modules/costbook/compositePriceBenchmarkService";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "51000000-0000-0000-0000-000000000001";
const orgB = "52000000-0000-0000-0000-000000000002";
const ownerA = "51000000-0000-0000-0000-000000000011";
const viewerA = "51000000-0000-0000-0000-000000000012";
const ownerB = "52000000-0000-0000-0000-000000000021";
const ownerAMembership = "51000000-0000-0000-0000-000000000031";
const viewerAMembership = "51000000-0000-0000-0000-000000000032";
const ownerBMembership = "52000000-0000-0000-0000-000000000041";

const benchmarkRow = {
  sourceName: "Indiana Department of Transportation (INDOT)",
  sourceYear: 2025,
  itemCode: "301-12234",
  description: "COMPACTED AGGREGATE, NO. 53",
  unitOfMeasure: "CYS",
  lowPrice: 50,
  weightedAvgPrice: 100,
  highPrice: 600,
  sourceQuantity: 8000,
  geography: "Indiana statewide awarded contracts",
  priceBasis: "Installed/composite awarded-bid pay-item price; not raw material-only price",
  reviewStatus: "reference" as const,
};

describe("Costbook composite benchmark RLS", () => {
  beforeAll(async () => {
    await resetFixtures();
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Composite Benchmark RLS Org A" },
        { id: orgB, name: "Composite Benchmark RLS Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "composite-benchmark-owner-a", email: "composite-a@example.com" },
        { id: viewerA, authSubject: "composite-benchmark-viewer-a", email: "composite-viewer-a@example.com" },
        { id: ownerB, authSubject: "composite-benchmark-owner-b", email: "composite-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: ownerAMembership, orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { id: viewerAMembership, orgId: orgA, userId: viewerA, role: "viewer", status: "active" },
        { id: ownerBMembership, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });
  });

  afterAll(async () => {
    try {
      await resetFixtures();
    } finally {
      await Promise.all([appClient.$disconnect(), adminClient.$disconnect()]);
    }
  });

  it("allows an owner to import an org-scoped benchmark", async () => {
    const service = new CompositePriceBenchmarkService();
    const actor = { userId: ownerA, orgId: orgA, role: "owner" as const };

    const result = await runWithDatabaseSession(
      appClient,
      actor,
      () => service.importRows(actor, [benchmarkRow]),
      "composite-benchmark-own-org-import"
    );

    expect(result).toMatchObject({ received: 1, upserted: 1, batches: 1 });

    const stored = await adminClient.$queryRaw<Array<{ org_id: string; item_code: string }>>(Prisma.sql`
      select org_id, item_code
      from costbook_composite_price_benchmarks
      where org_id = ${orgA}::uuid and item_code = ${benchmarkRow.itemCode}
    `);
    expect(stored).toEqual([{ org_id: orgA, item_code: benchmarkRow.itemCode }]);
  });

  it("denies a viewer from writing even when the service is called directly", async () => {
    const service = new CompositePriceBenchmarkService();
    const actor = { userId: viewerA, orgId: orgA, role: "viewer" as const };

    await expect(
      runWithDatabaseSession(
        appClient,
        actor,
        () => service.importRows(actor, [{ ...benchmarkRow, itemCode: "301-12235" }]),
        "composite-benchmark-viewer-write"
      )
    ).rejects.toBeTruthy();
  });

  it("hides orgA rows from an orgB owner", async () => {
    const actor = { userId: ownerB, orgId: orgB, role: "owner" as const };

    const rows = await runWithDatabaseSession(
      appClient,
      actor,
      () => prisma.$queryRaw<Array<{ item_code: string }>>(Prisma.sql`
        select item_code
        from costbook_composite_price_benchmarks
        where org_id = ${orgA}::uuid
      `),
      "composite-benchmark-cross-tenant-read"
    );

    expect(rows).toEqual([]);
  });

  it("rejects a forged cross-tenant insert at the RLS boundary", async () => {
    const actor = { userId: ownerB, orgId: orgB, role: "owner" as const };

    await expect(
      runWithDatabaseSession(
        appClient,
        actor,
        () => prisma.$executeRaw(Prisma.sql`
          insert into costbook_composite_price_benchmarks (
            org_id, source_name, source_identifier, source_year,
            item_code, description, unit_of_measure, weighted_avg_price,
            geography, price_basis, imported_by_user_id
          ) values (
            ${orgA}::uuid,
            'INDOT forged tenant write',
            'INDOT-FORGED-2025-301-12236',
            2025,
            '301-12236',
            'FORGED CROSS TENANT ROW',
            'CYS',
            100,
            'Indiana',
            'composite installed benchmark',
            ${ownerB}::uuid
          )
        `),
        "composite-benchmark-cross-tenant-write"
      )
    ).rejects.toBeTruthy();
  });
});

async function resetFixtures(): Promise<void> {
  await adminClient.$executeRaw(Prisma.sql`
    delete from costbook_composite_price_benchmarks
    where org_id in (${orgA}::uuid, ${orgB}::uuid)
  `);
  await adminClient.organizationMembership.deleteMany({
    where: { id: { in: [ownerAMembership, viewerAMembership, ownerBMembership] } },
  });
  await adminClient.appUser.deleteMany({ where: { id: { in: [ownerA, viewerA, ownerB] } } });
  await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Costbook composite benchmark RLS integration tests`);
  return value;
}
