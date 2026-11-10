import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { listCodeReferencesFromDb } from "../modules/costbook/codes/service";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

// Fixed 9460-prefixed fixtures: no other integration file uses this prefix.
const orgA = "94600000-0000-4000-8000-000000000001";
const orgB = "94600000-0000-4000-8000-000000000002";
const orgAOwner = "94600000-0000-4000-8000-000000000011";
const orgBOwner = "94600000-0000-4000-8000-000000000021";
const orgAMembership = "94600000-0000-4000-8000-000000000031";
const orgBMembership = "94600000-0000-4000-8000-000000000041";
const marionAuthority = "94600009-0000-4000-8000-000000000001";
const marionJurisdiction = "94600009-0000-4000-8000-000000000002";
const marionSource = "94600009-0000-4000-8000-000000000003";
const seedHistory = "94600009-0000-4000-8000-000000000004";
const seedSignsSource = "94600003-0000-4000-8000-000000000001";

describe("Codes & Permits registry RLS", () => {
  beforeAll(async () => {
    await resetFixtures();
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Codes Registry RLS Org A" },
        { id: orgB, name: "Codes Registry RLS Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: orgAOwner, authSubject: "codes-rls-org-a", email: "codes-rls-a@example.com" },
        { id: orgBOwner, authSubject: "codes-rls-org-b", email: "codes-rls-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: orgAMembership, orgId: orgA, userId: orgAOwner, role: "owner", status: "active" },
        { id: orgBMembership, orgId: orgB, userId: orgBOwner, role: "owner", status: "active" },
      ],
    });
    // A non-seed county fixture: proves county isolation is about the
    // jurisdiction, not the tenant.
    await adminClient.codesAuthority.create({
      data: { id: marionAuthority, name: "Marion County Area Planning", authorityKind: "county", state: "IN", county: "Marion" },
    });
    await adminClient.codesJurisdiction.create({
      data: { id: marionJurisdiction, authorityId: marionAuthority, name: "Marion County", jurisdictionKind: "county", state: "IN", county: "Marion" },
    });
    await adminClient.codesSource.create({
      data: {
        id: marionSource,
        jurisdictionId: marionJurisdiction,
        authorityId: marionAuthority,
        codeFamily: "UZO",
        section: "§1",
        citation: "Marion County UZO §1",
        title: "Marion County Unified Zoning Ordinance",
        sourceUrl: "https://example.com/marion-uzo",
        publishedDate: new Date("2020-01-01T00:00:00.000Z"),
        status: "reviewed",
        reviewedAt: new Date("2026-11-08T00:00:00.000Z"),
        topics: ["permits"],
        summary: "Marion County fixture ordinance.",
        nextAction: "Confirm with Marion County Area Planning.",
      },
    });
    await adminClient.codesSourceHistory.create({
      data: { id: seedHistory, sourceId: seedSignsSource, versionLabel: "seed", status: "reviewed", changeSummary: "Seeded from the #945 pilot registry." },
    });
  });

  afterAll(async () => {
    try {
      await resetFixtures();
    } finally {
      await Promise.all([appClient.$disconnect(), adminClient.$disconnect()]);
    }
  });

  it("serves the six reviewed seed rows with pilot provenance and no guessed dates", async () => {
    const seeds = await adminClient.codesSource.findMany({
      where: { id: { startsWith: "94600003-" } },
      orderBy: { id: "asc" },
    });
    expect(seeds).toHaveLength(6);
    expect(seeds.map((row) => row.citation)).toEqual([
      "Vigo County UZO §16",
      "Vigo County UZO §5",
      "675 IAC 13-2.6",
      "675 IAC 17-1.8",
      "INDOT — Outdoor Advertising Sign Permits",
      "INDOT — Above Ground Occupancy",
    ]);
    for (const row of seeds) {
      expect(row.status).toBe("reviewed");
      expect(row.reviewedAt?.toISOString().slice(0, 10)).toBe("2026-11-08");
      expect(row.sourceHash).toBeNull();
      // No effective date is guessed for any seed row.
      expect(row.effectiveDate).toBeNull();
    }
    expect(seeds.map((row) => row.publishedDate?.toISOString().slice(0, 10) ?? null)).toEqual([
      "1996-10-21",
      "1996-10-21",
      "2014-12-01",
      "2009-08-26",
      null,
      null,
    ]);
  });

  it("returns the same global reference rows to every tenant, with county isolation", async () => {
    const actorA = { userId: orgAOwner, orgId: orgA, role: "owner" as const };
    const actorB = { userId: orgBOwner, orgId: orgB, role: "owner" as const };

    const allA = await runWithDatabaseSession(appClient, actorA, () => listCodeReferencesFromDb({ state: "IN" }), "codes-rls-org-a-all");
    const allB = await runWithDatabaseSession(appClient, actorB, () => listCodeReferencesFromDb({ state: "IN" }), "codes-rls-org-b-all");
    // Six seed rows plus the Marion fixture; identical for both tenants
    // because these tables carry no tenant data at all.
    expect(allA.total).toBe(7);
    expect(allB.total).toBe(7);
    expect(allA.items.map((item) => item.id).sort()).toEqual(allB.items.map((item) => item.id).sort());

    const vigoSignage = await runWithDatabaseSession(
      appClient, actorA, () => listCodeReferencesFromDb({ state: "IN", county: "Vigo", topic: "signage" }), "codes-rls-vigo-signage",
    );
    expect(vigoSignage.items.map((item) => item.citation).sort()).toEqual([
      "INDOT — Outdoor Advertising Sign Permits",
      "Vigo County UZO §16",
      "Vigo County UZO §5",
    ]);
    expect(vigoSignage.items.some((item) => item.citation === "Marion County UZO §1")).toBe(false);

    const marion = await runWithDatabaseSession(
      appClient, actorA, () => listCodeReferencesFromDb({ state: "IN", county: "Marion" }), "codes-rls-marion",
    );
    expect(marion.items.some((item) => item.citation === "Marion County UZO §1")).toBe(true);
    expect(marion.items.some((item) => item.county === "Vigo")).toBe(false);
  });

  it("returns no rows without an authenticated session", async () => {
    const rows = await appClient.codesSource.findMany();
    expect(rows).toEqual([]);
    const authorities = await appClient.codesAuthority.findMany();
    expect(authorities).toEqual([]);
  });

  it("refuses tenant writes to every codes_* table", async () => {
    const actor = { userId: orgAOwner, orgId: orgA, role: "owner" as const };
    await expect(
      runWithDatabaseSession(appClient, actor, () => prisma.codesAuthority.create({
        data: { name: "Tenant Authority", authorityKind: "county", state: "IN", county: "Vigo" },
      }), "codes-rls-refuse-authority-insert"),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      runWithDatabaseSession(appClient, actor, () => prisma.codesSource.update({
        where: { id: seedSignsSource },
        data: { status: "superseded" },
      }), "codes-rls-refuse-source-update"),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      runWithDatabaseSession(appClient, actor, () => prisma.codesSource.delete({ where: { id: seedSignsSource } }), "codes-rls-refuse-source-delete"),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      runWithDatabaseSession(appClient, actor, () => prisma.codesSourceHistory.create({
        data: { sourceId: seedSignsSource, versionLabel: "tenant", status: "reviewed" },
      }), "codes-rls-refuse-history-insert"),
    ).rejects.toThrow(/row-level security/i);

    const source = await adminClient.codesSource.findUnique({ where: { id: seedSignsSource } });
    expect(source?.status).toBe("reviewed");
  });

  it("keeps source history append-only: no update or delete for any tenant role", async () => {
    const actor = { userId: orgAOwner, orgId: orgA, role: "owner" as const };
    await expect(
      runWithDatabaseSession(appClient, actor, () => prisma.codesSourceHistory.update({
        where: { id: seedHistory },
        data: { changeSummary: "rewritten" },
      }), "codes-rls-refuse-history-update"),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      runWithDatabaseSession(appClient, actor, () => prisma.codesSourceHistory.delete({ where: { id: seedHistory } }), "codes-rls-refuse-history-delete"),
    ).rejects.toThrow(/row-level security/i);
    const history = await adminClient.codesSourceHistory.findUnique({ where: { id: seedHistory } });
    expect(history?.changeSummary).toBe("Seeded from the #945 pilot registry.");
  });

  it("proves no duplication: codes_* tables hold no pricing, CostItem, estimate or tenant data", async () => {
    const columns = await adminClient.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name LIKE 'codes\_%'
    `;
    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) {
      expect(column.column_name).not.toMatch(/price|cost_item|estimate|invoice|payment|amount|org_id/);
    }
    const actor = { userId: orgAOwner, orgId: orgA, role: "owner" as const };
    const result = await runWithDatabaseSession(
      appClient, actor, () => listCodeReferencesFromDb({ state: "IN", county: "Vigo" }), "codes-rls-no-duplication",
    );
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual([
        "applicability", "citation", "county", "id", "issuer", "nextAction",
        "reviewedAt", "sourceDate", "sourceUrl", "state", "summary", "title", "topics",
      ]);
    }
  });
});

async function resetFixtures(): Promise<void> {
  await adminClient.codesSourceHistory.deleteMany({ where: { id: seedHistory } });
  await adminClient.codesSource.deleteMany({ where: { id: marionSource } });
  await adminClient.codesJurisdiction.deleteMany({ where: { id: marionJurisdiction } });
  await adminClient.codesAuthority.deleteMany({ where: { id: marionAuthority } });
  await adminClient.organizationMembership.deleteMany({ where: { id: { in: [orgAMembership, orgBMembership] } } });
  await adminClient.appUser.deleteMany({ where: { id: { in: [orgAOwner, orgBOwner] } } });
  await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Codes registry RLS integration tests`);
  return value;
}
