import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { getRequestDatabaseClient, runWithDatabaseSession, runWithPortalDatabaseSession } from "../db/requestSession";

const app = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_URL") } } });
const admin = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_ADMIN_URL") } } });
const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const membershipA = randomUUID();
const membershipB = randomUUID();
const customerA = randomUUID();
const customerB = randomUUID();
const projectA = randomUUID();
const projectB = randomUUID();
const estimateA = randomUUID();
const estimateB = randomUUID();
const estimateLineA = randomUUID();
const estimateLineB = randomUUID();
const invoiceA = randomUUID();
const invoiceB = randomUUID();
const invoiceLineA = randomUUID();
const invoiceLineB = randomUUID();
const tokenA = randomUUID();
const tokenB = randomUUID();
const sessionA = randomUUID();
const sessionB = randomUUID();
const tokenHashA = `s073-token-${randomUUID()}`;
const tokenHashB = `s073-token-${randomUUID()}`;
const sessionHashA = `s073-session-${randomUUID()}`;
const sessionHashB = `s073-session-${randomUUID()}`;
const farFuture = new Date("2099-01-01T00:00:00.000Z");

describe("S073 release-critical direct row-level security evidence", () => {
  beforeAll(async () => {
    await admin.organization.createMany({ data: [{ id: orgA, name: "S073 A" }, { id: orgB, name: "S073 B" }] });
    await admin.appUser.createMany({ data: [
      { id: userA, authSubject: `s073-${userA}`, email: `${userA}@example.test` },
      { id: userB, authSubject: `s073-${userB}`, email: `${userB}@example.test` },
    ] });
    await admin.organizationMembership.createMany({ data: [
      { id: membershipA, orgId: orgA, userId: userA, role: "admin", status: "active" },
      { id: membershipB, orgId: orgB, userId: userB, role: "admin", status: "active" },
    ] });
    await admin.customer.createMany({ data: [
      { id: customerA, orgId: orgA, name: "S073 Customer A" },
      { id: customerB, orgId: orgB, name: "S073 Customer B" },
    ] });
    await admin.project.createMany({ data: [
      { id: projectA, orgId: orgA, customerId: customerA, name: "S073 Project A" },
      { id: projectB, orgId: orgB, customerId: customerB, name: "S073 Project B" },
    ] });
    await admin.estimate.createMany({ data: [
      { id: estimateA, orgId: orgA, projectId: projectA },
      { id: estimateB, orgId: orgB, projectId: projectB },
    ] });
    await admin.estimateLineItem.createMany({ data: [
      { id: estimateLineA, estimateId: estimateA, description: "A line", quantity: 1, unitOfMeasure: "ea", unitCost: 10, lineCost: 10 },
      { id: estimateLineB, estimateId: estimateB, description: "B line", quantity: 1, unitOfMeasure: "ea", unitCost: 20, lineCost: 20 },
    ] });
    await admin.invoice.createMany({ data: [
      { id: invoiceA, projectId: projectA, invoiceNumber: 73001 },
      { id: invoiceB, projectId: projectB, invoiceNumber: 73002 },
    ] });
    await admin.invoiceLineItem.createMany({ data: [
      { id: invoiceLineA, invoiceId: invoiceA, description: "A invoice line", quantity: 1, unitOfMeasure: "ea", unitPrice: 10, lineTotal: 10 },
      { id: invoiceLineB, invoiceId: invoiceB, description: "B invoice line", quantity: 1, unitOfMeasure: "ea", unitPrice: 20, lineTotal: 20 },
    ] });
    await admin.customerPortalAccessToken.createMany({ data: [
      { id: tokenA, orgId: orgA, customerId: customerA, tokenHash: tokenHashA, expiresAt: farFuture },
      { id: tokenB, orgId: orgB, customerId: customerB, tokenHash: tokenHashB, expiresAt: farFuture },
    ] });
    await admin.customerPortalSession.createMany({ data: [
      { id: sessionA, orgId: orgA, customerId: customerA, accessTokenId: tokenA, sessionHash: sessionHashA, expiresAt: farFuture },
      { id: sessionB, orgId: orgB, customerId: customerB, accessTokenId: tokenB, sessionHash: sessionHashB, expiresAt: farFuture },
    ] });
  });

  afterAll(async () => {
    await admin.customerPortalSession.deleteMany({ where: { id: { in: [sessionA, sessionB] } } });
    await admin.customerPortalAccessToken.deleteMany({ where: { id: { in: [tokenA, tokenB] } } });
    await admin.invoiceLineItem.deleteMany({ where: { id: { in: [invoiceLineA, invoiceLineB] } } });
    await admin.invoice.deleteMany({ where: { id: { in: [invoiceA, invoiceB] } } });
    await admin.estimateLineItem.deleteMany({ where: { id: { in: [estimateLineA, estimateLineB] } } });
    await admin.estimate.deleteMany({ where: { id: { in: [estimateA, estimateB] } } });
    await admin.project.deleteMany({ where: { id: { in: [projectA, projectB] } } });
    await admin.customer.deleteMany({ where: { id: { in: [customerA, customerB] } } });
    await admin.organizationMembership.deleteMany({ where: { id: { in: [membershipA, membershipB] } } });
    await admin.appUser.deleteMany({ where: { id: { in: [userA, userB] } } });
    await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await app.$disconnect();
    await admin.$disconnect();
  });

  it("proves estimate parents are visible while estimate-line RLS remains parent-scoped", async () => {
    expect(await admin.project.count({ where: { id: { in: [projectA, projectB] } } })).toBe(2);
    expect(await admin.project.findUnique({ where: { id: projectA }, select: { orgId: true } })).toEqual({ orgId: orgA });
    expect(await admin.estimate.findUnique({ where: { id: estimateA }, select: { orgId: true } })).toEqual({ orgId: orgA });
    expect(await admin.estimate.count({ where: { id: { in: [estimateA, estimateB] } } })).toBe(2);
    const authA = { userId: userA, orgId: orgA, role: "admin" as const };
    const authB = { userId: userB, orgId: orgB, role: "admin" as const };
    await runWithDatabaseSession(app, authA, async () => {
      const transaction = getRequestDatabaseClient();
      expect(transaction).toBeDefined();
      const [context] = await transaction!.$queryRaw<Array<{ org_id: string; role: string }>>(Prisma.sql`select current_app_org_id()::text as org_id, current_app_role() as role`);
      expect(context).toEqual({ org_id: orgA, role: "admin" });
      expect((await transaction!.project.findMany({ where: { id: { in: [projectA, projectB] } } })).map((row) => row.id)).toEqual([projectA]);
      expect((await transaction!.estimate.findMany({ where: { id: { in: [estimateA, estimateB] } } })).map((row) => row.id)).toEqual([estimateA]);
      expect((await transaction!.estimateLineItem.findMany({ where: { id: { in: [estimateLineA, estimateLineB] } } })).map((row) => row.id)).toEqual([estimateLineA]);
    }, "integration-test");
    await runWithDatabaseSession(app, authB, async () => {
      const transaction = getRequestDatabaseClient()!;
      expect((await transaction.estimate.findMany({ where: { id: { in: [estimateA, estimateB] } } })).map((row) => row.id)).toEqual([estimateB]);
      expect((await transaction.estimateLineItem.findMany({ where: { id: { in: [estimateLineA, estimateLineB] } } })).map((row) => row.id)).toEqual([estimateLineB]);
    }, "integration-test");
  });

  it("enforces invoice-line reads through the parent invoice and project", async () => {
    expect(await admin.invoice.count({ where: { id: { in: [invoiceA, invoiceB] } } })).toBe(2);
    const authA = { userId: userA, orgId: orgA, role: "admin" as const };
    const authB = { userId: userB, orgId: orgB, role: "admin" as const };
    await runWithDatabaseSession(app, authA, async () => {
      const transaction = getRequestDatabaseClient()!;
      expect((await transaction.invoice.findMany({ where: { id: { in: [invoiceA, invoiceB] } } })).map((row) => row.id)).toEqual([invoiceA]);
      expect((await transaction.invoiceLineItem.findMany({ where: { id: { in: [invoiceLineA, invoiceLineB] } } })).map((row) => row.id)).toEqual([invoiceLineA]);
    }, "integration-test");
    await runWithDatabaseSession(app, authB, async () => {
      const transaction = getRequestDatabaseClient()!;
      expect((await transaction.invoice.findMany({ where: { id: { in: [invoiceA, invoiceB] } } })).map((row) => row.id)).toEqual([invoiceB]);
      expect((await transaction.invoiceLineItem.findMany({ where: { id: { in: [invoiceLineA, invoiceLineB] } } })).map((row) => row.id)).toEqual([invoiceLineB]);
    }, "integration-test");
  });

  it("limits portal identity reads to the exact token or session credential", async () => {
    const tokenIds = async (hash: string) => app.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`select set_config('app.portal_lookup_hash', ${hash}, true)`);
      return tx.customerPortalAccessToken.findMany({ where: { id: { in: [tokenA, tokenB] } } });
    });
    const sessionIds = async (hash: string) => app.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`select set_config('app.portal_session_hash', ${hash}, true)`);
      return tx.customerPortalSession.findMany({ where: { id: { in: [sessionA, sessionB] } } });
    });
    expect((await tokenIds(tokenHashA)).map((row) => row.id)).toEqual([tokenA]);
    expect((await tokenIds(tokenHashB)).map((row) => row.id)).toEqual([tokenB]);
    expect(await tokenIds(`wrong-${tokenHashA}`)).toEqual([]);
    expect((await sessionIds(sessionHashA)).map((row) => row.id)).toEqual([sessionA]);
    expect((await sessionIds(sessionHashB)).map((row) => row.id)).toEqual([sessionB]);
    expect(await sessionIds(`wrong-${sessionHashA}`)).toEqual([]);
  });

  it("keeps portal session context scoped to its customer and organization", async () => {
    const visible = await runWithPortalDatabaseSession(app, { orgId: orgA, customerId: customerA, accessTokenId: tokenA, sessionId: sessionA }, async () =>
      getRequestDatabaseClient()!.customerPortalSession.findMany({ where: { id: { in: [sessionA, sessionB] } } }));
    expect(visible.map((row) => row.id)).toEqual([sessionA]);
  });
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for S073 PostgreSQL integration evidence`);
  return value;
}
