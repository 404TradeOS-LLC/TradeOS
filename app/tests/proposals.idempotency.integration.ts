import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../backend/auth/context";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { ProposalsService } from "../modules/proposals/service";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for proposal idempotency integration tests`);
  return value;
}

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgId = randomUUID();
const userId = randomUUID();
const customerId = randomUUID();
const projectId = randomUUID();
const estimateId = randomUUID();
const requestKey = randomUUID();
const auth: AuthContext = { userId, orgId, role: "admin", canonicalRole: "admin" };

describe("proposal create idempotency in a request-scoped PostgreSQL transaction", () => {
  beforeAll(async () => {
    await adminClient.organization.create({ data: { id: orgId, name: "Idempotency Integration Org" } });
    await adminClient.appUser.create({
      data: {
        id: userId,
        authSubject: `proposal-idempotency-${userId}`,
        email: `proposal-idempotency-${userId}@example.com`,
      },
    });
    await adminClient.organizationMembership.create({
      data: { orgId, userId, role: "admin", status: "active" },
    });
    await adminClient.customer.create({ data: { id: customerId, orgId, name: "Idempotency Integration Customer" } });
    await adminClient.project.create({
      data: { id: projectId, orgId, customerId, name: "Concurrent Proposal Draft", status: "lead" },
    });
    await adminClient.estimate.create({
      data: { id: estimateId, orgId, projectId, status: "ready", totalPrice: 1250 },
    });
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: orgId } });
    await adminClient.appUser.deleteMany({ where: { id: userId } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("returns one persisted proposal to concurrent identical create attempts", async () => {
    const service = new ProposalsService();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        runWithDatabaseSession(appClient, auth, () =>
          service.createWithIdempotency(
            { orgId, estimateId },
            requestKey
          )
        )
      )
    );

    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(3);
    expect(new Set(results.map((result) => result.proposal.id)).size).toBe(1);

    const proposals = await runWithDatabaseSession(appClient, auth, () =>
      prisma.proposal.findMany({ where: { projectId, project: { orgId } } })
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0].idempotencyKey).toBe(requestKey);
    expect(proposals[0].idempotencyHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
