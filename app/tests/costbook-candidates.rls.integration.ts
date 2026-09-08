import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { CostbookCandidateService } from "../modules/costbook/candidateCostItemService";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "41000000-0000-0000-0000-000000000001";
const orgB = "42000000-0000-0000-0000-000000000002";
const orgAOwner = "41000000-0000-0000-0000-000000000011";
const orgBOwner = "42000000-0000-0000-0000-000000000021";
const orgAMembership = "41000000-0000-0000-0000-000000000031";
const orgBMembership = "42000000-0000-0000-0000-000000000041";
const candidateA = "41000000-0000-0000-0000-000000000051";
const divisionA = "41000000-0000-0000-0000-000000000061";
const categoryA = "41000000-0000-0000-0000-000000000071";
const subcategoryA = "41000000-0000-0000-0000-000000000081";

describe("Costbook research candidate RLS", () => {
  beforeAll(async () => {
    await resetFixtures();
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Candidate RLS Org A" },
        { id: orgB, name: "Candidate RLS Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: orgAOwner, authSubject: "candidate-rls-org-a", email: "candidate-rls-a@example.com" },
        { id: orgBOwner, authSubject: "candidate-rls-org-b", email: "candidate-rls-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: orgAMembership, orgId: orgA, userId: orgAOwner, role: "owner", status: "active" },
        { id: orgBMembership, orgId: orgB, userId: orgBOwner, role: "owner", status: "active" },
      ],
    });
    await adminClient.division.create({ data: { id: divisionA, orgId: orgA, code: "07", name: "Roofing Division" } });
    await adminClient.category.create({ data: { id: categoryA, divisionId: divisionA, code: "07-10", name: "Roofing" } });
    await adminClient.subcategory.create({ data: { id: subcategoryA, categoryId: categoryA, code: "07-10-10", name: "Roofing" } });
    await adminClient.costbookResearchCandidate.create({
      data: {
        id: candidateA,
        orgId: orgA,
        trade: "Roofing",
        category: "Roofing",
        itemName: "30-Year Architectural Shingle Installation",
        unitOfMeasure: "SQ",
        materialCostTypical: 95,
        sourceName: "Manufacturer published price sheet",
        sourceUrl: "https://example.com/pricing/asphalt-shingles",
        sourceDate: "2026-08-01",
        retrievedAt: new Date("2026-09-08T00:00:00.000Z"),
        regionalBasis: "US national average",
        confidence: "medium",
        createdByUserId: orgAOwner,
      },
    });
  });

  afterAll(async () => {
    try {
      await resetFixtures();
    } finally {
      await Promise.all([appClient.$disconnect(), adminClient.$disconnect()]);
    }
  });

  it("denies an orgB owner reading an orgA research candidate", async () => {
    const service = new CostbookCandidateService();
    const actor = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

    await expect(
      runWithDatabaseSession(appClient, actor, () => service.getById(actor, candidateA), "candidate-rls-cross-tenant-read")
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(["review", "promote"] as const)(
    "denies an orgB owner attempting to %s an orgA research candidate without mutating it",
    async (operation) => {
      const service = new CostbookCandidateService();
      const actor = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

      await expect(
        runWithDatabaseSession(
          appClient,
          actor,
          () =>
            operation === "review"
              ? service.review(actor, candidateA, { decision: "approved" })
              : service.promote(actor, candidateA),
          `candidate-rls-cross-tenant-${operation}`
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      const candidate = await adminClient.costbookResearchCandidate.findUnique({ where: { id: candidateA } });
      expect(candidate).toMatchObject({
        orgId: orgA,
        reviewStatus: "candidate",
        reviewedByUserId: null,
        reviewedAt: null,
        promotedCostItemId: null,
      });
    }
  );

  it("allows the owning organization's owner to review and promote its own candidate", async () => {
    const service = new CostbookCandidateService();
    const actor = { userId: orgAOwner, orgId: orgA, role: "owner" as const };

    const reviewed = await runWithDatabaseSession(
      appClient,
      actor,
      () => service.review(actor, candidateA, { decision: "approved" }),
      "candidate-rls-own-org-review"
    );
    expect(reviewed.reviewStatus).toBe("approved");
    expect(reviewed.reviewedByUserId).toBe(orgAOwner);

    const promoted = await runWithDatabaseSession(
      appClient,
      actor,
      () => service.promote(actor, candidateA),
      "candidate-rls-own-org-promote"
    );
    expect(promoted.promotedByUserId).toBe(orgAOwner);
    expect(promoted.promotedCostItemId).toBeTruthy();

    const costItem = await adminClient.costItem.findUnique({ where: { id: promoted.promotedCostItemId! } });
    expect(costItem).toMatchObject({ orgId: orgA, subcategoryId: subcategoryA });
  });
});

async function resetFixtures(): Promise<void> {
  const candidate = await adminClient.costbookResearchCandidate.findUnique({ where: { id: candidateA } });
  if (candidate?.promotedCostItemId) {
    await adminClient.costItem.deleteMany({ where: { id: candidate.promotedCostItemId } });
  }
  await adminClient.costbookResearchCandidate.deleteMany({ where: { id: candidateA } });
  await adminClient.subcategory.deleteMany({ where: { id: subcategoryA } });
  await adminClient.category.deleteMany({ where: { id: categoryA } });
  await adminClient.division.deleteMany({ where: { id: divisionA } });
  await adminClient.organizationMembership.deleteMany({ where: { id: { in: [orgAMembership, orgBMembership] } } });
  await adminClient.appUser.deleteMany({ where: { id: { in: [orgAOwner, orgBOwner] } } });
  await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Costbook candidate RLS integration tests`);
  return value;
}
