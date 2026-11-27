// Live proof for the Athena daily spend cap's org-wide read (Codex P1 on
// PR #1144): the generation-runs SELECT policy is actor-scoped, so a plain
// findMany would give every non-admin actor a separate budget. Spend is
// therefore read through public.athena_org_daily_spend_usd, a read-only
// STABLE SECURITY DEFINER function that sums the caller's session org.
// These tests run against a real Postgres (no mocks) and prove, as each
// role, that the sum is org-wide, windowed to the UTC day, counts failed
// rows with chargeable usage, and refuses a foreign org.

import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { getDailySpendStatus } from "../modules/athena-kernel/spendCap";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Athena spend-cap integration tests`);
  return value;
}

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

// Distinct fixture prefix (no other integration file uses e0000000/e1000000).
const orgA = "e0000000-0000-0000-0000-000000000001";
const orgB = "e1000000-0000-0000-0000-000000000002";
const ownerA = "e0000000-0000-0000-0000-000000000011";
const technicianA = "e0000000-0000-0000-0000-000000000012";
const ownerB = "e1000000-0000-0000-0000-000000000021";

const now = new Date();
const yesterday = new Date(now.getTime() - 36 * 60 * 60 * 1000);

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "integration-test");
}

async function seedGenerationRun(data: {
  id: string;
  orgId: string;
  actorUserId: string;
  status: string;
  estimatedUsd?: number | null;
  createdAt: Date;
}): Promise<void> {
  await adminClient.athenaGenerationRun.create({
    data: {
      id: data.id,
      orgId: data.orgId,
      actorUserId: data.actorUserId,
      requestId: `req-${data.id}`,
      traceId: `trace-${data.id}`,
      provider: "google",
      model: "gemini-3.5-flash-lite",
      status: data.status,
      failureCode: data.status === "failed" ? "athena_provider_empty_response" : undefined,
      inputTokens: 1000,
      outputTokens: 50,
      estimatedUsd: data.estimatedUsd ?? undefined,
      latencyMs: 100,
      retentionExpiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      createdAt: data.createdAt,
      completedAt: data.createdAt,
    },
  });
}

describe("Athena daily spend cap — org-wide ledger (live Postgres)", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Spend Cap Org A" },
        { id: orgB, name: "Spend Cap Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "spend-cap-owner-a", email: "spend-cap-owner-a@example.com" },
        { id: technicianA, authSubject: "spend-cap-technician-a", email: "spend-cap-technician-a@example.com" },
        { id: ownerB, authSubject: "spend-cap-owner-b", email: "spend-cap-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: "e0000000-0000-0000-0000-000000000031", orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { id: "e0000000-0000-0000-0000-000000000032", orgId: orgA, userId: technicianA, role: "technician", status: "active" },
        { id: "e1000000-0000-0000-0000-000000000041", orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });
    // Org A today: owner $0.60 succeeded + technician $0.50 succeeded +
    // technician $0.10 failed-with-usage = $1.20. Yesterday's $5.00 and the
    // null-cost row must not count. Org B today: $2.00 (must never leak
    // into org A's sum).
    await seedGenerationRun({ id: "e0000000-0000-0000-0000-000000000101", orgId: orgA, actorUserId: ownerA, status: "succeeded", estimatedUsd: 0.6, createdAt: now });
    await seedGenerationRun({ id: "e0000000-0000-0000-0000-000000000102", orgId: orgA, actorUserId: technicianA, status: "succeeded", estimatedUsd: 0.5, createdAt: now });
    await seedGenerationRun({ id: "e0000000-0000-0000-0000-000000000103", orgId: orgA, actorUserId: technicianA, status: "failed", estimatedUsd: 0.1, createdAt: now });
    await seedGenerationRun({ id: "e0000000-0000-0000-0000-000000000104", orgId: orgA, actorUserId: ownerA, status: "succeeded", estimatedUsd: 5, createdAt: yesterday });
    await seedGenerationRun({ id: "e0000000-0000-0000-0000-000000000105", orgId: orgA, actorUserId: ownerA, status: "succeeded", estimatedUsd: null, createdAt: now });
    await seedGenerationRun({ id: "e1000000-0000-0000-0000-000000000101", orgId: orgB, actorUserId: ownerB, status: "succeeded", estimatedUsd: 2, createdAt: now });
  });

  afterAll(async () => {
    await Promise.all([appClient.$disconnect(), adminClient.$disconnect()]);
  });

  it("returns the org-wide total to a technician, not just their own rows", async () => {
    const status = await inSession(technicianA, orgA, "technician", () => getDailySpendStatus({ orgId: orgA, capUsd: 1, now }));

    // A plain actor-scoped read would see only the technician's $0.60.
    expect(status.spentUsd).toBeCloseTo(1.2);
    expect(status.reached).toBe(true);
  });

  it("returns the same org-wide total to the owner (breaker and alert agree)", async () => {
    const status = await inSession(ownerA, orgA, "owner", () => getDailySpendStatus({ orgId: orgA, capUsd: 1, now }));

    expect(status.spentUsd).toBeCloseTo(1.2);
    expect(status.reached).toBe(true);
  });

  it("reports not reached when the cap exceeds the org-wide total", async () => {
    const status = await inSession(technicianA, orgA, "technician", () => getDailySpendStatus({ orgId: orgA, capUsd: 2, now }));

    expect(status.spentUsd).toBeCloseTo(1.2);
    expect(status.reached).toBe(false);
  });

  it("keeps orgs isolated: a foreign org sees only its own spend", async () => {
    const status = await inSession(ownerB, orgB, "owner", () => getDailySpendStatus({ orgId: orgB, capUsd: 1, now }));

    expect(status.spentUsd).toBeCloseTo(2);
    expect(status.reached).toBe(true);
  });

  it("refuses a cross-org lookup instead of returning another org's spend", async () => {
    await expect(
      inSession(technicianA, orgA, "technician", () => getDailySpendStatus({ orgId: orgB, capUsd: 1, now }))
    ).rejects.toThrow(/42501/);
  });
});
