import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../backend/auth/context";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { EstimateEngineService } from "../modules/estimate-engine/service";
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

  // Synthetic persisted inputs, not the unavailable historical incident payloads.
  it.each([
    { quantity: 3, unitCost: 0.7, amount: "2.10" },
    { quantity: 8, unitCost: 5335, amount: "42680.00" },
    { quantity: 1, unitCost: 7125.37, amount: "7125.37" },
  ])(
    "retains the exact finalized estimate amount $amount across persisted proposal reload and replay",
    async ({ quantity, unitCost, amount }) => {
      const fixtureKey = randomUUID();
      const estimateService = new EstimateEngineService();
      const draft = await runWithDatabaseSession(appClient, auth, () =>
        estimateService.create({ orgId, projectId, overheadPct: 0 })
      );
      const fixtureEstimateId = draft.id;
      const line = await runWithDatabaseSession(appClient, auth, () =>
        estimateService.addLineItem({
          orgId, estimateId: fixtureEstimateId, description: "Synthetic continuity input",
          quantity, unitOfMeasure: "ea", unitCost,
        })
      );
      expect(line.lineCost).toBe(Number(amount));
      const finalized = await runWithDatabaseSession(appClient, auth, () =>
        estimateService.finalize(fixtureEstimateId, orgId)
      );
      expect(finalized.status).toBe("ready");
      expect(finalized.totalPrice).toBe(Number(amount));
      const reloadedEstimate = await runWithDatabaseSession(appClient, auth, () =>
        prisma.estimate.findFirstOrThrow({ where: { id: fixtureEstimateId, orgId } })
      );
      expect(reloadedEstimate.totalPrice.toFixed(2)).toBe(amount);
      const service = new ProposalsService();
      const input = { orgId, estimateId: fixtureEstimateId };
      const created = await runWithDatabaseSession(appClient, auth, () =>
        service.createWithIdempotency(input, fixtureKey)
      );
      const readProposal = () => runWithDatabaseSession(appClient, auth, () =>
        prisma.proposal.findFirstOrThrow({ where: { id: created.proposal.id, project: { orgId } } })
      );
      const saved = await readProposal();
      expect(saved.estimateId).toBe(fixtureEstimateId);
      expect(saved.projectId).toBe(projectId);
      expect(saved.finalPrice?.toFixed(2)).toBe(amount);
      expect(saved.priceLow).toBeNull();
      expect(saved.priceHigh).toBeNull();

      // A later estimate recalculation is not authority to rewrite a saved
      // proposal. Replaying its original request must keep that snapshot.
      await adminClient.estimate.update({
        where: { id: fixtureEstimateId }, data: { totalPrice: "99999.99" },
      });
      const replay = await runWithDatabaseSession(appClient, auth, () =>
        service.createWithIdempotency(input, fixtureKey)
      );
      expect(replay.replayed).toBe(true);
      expect(replay.proposal.id).toBe(saved.id);
      expect((await readProposal()).finalPrice?.toFixed(2)).toBe(amount);
    }
  );

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
      prisma.proposal.findMany({ where: { projectId, idempotencyKey: requestKey, project: { orgId } } })
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0].idempotencyKey).toBe(requestKey);
    expect(proposals[0].idempotencyHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
