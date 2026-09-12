import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
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
// The first eight characters of a candidate id must differ between any two
// candidates promoted in the same organization: promote() derives the Cost
// Item code as `RC-${id.slice(0, 8).toUpperCase()}`, and CostItem carries a
// unique (orgId, code) constraint. Keep the leading "41" org-A marker, but
// vary the rest of the first block.
const candidateB = "41000002-0000-0000-0000-000000000091";
const candidateRejected = "41000003-0000-0000-0000-000000000101";

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
    const ownerA = { userId: orgAOwner, orgId: orgA, role: "owner" as const };
    await runWithDatabaseSession(appClient, ownerA, async () => {
      await prisma.division.create({ data: { id: divisionA, orgId: orgA, code: "07", name: "Roofing Division" } });
      await prisma.category.create({ data: { id: categoryA, divisionId: divisionA, code: "07-10", name: "Roofing" } });
      await prisma.subcategory.create({ data: { id: subcategoryA, categoryId: categoryA, code: "07-10-10", name: "Roofing" } });
    }, "candidate-rls-fixture");
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
    // A second orgA candidate, pre-approved, used to prove that promoting the
    // same candidate twice cannot create two Cost Items.
    await adminClient.costbookResearchCandidate.create({
      data: {
        id: candidateB,
        orgId: orgA,
        trade: "Roofing",
        category: "Roofing",
        itemName: "Ridge Vent Installation",
        unitOfMeasure: "LF",
        materialCostTypical: 12,
        sourceName: "Manufacturer published price sheet",
        sourceUrl: "https://example.com/pricing/ridge-vent",
        sourceDate: "2026-08-01",
        retrievedAt: new Date("2026-09-08T00:00:00.000Z"),
        regionalBasis: "US national average",
        confidence: "medium",
        reviewStatus: "approved",
        reviewedByUserId: orgAOwner,
        reviewedAt: new Date("2026-09-09T00:00:00.000Z"),
        createdByUserId: orgAOwner,
      },
    });
    await adminClient.costbookResearchCandidate.create({
      data: {
        id: candidateRejected,
        orgId: orgA,
        trade: "Roofing",
        category: "Roofing",
        itemName: "Unsupported Flashing Price",
        unitOfMeasure: "LF",
        materialCostTypical: 30,
        sourceName: "Unverified forum post",
        sourceIdentifier: "forum-thread-12",
        sourceDate: "2026-08-01",
        retrievedAt: new Date("2026-09-08T00:00:00.000Z"),
        regionalBasis: "US national average",
        confidence: "low",
        reviewStatus: "rejected",
        reviewedByUserId: orgAOwner,
        reviewedAt: new Date("2026-09-09T00:00:00.000Z"),
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

  it("records org-scoped review and promotion audit events invisible to another tenant", async () => {
    const events = await adminClient.activityEvent.findMany({
      where: { entityId: candidateA, entityType: "costbook_research_candidate" },
      orderBy: { occurredAt: "asc" },
    });

    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["costbook.candidate.approved", "costbook.candidate.promoted"])
    );
    for (const event of events) {
      expect(event.orgId).toBe(orgA);
      expect(event.actorUserId).toBe(orgAOwner);
    }

    // The other tenant cannot see that this decision happened at all.
    const actor = { userId: orgBOwner, orgId: orgB, role: "owner" as const };
    const visible = await runWithDatabaseSession(
      appClient,
      actor,
      () => prisma.activityEvent.findMany({ where: { entityId: candidateA } }),
      "candidate-rls-cross-tenant-audit"
    );
    expect(visible).toEqual([]);
  });

  it("denies an orgB owner a match preview of an orgA candidate", async () => {
    const service = new CostbookCandidateService();
    const actor = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

    await expect(
      runWithDatabaseSession(
        appClient,
        actor,
        () => service.matchPreview(actor, candidateA),
        "candidate-rls-cross-tenant-match"
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("keeps another tenant's candidates out of the review queue summary", async () => {
    const service = new CostbookCandidateService();
    const actor = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

    const summary = await runWithDatabaseSession(
      appClient,
      actor,
      () => service.summary(actor),
      "candidate-rls-cross-tenant-summary"
    );

    expect(summary.total).toBe(0);
    expect(summary.pendingReview).toBe(0);
    expect(summary.approved).toBe(0);
    expect(summary.promoted).toBe(0);
  });

  it("cannot promote the same candidate twice, even across separate requests", async () => {
    const service = new CostbookCandidateService();
    const actor = { userId: orgAOwner, orgId: orgA, role: "owner" as const };

    const promoted = await runWithDatabaseSession(
      appClient,
      actor,
      () => service.promote(actor, candidateB),
      "candidate-rls-promote-once"
    );
    expect(promoted.promotedCostItemId).toBeTruthy();

    await expect(
      runWithDatabaseSession(
        appClient,
        actor,
        () => service.promote(actor, candidateB),
        "candidate-rls-promote-twice"
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    // Exactly one Cost Item exists for this candidate, and exactly one
    // promotion event was recorded.
    const costItems = await adminClient.costItem.findMany({
      where: { orgId: orgA, name: "Ridge Vent Installation" },
    });
    expect(costItems).toHaveLength(1);

    const promotionEvents = await adminClient.activityEvent.findMany({
      where: { entityId: candidateB, eventType: "costbook.candidate.promoted" },
    });
    expect(promotionEvents).toHaveLength(1);
  });

  it("keeps a rejection durable: a rejected candidate can never be re-reviewed or promoted", async () => {
    const service = new CostbookCandidateService();
    const actor = { userId: orgAOwner, orgId: orgA, role: "owner" as const };

    await expect(
      runWithDatabaseSession(
        appClient,
        actor,
        () => service.review(actor, candidateRejected, { decision: "approved" }),
        "candidate-rls-rereview-rejected"
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      runWithDatabaseSession(
        appClient,
        actor,
        () => service.promote(actor, candidateRejected),
        "candidate-rls-promote-rejected"
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    const row = await adminClient.costbookResearchCandidate.findUnique({ where: { id: candidateRejected } });
    expect(row).toMatchObject({ reviewStatus: "rejected", promotedCostItemId: null });
  });
});

async function resetFixtures(): Promise<void> {
  const candidateIds = [candidateA, candidateB, candidateRejected];
  const candidates = await adminClient.costbookResearchCandidate.findMany({ where: { id: { in: candidateIds } } });
  const promotedCostItemIds = candidates
    .map((candidate) => candidate.promotedCostItemId)
    .filter((id): id is string => Boolean(id));
  await adminClient.activityEvent.deleteMany({ where: { entityId: { in: candidateIds } } });
  await adminClient.costbookResearchCandidate.deleteMany({ where: { id: { in: candidateIds } } });
  if (promotedCostItemIds.length > 0) {
    await adminClient.costItem.deleteMany({ where: { id: { in: promotedCostItemIds } } });
  }
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
