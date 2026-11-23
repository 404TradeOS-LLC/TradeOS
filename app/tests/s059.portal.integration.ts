import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession, runWithPortalDatabaseSession } from "../db/requestSession";
import {
  CustomerPortalService,
  hashPortalSecret,
  type CustomerPortalContext,
} from "../modules/customer-portal/service";

/**
 * S059 — live-PostgreSQL certification evidence for the customer portal.
 *
 * Exercises the REAL CustomerPortalService (no mocked Prisma) against the
 * disposable database provisioned by scripts/test-integration-db.sh. The
 * service's module-level `basePrisma`/`prisma` singletons bind to
 * DATABASE_URL, which the integration runner sets to the restricted app-role
 * URL (the same value as TEST_DATABASE_URL), so every query below runs under
 * forced RLS exactly as in production.
 *
 * Call paths mirror the controller/middleware wiring:
 * - issue/revoke run inside runWithDatabaseSession (staff session), the same
 *   context `requireAuth` + `databaseSession` establishes for the staff
 *   routes;
 * - redeem/resolveSession are called directly with no session wrapper, the
 *   same as the redeem route (rate-limit only) and the
 *   `requireCustomerPortalSession` middleware, which resolves the session
 *   before any database session exists;
 * - portal reads and contract signing run inside
 *   runWithPortalDatabaseSession with the session hash, the same context
 *   `customerPortalDatabaseSession` establishes for session-guarded routes.
 *
 * Direct-DB RLS isolation for these rows is already covered live in
 * app/tests/rls.integration.ts ("restricts customer portal reads to the
 * verified customer's tenant and projects", "allows only the exact pending
 * customer contract to transition and records no staff actor") and in
 * app/tests/s073.rls.integration.ts (hash-scoped token/session reads). The
 * C4/C8 tests below cover the service assert path instead: the service must
 * map a foreign row to a 404 before any read or write happens.
 *
 * Raw access/session values exist only as test-local variables generated with
 * crypto.randomBytes; only their SHA-256 digests (via the service's own
 * hashPortalSecret) are ever persisted. No TTL override or test-only backdoor
 * is used: expired fixtures are plain rows seeded with a past expiresAt.
 */

jest.setTimeout(30_000);

const app = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_URL") } } });
const admin = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_ADMIN_URL") } } });
const service = new CustomerPortalService();

const orgA = randomUUID();
const orgB = randomUUID();
const staffUser = randomUUID();
const staffMembership = randomUUID();
const customerA = randomUUID();
const customerNoEmail = randomUUID();
const customerSiblingA = randomUUID();
const customerB = randomUUID();
const customerE5 = randomUUID();
const projectA1 = randomUUID();
const projectA2 = randomUUID();
const projectSiblingA = randomUUID();
const projectB = randomUUID();
const projectNoEmail = randomUUID();
const projectE5 = randomUUID();
const proposalA = randomUUID();
const proposalSiblingA = randomUUID();
const proposalNoEmail = randomUUID();
const proposalE5 = randomUUID();
const invoiceA = randomUUID();
const invoiceSiblingA = randomUUID();
const contractSignedA = randomUUID();
const contractVoidedA = randomUUID();
const contractDoubleSignA = randomUUID();
const contractSiblingA = randomUUID();
const contractNoEmail = randomUUID();
const contractE5 = randomUUID();
const farFuture = new Date("2099-01-01T00:00:00.000Z");
const past = new Date("2020-01-01T00:00:00.000Z");

const staffAuth = { userId: staffUser, orgId: orgA, role: "admin" as const };
const customerIds = [customerA, customerNoEmail, customerSiblingA, customerB, customerE5];
const projectIds = [projectA1, projectA2, projectSiblingA, projectB, projectNoEmail, projectE5];
const contractIds = [
  contractSignedA,
  contractVoidedA,
  contractDoubleSignA,
  contractSiblingA,
  contractNoEmail,
  contractE5,
];

describe("S059 customer portal access certification (live PostgreSQL)", () => {
  beforeAll(async () => {
    await admin.organization.createMany({
      data: [
        { id: orgA, name: "S059 Org A" },
        { id: orgB, name: "S059 Org B" },
      ],
    });
    await admin.appUser.create({
      data: { id: staffUser, authSubject: `s059-${staffUser}`, email: `s059-${staffUser}@example.invalid` },
    });
    await admin.organizationMembership.create({
      data: { id: staffMembership, orgId: orgA, userId: staffUser, role: "admin", status: "active" },
    });
    await admin.customer.createMany({
      data: [
        { id: customerA, orgId: orgA, name: "S059 Customer A", email: `s059-${customerA}@example.invalid` },
        { id: customerNoEmail, orgId: orgA, name: "S059 Customer Without Email" },
        { id: customerSiblingA, orgId: orgA, name: "S059 Customer A Sibling", email: `s059-${customerSiblingA}@example.invalid` },
        { id: customerB, orgId: orgB, name: "S059 Customer B", email: `s059-${customerB}@example.invalid` },
        { id: customerE5, orgId: orgA, name: "S059 Customer E5", email: `s059-${customerE5}@example.invalid` },
      ],
    });
    await admin.project.createMany({
      data: [
        { id: projectA1, orgId: orgA, customerId: customerA, name: "S059 Project A1" },
        { id: projectA2, orgId: orgA, customerId: customerA, name: "S059 Project A2" },
        { id: projectSiblingA, orgId: orgA, customerId: customerSiblingA, name: "S059 Project Sibling A" },
        { id: projectB, orgId: orgB, customerId: customerB, name: "S059 Project B" },
        { id: projectNoEmail, orgId: orgA, customerId: customerNoEmail, name: "S059 Project No Email" },
        { id: projectE5, orgId: orgA, customerId: customerE5, name: "S059 Project E5" },
      ],
    });
    await admin.proposal.createMany({
      data: [
        { id: proposalA, projectId: projectA1, status: "sent" },
        { id: proposalSiblingA, projectId: projectSiblingA, status: "sent" },
        { id: proposalNoEmail, projectId: projectNoEmail, status: "sent" },
        { id: proposalE5, projectId: projectE5, status: "sent" },
      ],
    });
    await admin.invoice.createMany({
      data: [
        { id: invoiceA, projectId: projectA1, invoiceNumber: 59001, status: "sent" },
        { id: invoiceSiblingA, projectId: projectSiblingA, invoiceNumber: 59002, status: "sent" },
      ],
    });
    await admin.contract.createMany({
      data: [
        { id: contractSignedA, projectId: projectA1, proposalId: proposalA, status: "signed", termsText: "S059 signed" },
        { id: contractVoidedA, projectId: projectA1, proposalId: proposalA, status: "voided", termsText: "S059 voided" },
        { id: contractDoubleSignA, projectId: projectA1, proposalId: proposalA, status: "pending_signature", termsText: "S059 double-sign" },
        { id: contractSiblingA, projectId: projectSiblingA, proposalId: proposalSiblingA, status: "pending_signature", termsText: "S059 sibling" },
        { id: contractNoEmail, projectId: projectNoEmail, proposalId: proposalNoEmail, status: "pending_signature", termsText: "S059 no email" },
        { id: contractE5, projectId: projectE5, proposalId: proposalE5, status: "pending_signature", termsText: "S059 E5" },
      ],
    });
  });

  afterAll(async () => {
    await admin.contractEvent.deleteMany({ where: { contractId: { in: contractIds } } });
    await admin.customerPortalSession.deleteMany({ where: { customerId: { in: customerIds } } });
    await admin.customerPortalAccessToken.deleteMany({ where: { customerId: { in: customerIds } } });
    await admin.contract.deleteMany({ where: { id: { in: contractIds } } });
    await admin.invoice.deleteMany({ where: { id: { in: [invoiceA, invoiceSiblingA] } } });
    await admin.proposal.deleteMany({ where: { id: { in: [proposalA, proposalSiblingA, proposalNoEmail, proposalE5] } } });
    await admin.project.deleteMany({ where: { id: { in: projectIds } } });
    await admin.customer.deleteMany({ where: { id: { in: customerIds } } });
    await admin.organizationMembership.deleteMany({ where: { id: staffMembership } });
    await admin.appUser.deleteMany({ where: { id: staffUser } });
    await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await app.$disconnect();
    await admin.$disconnect();
  });

  it("B5: replaying a redeemed link returns 410 and creates no second session", async () => {
    const issued = await issueFor(customerA);
    const redeemed = await service.redeemAccessToken(issued.token);
    expect(redeemed.customerId).toBe(customerA);
    expect(redeemed.orgId).toBe(orgA);
    expect(redeemed.sessionId).toBeTruthy();

    await expect(service.redeemAccessToken(issued.token)).rejects.toMatchObject({ statusCode: 410 });
    expect(await admin.customerPortalSession.count({ where: { accessTokenId: issued.id } })).toBe(1);
    expect(await admin.customerPortalAccessToken.findUniqueOrThrow({ where: { id: issued.id } })).toMatchObject({
      redeemedAt: expect.any(Date),
    });
  });

  it("B6: redeeming an expired link returns 410", async () => {
    const { id: tokenId, raw } = await seedAccessToken({ customerId: customerA, expiresAt: past });
    await expect(service.redeemAccessToken(raw)).rejects.toMatchObject({ statusCode: 410 });
    expect(await admin.customerPortalSession.count({ where: { accessTokenId: tokenId } })).toBe(0);
    expect(await admin.customerPortalAccessToken.findUniqueOrThrow({ where: { id: tokenId } })).toMatchObject({
      redeemedAt: null,
    });
  });

  it("B7: redeeming a revoked link returns 410", async () => {
    const issued = await issueFor(customerA);
    await revokeToken(issued.id);
    await expect(service.redeemAccessToken(issued.token)).rejects.toMatchObject({ statusCode: 410 });
    expect(await admin.customerPortalSession.count({ where: { accessTokenId: issued.id } })).toBe(0);
  });

  it("E3: a session whose parent token was revoked no longer resolves (401)", async () => {
    const issued = await issueFor(customerA);
    const redeemed = await service.redeemAccessToken(issued.token);
    await revokeToken(issued.id);
    await expect(service.resolveSession(redeemed.sessionToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("E4: an expired session no longer resolves (401)", async () => {
    const { rawSession } = await seedSession({ customerId: customerA, sessionExpiresAt: past });
    await expect(service.resolveSession(rawSession)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("E5: a session for a soft-deleted customer no longer resolves (401)", async () => {
    const issued = await issueFor(customerE5);
    const redeemed = await service.redeemAccessToken(issued.token);
    await admin.customer.update({ where: { id: customerE5 }, data: { deletedAt: new Date() } });
    await expect(service.resolveSession(redeemed.sessionToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("A2/A3: issuing a link for an unknown customer returns 404 and for a customer without email returns 409", async () => {
    await expect(issueFor(randomUUID())).rejects.toMatchObject({ statusCode: 404 });
    // A customer from another org is not visible to this org's staff either.
    await expect(issueFor(customerB)).rejects.toMatchObject({ statusCode: 404 });
    await expect(issueFor(customerNoEmail)).rejects.toMatchObject({ statusCode: 409 });
    expect(await admin.customerPortalAccessToken.count({ where: { customerId: customerNoEmail } })).toBe(0);
  });

  it("D2: signing a non-pending contract from the portal returns 409 and leaves it unchanged", async () => {
    const context = await portalContextFor(customerA);
    for (const contractId of [contractSignedA, contractVoidedA]) {
      await expect(
        inPortalSession(context, () =>
          service.signContract(context.session, contractId, { signerName: "S059 Customer A" }),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    }
    // Neither contract changed: the signed one stays signed, the voided one
    // stays voided, and no signature event was recorded for either.
    expect((await admin.contract.findUniqueOrThrow({ where: { id: contractSignedA } })).status).toBe("signed");
    expect((await admin.contract.findUniqueOrThrow({ where: { id: contractVoidedA } })).status).toBe("voided");
    expect(await admin.contractEvent.count({ where: { contractId: { in: [contractSignedA, contractVoidedA] } } })).toBe(0);
  });

  it("D5: signing when the customer has no email returns 409", async () => {
    const { rawSession } = await seedSession({ customerId: customerNoEmail });
    const session = await service.resolveSession(rawSession);
    const portal = { session, rawSession };
    await expect(
      inPortalSession(portal, () =>
        service.signContract(portal.session, contractNoEmail, { signerName: "S059 Customer Without Email" }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await admin.contract.findUniqueOrThrow({ where: { id: contractNoEmail } })).status).toBe("pending_signature");
  });

  it("D6: concurrent double-sign of the same pending contract allows exactly one signature", async () => {
    const context = await portalContextFor(customerA);
    const attempts = await Promise.allSettled([
      inPortalSession(context, () =>
        service.signContract(context.session, contractDoubleSignA, { signerName: "S059 First Signer" }),
      ),
      inPortalSession(context, () =>
        service.signContract(context.session, contractDoubleSignA, { signerName: "S059 Second Signer" }),
      ),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = attempts.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ statusCode: 409 });
    expect((await admin.contract.findUniqueOrThrow({ where: { id: contractDoubleSignA } })).status).toBe("signed");
    expect(
      await admin.contractEvent.count({ where: { contractId: contractDoubleSignA, eventType: "contract.signed" } }),
    ).toBe(1);
  });

  it("C1/C2: resolving a session returns its own context and listProjects returns only the session customer's projects", async () => {
    const issued = await issueFor(customerA);
    const redeemed = await service.redeemAccessToken(issued.token);
    const session = await service.resolveSession(redeemed.sessionToken);
    expect(session).toMatchObject({ sessionId: redeemed.sessionId, orgId: orgA, customerId: customerA });
    const portal = { session, rawSession: redeemed.sessionToken };

    const projects = await inPortalSession(portal, () => service.listProjects(portal.session));
    expect(projects.map((project) => project.id).sort()).toEqual([projectA1, projectA2].sort());
    expect(projects.every((project) => project.orgId === orgA && project.customerId === customerA)).toBe(true);

    const own = await inPortalSession(portal, () => service.getProject(portal.session, projectA1));
    expect(own.id).toBe(projectA1);
    expect(own.customerId).toBe(customerA);
  });

  it("C4/C8: service reads for another customer's or another org's project, proposal, invoice, and contract return 404", async () => {
    const context = await portalContextFor(customerA);
    // Same org, different customer.
    await expect(inPortalSession(context, () => service.getProject(context.session, projectSiblingA))).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(inPortalSession(context, () => service.getProposal(context.session, proposalSiblingA))).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(inPortalSession(context, () => service.getInvoice(context.session, invoiceSiblingA))).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(inPortalSession(context, () => service.getContract(context.session, contractSiblingA))).rejects.toMatchObject({
      statusCode: 404,
    });
    // Cross-org.
    await expect(inPortalSession(context, () => service.getProject(context.session, projectB))).rejects.toMatchObject({
      statusCode: 404,
    });
    // Signing a foreign contract is denied by the same assert before any write.
    await expect(
      inPortalSession(context, () =>
        service.signContract(context.session, contractSiblingA, { signerName: "S059 Customer A" }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await admin.contract.findUniqueOrThrow({ where: { id: contractSiblingA } })).status).toBe("pending_signature");
  });
});

/** Issue a link the way staff do: inside a staff database session. */
function issueFor(customerId: string) {
  return runWithDatabaseSession(app, staffAuth, () =>
    service.issueAccessToken({ orgId: orgA, customerId }),
  );
}

/** Revoke a link the way staff do: inside a staff database session. */
function revokeToken(accessTokenId: string) {
  return runWithDatabaseSession(app, staffAuth, () => service.revokeAccessToken(orgA, accessTokenId));
}

/**
 * Full portal login for a customer: issue + redeem + resolve, returning the
 * resolved context together with the raw session value needed to re-enter the
 * portal database session for reads/signing. The raw value never leaves this
 * test process.
 */
async function portalContextFor(customerId: string): Promise<{
  session: CustomerPortalContext;
  rawSession: string;
}> {
  const issued = await issueFor(customerId);
  const redeemed = await service.redeemAccessToken(issued.token);
  const session = await service.resolveSession(redeemed.sessionToken);
  return { session, rawSession: redeemed.sessionToken };
}

/**
 * Run a portal read/sign the way the session-guarded routes do: inside the
 * portal database session, keyed by the SHA-256 digest of the raw session
 * value (the same digest the middleware computes from the session header).
 */
function inPortalSession<T>(
  context: { session: CustomerPortalContext; rawSession: string },
  operation: () => Promise<T>,
): Promise<T> {
  return runWithPortalDatabaseSession(
    app,
    context.session,
    operation,
    "customer_portal",
    hashPortalSecret(context.rawSession),
  );
}

/** Seed one access-token row directly (hash only persisted) and return its raw value. */
async function seedAccessToken(input: { customerId: string; expiresAt?: Date }): Promise<{ id: string; raw: string }> {
  const id = randomUUID();
  const raw = randomBytes(32).toString("base64url");
  await admin.customerPortalAccessToken.create({
    data: {
      id,
      orgId: orgA,
      customerId: input.customerId,
      tokenHash: hashPortalSecret(raw),
      expiresAt: input.expiresAt ?? farFuture,
    },
  });
  return { id, raw };
}

/**
 * Seed one token + session pair directly (hashes only persisted) and return
 * the raw session value. Used where the service cannot produce the fixture:
 * expired sessions, and customers without an email (issue requires one).
 */
async function seedSession(input: {
  customerId: string;
  sessionExpiresAt?: Date;
}): Promise<{ tokenId: string; sessionId: string; rawSession: string }> {
  const { id: tokenId } = await seedAccessToken({ customerId: input.customerId });
  const sessionId = randomUUID();
  const rawSession = randomBytes(32).toString("base64url");
  await admin.customerPortalSession.create({
    data: {
      id: sessionId,
      orgId: orgA,
      customerId: input.customerId,
      accessTokenId: tokenId,
      sessionHash: hashPortalSecret(rawSession),
      expiresAt: input.sessionExpiresAt ?? farFuture,
    },
  });
  return { tokenId, sessionId, rawSession };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for S059 PostgreSQL integration evidence`);
  return value;
}
