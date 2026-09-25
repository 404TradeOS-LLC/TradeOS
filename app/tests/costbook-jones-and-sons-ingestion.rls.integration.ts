import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { CostbookCandidateService } from "../modules/costbook/candidateCostItemService";
import { ingestJonesAndSonsTerreHauteCandidates } from "../modules/costbook/jonesAndSonsIngestion";
import {
  JONES_AND_SONS_SOURCE_NAME,
  TERRE_HAUTE_VERIFIED_RECORDS,
} from "../modules/costbook/jonesAndSonsTerreHaute";

/**
 * Proves the one real, source-backed trade this pipeline has actually run
 * end to end: the two Jones & Sons Terre Haute branch-verified aggregate
 * materials (Sitework trade). Ingestion -> review -> promotion all go
 * through the same canonical, org-scoped, RLS-protected paths every other
 * candidate uses - nothing here is a shortcut.
 *
 * See docs/reports/JONES_AND_SONS_TERRE_HAUTE_INGESTION_2026-09-12.md for
 * the source evidence and its documented limitations.
 */

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "43000000-0000-0000-0000-000000000001";
const orgB = "44000000-0000-0000-0000-000000000002";
const orgAOwner = "43000000-0000-0000-0000-000000000011";
const orgBOwner = "44000000-0000-0000-0000-000000000021";
const orgAMembership = "43000000-0000-0000-0000-000000000031";
const orgBMembership = "44000000-0000-0000-0000-000000000041";
const divisionA = "43000000-0000-0000-0000-000000000061";
const categoryA = "43000000-0000-0000-0000-000000000071";
const subcategoryA = "43000000-0000-0000-0000-000000000081";
const divisionB = "44000000-0000-0000-0000-000000000061";
const categoryB = "44000000-0000-0000-0000-000000000071";
const subcategoryB = "44000000-0000-0000-0000-000000000081";

const RETRIEVED_AT = "2026-09-14T00:00:00.000Z";

describe("Jones & Sons Terre Haute candidate ingestion - end-to-end real-source path", () => {
  let promotedCostItemId: string;
  let firstCandidateId: string;
  let secondCandidateId: string;

  beforeAll(async () => {
    await resetFixtures();
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Jones & Sons Ingestion Org A" },
        { id: orgB, name: "Jones & Sons Ingestion Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: orgAOwner, authSubject: "jones-sons-org-a", email: "jones-sons-a@example.com" },
        { id: orgBOwner, authSubject: "jones-sons-org-b", email: "jones-sons-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: orgAMembership, orgId: orgA, userId: orgAOwner, role: "owner", status: "active" },
        { id: orgBMembership, orgId: orgB, userId: orgBOwner, role: "owner", status: "active" },
      ],
    });

    // Both organizations get a matching "Aggregate" subcategory so either
    // could promote a Jones & Sons candidate - candidate.category is
    // "Aggregate" for both TERRE_HAUTE_VERIFIED_RECORDS entries.
    const ownerA = { userId: orgAOwner, orgId: orgA, role: "owner" as const };
    await runWithDatabaseSession(appClient, ownerA, async () => {
      await prisma.division.create({ data: { id: divisionA, orgId: orgA, code: "02", name: "Sitework Division" } });
      await prisma.category.create({ data: { id: categoryA, divisionId: divisionA, code: "02-10", name: "Sitework" } });
      await prisma.subcategory.create({ data: { id: subcategoryA, categoryId: categoryA, code: "02-10-10", name: "Aggregate" } });
    }, "jones-sons-fixture-a");

    const ownerB = { userId: orgBOwner, orgId: orgB, role: "owner" as const };
    await runWithDatabaseSession(appClient, ownerB, async () => {
      await prisma.division.create({ data: { id: divisionB, orgId: orgB, code: "02", name: "Sitework Division" } });
      await prisma.category.create({ data: { id: categoryB, divisionId: divisionB, code: "02-10", name: "Sitework" } });
      await prisma.subcategory.create({ data: { id: subcategoryB, categoryId: categoryB, code: "02-10-10", name: "Aggregate" } });
    }, "jones-sons-fixture-b");
  });

  afterAll(async () => {
    try {
      await resetFixtures();
    } finally {
      await Promise.all([appClient.$disconnect(), adminClient.$disconnect()]);
    }
  });

  it("ingests the two real, branch-verified Jones & Sons candidates with their true source evidence", async () => {
    const ownerA = { userId: orgAOwner, orgId: orgA, role: "owner" as const };

    const result = await runWithDatabaseSession(
      appClient,
      ownerA,
      () => ingestJonesAndSonsTerreHauteCandidates(ownerA, { retrievedAt: RETRIEVED_AT }),
      "jones-sons-ingest-a"
    );

    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    for (const candidate of result.created) {
      expect(candidate.orgId).toBe(orgA);
      expect(candidate.sourceName).toBe(JONES_AND_SONS_SOURCE_NAME);
      expect(candidate.confidence).toBe("high");
      expect(candidate.provenanceStatus).toBe("documented");
      expect(candidate.reviewStatus).toBe("candidate");
      expect(candidate.sourceUrl).toMatch(/^https:\/\/jonesandsons\.com\/products\//);
      expect(candidate.materialCostTypical).toBeGreaterThan(0);
    }

    const bySku = new Map(result.created.map((c) => [c.sourceIdentifier, c]));
    const first = bySku.get(`Jones & Sons SKU ${TERRE_HAUTE_VERIFIED_RECORDS[0].supplierSku}`);
    const second = bySku.get(`Jones & Sons SKU ${TERRE_HAUTE_VERIFIED_RECORDS[1].supplierSku}`);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.materialCostTypical).toBe(TERRE_HAUTE_VERIFIED_RECORDS[0].price);
    expect(second!.materialCostTypical).toBe(TERRE_HAUTE_VERIFIED_RECORDS[1].price);

    firstCandidateId = first!.id;
    secondCandidateId = second!.id;
  });

  it("is idempotent: re-ingesting for the same organization creates no duplicates", async () => {
    const ownerA = { userId: orgAOwner, orgId: orgA, role: "owner" as const };

    const result = await runWithDatabaseSession(
      appClient,
      ownerA,
      () => ingestJonesAndSonsTerreHauteCandidates(ownerA, { retrievedAt: RETRIEVED_AT }),
      "jones-sons-ingest-a-again"
    );

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    const skippedIds = result.skipped.map((s) => s.existingCandidateId).sort();
    expect(skippedIds).toEqual([firstCandidateId, secondCandidateId].sort());
  });

  it("does not let one organization's ingestion see or skip on account of another organization's candidates", async () => {
    const ownerB = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

    const result = await runWithDatabaseSession(
      appClient,
      ownerB,
      () => ingestJonesAndSonsTerreHauteCandidates(ownerB, { retrievedAt: RETRIEVED_AT }),
      "jones-sons-ingest-b"
    );

    // orgA already has candidates for these exact sourceIdentifiers; orgB
    // must still get its own, proving the idempotency check is org-scoped.
    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    for (const candidate of result.created) {
      expect(candidate.orgId).toBe(orgB);
    }
  });

  it("denies an orgB owner reading an orgA Jones & Sons candidate", async () => {
    const service = new CostbookCandidateService();
    const actorB = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

    await expect(
      runWithDatabaseSession(appClient, actorB, () => service.getById(actorB, firstCandidateId), "jones-sons-cross-tenant-read")
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("reviews and promotes one real candidate into a genuinely priced Material and Cost Item", async () => {
    const service = new CostbookCandidateService();
    const ownerA = { userId: orgAOwner, orgId: orgA, role: "owner" as const };

    const reviewed = await runWithDatabaseSession(
      appClient,
      ownerA,
      () => service.review(ownerA, firstCandidateId, { decision: "approved", reviewNotes: "Confirmed against the live Terre Haute branch product page." }),
      "jones-sons-review"
    );
    expect(reviewed.reviewStatus).toBe("approved");
    expect(reviewed.reviewedByUserId).toBe(orgAOwner);

    const promoted = await runWithDatabaseSession(
      appClient,
      ownerA,
      () => service.promote(ownerA, firstCandidateId),
      "jones-sons-promote"
    );
    expect(promoted.promotedByUserId).toBe(orgAOwner);
    expect(promoted.promotedCostItemId).toBeTruthy();
    promotedCostItemId = promoted.promotedCostItemId!;

    const costItem = await adminClient.costItem.findUnique({ where: { id: promotedCostItemId } });
    expect(costItem).toMatchObject({ orgId: orgA, subcategoryId: subcategoryA, unitOfMeasure: TERRE_HAUTE_VERIFIED_RECORDS[0].normalizedUnit });
    expect(costItem!.materialId).toBeTruthy();
    // A pure material candidate: no labor or equipment component was invented.
    expect(costItem!.laborRateId).toBeNull();
    expect(costItem!.equipmentId).toBeNull();

    const material = await adminClient.material.findUnique({ where: { id: costItem!.materialId! } });
    expect(material).toMatchObject({ orgId: orgA, name: TERRE_HAUTE_VERIFIED_RECORDS[0].normalizedMaterialName });
    expect(Number(material!.unitCost)).toBe(TERRE_HAUTE_VERIFIED_RECORDS[0].price);
  });

  it("carries the true Jones & Sons source citation through the review and promotion audit trail", async () => {
    const events = await adminClient.activityEvent.findMany({
      where: { entityId: firstCandidateId, entityType: "costbook_research_candidate" },
      orderBy: { occurredAt: "asc" },
    });

    expect(events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(["costbook.candidate.approved", "costbook.candidate.promoted"])
    );

    const promotedEvent = events.find((e) => e.eventType === "costbook.candidate.promoted");
    expect(promotedEvent).toBeDefined();
    const metadata = promotedEvent!.metadataJson as Record<string, unknown>;
    expect(metadata.sourceName).toBe(JONES_AND_SONS_SOURCE_NAME);
    expect(metadata.sourceUrl).toBe(TERRE_HAUTE_VERIFIED_RECORDS[0].sourceUrl);
    expect(metadata.sourceIdentifier).toBe(`Jones & Sons SKU ${TERRE_HAUTE_VERIFIED_RECORDS[0].supplierSku}`);
    expect(metadata.confidence).toBe("high");
    expect(metadata.provenanceStatus).toBe("documented");
    expect(metadata.promotedCostItemId).toBe(promotedCostItemId);
  });

  it("leaves the second ingested candidate untouched by the first candidate's review decision", async () => {
    const row = await adminClient.costbookResearchCandidate.findUnique({ where: { id: secondCandidateId } });
    expect(row).toMatchObject({ reviewStatus: "candidate", promotedCostItemId: null, orgId: orgA });
  });

  it("denies an orgB owner promoting an orgA candidate even after it is approved", async () => {
    const service = new CostbookCandidateService();
    const actorB = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

    await expect(
      runWithDatabaseSession(appClient, actorB, () => service.promote(actorB, secondCandidateId), "jones-sons-cross-tenant-promote")
    ).rejects.toMatchObject({ statusCode: 404 });

    const row = await adminClient.costbookResearchCandidate.findUnique({ where: { id: secondCandidateId } });
    expect(row).toMatchObject({ reviewStatus: "candidate", promotedCostItemId: null });
  });
});

async function resetFixtures(): Promise<void> {
  const candidates = await adminClient.costbookResearchCandidate.findMany({
    where: { orgId: { in: [orgA, orgB] } },
  });
  const candidateIds = candidates.map((c) => c.id);
  const promotedCostItemIds = candidates.map((c) => c.promotedCostItemId).filter((id): id is string => Boolean(id));
  const materialIds = await adminClient.costItem
    .findMany({ where: { id: { in: promotedCostItemIds } }, select: { materialId: true } })
    .then((rows) => rows.map((r) => r.materialId).filter((id): id is string => Boolean(id)));

  if (candidateIds.length > 0) {
    await adminClient.activityEvent.deleteMany({ where: { entityId: { in: candidateIds } } });
    await adminClient.costbookResearchCandidate.deleteMany({ where: { id: { in: candidateIds } } });
  }
  if (promotedCostItemIds.length > 0) {
    await adminClient.costItem.deleteMany({ where: { id: { in: promotedCostItemIds } } });
  }
  if (materialIds.length > 0) {
    await adminClient.material.deleteMany({ where: { id: { in: materialIds } } });
  }
  await adminClient.subcategory.deleteMany({ where: { id: { in: [subcategoryA, subcategoryB] } } });
  await adminClient.category.deleteMany({ where: { id: { in: [categoryA, categoryB] } } });
  await adminClient.division.deleteMany({ where: { id: { in: [divisionA, divisionB] } } });
  await adminClient.organizationMembership.deleteMany({ where: { id: { in: [orgAMembership, orgBMembership] } } });
  await adminClient.appUser.deleteMany({ where: { id: { in: [orgAOwner, orgBOwner] } } });
  await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Jones & Sons candidate ingestion RLS integration tests`);
  return value;
}
