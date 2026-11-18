import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getRequestDatabaseClient, runWithPortalDatabaseSession } from "../db/requestSession";

const app = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_URL") } } });
const admin = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_ADMIN_URL") } } });
const orgA = randomUUID();
const orgB = randomUUID();
const customerA = randomUUID();
const customerSiblingA = randomUUID();
const customerB = randomUUID();
const tokenA = randomUUID();
const tokenB = randomUUID();
const sessionA = randomUUID();
const sessionSiblingA = randomUUID();
const sessionB = randomUUID();
const tokenHashA = `portal-token-${randomUUID()}`;
const tokenHashB = `portal-token-${randomUUID()}`;
const sessionHashA = `portal-session-${randomUUID()}`;
const sessionHashSiblingA = `portal-session-${randomUUID()}`;
const sessionHashB = `portal-session-${randomUUID()}`;
const expiresAt = new Date("2099-01-01T00:00:00.000Z");

describe("customer portal request-scoped session hash RLS", () => {
  beforeAll(async () => {
    await admin.organization.createMany({ data: [{ id: orgA, name: "Portal RLS A" }, { id: orgB, name: "Portal RLS B" }] });
    await admin.customer.createMany({ data: [
      { id: customerA, orgId: orgA, name: "Portal RLS Customer A" },
      { id: customerSiblingA, orgId: orgA, name: "Portal RLS Customer A sibling" },
      { id: customerB, orgId: orgB, name: "Portal RLS Customer B" },
    ] });
    await admin.customerPortalAccessToken.createMany({ data: [
      { id: tokenA, orgId: orgA, customerId: customerA, tokenHash: tokenHashA, expiresAt },
      { id: tokenB, orgId: orgB, customerId: customerB, tokenHash: tokenHashB, expiresAt },
    ] });
    await admin.customerPortalSession.createMany({ data: [
      { id: sessionA, orgId: orgA, customerId: customerA, accessTokenId: tokenA, sessionHash: sessionHashA, expiresAt },
      { id: sessionSiblingA, orgId: orgA, customerId: customerSiblingA, accessTokenId: tokenA, sessionHash: sessionHashSiblingA, expiresAt },
      { id: sessionB, orgId: orgB, customerId: customerB, accessTokenId: tokenB, sessionHash: sessionHashB, expiresAt },
    ] });
  });

  afterAll(async () => {
    await admin.customerPortalSession.deleteMany({ where: { id: { in: [sessionA, sessionSiblingA, sessionB] } } });
    await admin.customerPortalAccessToken.deleteMany({ where: { id: { in: [tokenA, tokenB] } } });
    await admin.customer.deleteMany({ where: { id: { in: [customerA, customerSiblingA, customerB] } } });
    await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await app.$disconnect();
    await admin.$disconnect();
  });

  it("allows the exact validated session and excludes other customers and organizations", async () => {
    const visible = await runWithPortalDatabaseSession(
      app,
      { sessionId: sessionA, accessTokenId: tokenA, orgId: orgA, customerId: customerA },
      async () => getRequestDatabaseClient()!.customerPortalSession.findMany({ where: { id: { in: [sessionA, sessionSiblingA, sessionB] } } }),
      "integration-test",
      sessionHashA,
    );
    expect(visible.map((row) => row.id)).toEqual([sessionA]);
  });

  it("fails closed when no validated session hash is supplied", async () => {
    const visible = await runWithPortalDatabaseSession(
      app,
      { sessionId: sessionA, accessTokenId: tokenA, orgId: orgA, customerId: customerA },
      async () => getRequestDatabaseClient()!.customerPortalSession.findMany({ where: { id: { in: [sessionA, sessionSiblingA, sessionB] } } }),
      "integration-test",
    );
    expect(visible).toEqual([]);
  });
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for portal session context integration evidence`);
  return value;
}
