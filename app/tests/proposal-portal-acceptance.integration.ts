import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession, runWithPortalDatabaseSession } from "../db/requestSession";
import {
  CustomerPortalService,
  hashPortalSecret,
  type CustomerPortalContext,
} from "../modules/customer-portal/service";

/**
 * DES-10-F7 — live-PostgreSQL evidence for governed public-portal proposal
 * approval + signature.
 *
 * Exercises the REAL CustomerPortalService + ProposalsService (no mocked
 * Prisma) against the disposable database provisioned by
 * scripts/test-integration-db.sh. The services' module-level
 * basePrisma/prisma singletons bind to DATABASE_URL, which the integration
 * runner sets to the restricted app-role URL (the same value as
 * TEST_DATABASE_URL), so every query below runs under forced RLS exactly as
 * in production.
 *
 * Call paths mirror the controller/middleware wiring: issue runs inside
 * runWithDatabaseSession (staff session); redeem/resolveSession are called
 * directly with no session wrapper; portal accept/decline run inside
 * runWithPortalDatabaseSession with the session hash, the same context
 * customerPortalDatabaseSession establishes for session-guarded routes.
 *
 * Raw access/session values exist only as test-local variables generated
 * with crypto.randomBytes; only their SHA-256 digests (via the service's own
 * hashPortalSecret) are ever persisted. No TTL override or test-only
 * backdoor is used: expired fixtures are plain rows seeded with a past
 * expiresAt.
 *
 * Direct-DB RLS isolation for the portal write is probed live at the end:
 * the same portal session, pointed at a proposal that is NOT the one keyed
 * by app.portal_proposal_id, must not be able to move it — the service
 * assert 404s first, and a raw UPDATE under the portal session (bypassing
 * the service) is denied by the policy/trigger even with the session set.
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
const customerSiblingA = randomUUID();
const customerB = randomUUID();
const customerNoEmail = randomUUID();
const projectA1 = randomUUID();
const projectA2 = randomUUID();
const projectSiblingA = randomUUID();
const projectB = randomUUID();
const projectNoEmail = randomUUID();
const proposalAccept = randomUUID();
const proposalDecline = randomUUID();
const proposalDraft = randomUUID();
const proposalDouble = randomUUID();
const proposalSiblingA = randomUUID();
const proposalB = randomUUID();
const proposalNoEmail = randomUUID();
const farFuture = new Date("2099-01-01T00:00:00.000Z");

const staffAuth = { userId: staffUser, orgId: orgA, role: "admin" as const };
const customerIds = [customerA, customerSiblingA, customerB, customerNoEmail];
const projectIds = [projectA1, projectA2, projectSiblingA, projectB, projectNoEmail];
const proposalIds = [proposalAccept, proposalDecline, proposalDraft, proposalDouble, proposalSiblingA, proposalB, proposalNoEmail];

const SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

describe("DES-10-F7 portal proposal approval + signature (live PostgreSQL)", () => {
  beforeAll(async () => {
    await admin.organization.createMany({
      data: [
        { id: orgA, name: "F7 Org A" },
        { id: orgB, name: "F7 Org B" },
      ],
    });
    await admin.appUser.create({
      data: { id: staffUser, authSubject: `f7-${staffUser}`, email: `f7-${staffUser}@example.invalid` },
    });
    await admin.organizationMembership.create({
      data: { id: staffMembership, orgId: orgA, userId: staffUser, role: "admin", status: "active" },
    });
    await admin.customer.createMany({
      data: [
        { id: customerA, orgId: orgA, name: "F7 Customer A", email: `f7-${customerA}@example.invalid` },
        { id: customerSiblingA, orgId: orgA, name: "F7 Customer A Sibling", email: `f7-${customerSiblingA}@example.invalid` },
        { id: customerB, orgId: orgB, name: "F7 Customer B", email: `f7-${customerB}@example.invalid` },
        { id: customerNoEmail, orgId: orgA, name: "F7 Customer Without Email" },
      ],
    });
    await admin.project.createMany({
      data: [
        { id: projectA1, orgId: orgA, customerId: customerA, name: "F7 Project A1", status: "estimating" },
        { id: projectA2, orgId: orgA, customerId: customerA, name: "F7 Project A2", status: "estimating" },
        { id: projectSiblingA, orgId: orgA, customerId: customerSiblingA, name: "F7 Project Sibling A", status: "estimating" },
        { id: projectB, orgId: orgB, customerId: customerB, name: "F7 Project B", status: "estimating" },
        { id: projectNoEmail, orgId: orgA, customerId: customerNoEmail, name: "F7 Project No Email", status: "estimating" },
      ],
    });
    await admin.proposal.createMany({
      data: [
        { id: proposalAccept, projectId: projectA1, status: "sent", scopeOfWork: "Replace the deck", finalPrice: 975 },
        { id: proposalDecline, projectId: projectA2, status: "viewed", scopeOfWork: "Rebuild the porch", finalPrice: 1200 },
        { id: proposalDraft, projectId: projectA1, status: "draft", scopeOfWork: "Draft scope", finalPrice: 500 },
        { id: proposalDouble, projectId: projectA1, status: "sent", scopeOfWork: "Double-response probe", finalPrice: 100 },
        { id: proposalSiblingA, projectId: projectSiblingA, status: "sent", scopeOfWork: "Sibling scope", finalPrice: 200 },
        { id: proposalB, projectId: projectB, status: "sent", scopeOfWork: "Other org scope", finalPrice: 300 },
        { id: proposalNoEmail, projectId: projectNoEmail, status: "sent", scopeOfWork: "No email scope", finalPrice: 400 },
      ],
    });
  });

  afterAll(async () => {
    await admin.proposalDelivery.deleteMany({ where: { proposalId: { in: proposalIds } } });
    await admin.activityEvent.deleteMany({ where: { entityId: { in: projectIds } } });
    await admin.customerPortalSession.deleteMany({ where: { customerId: { in: customerIds } } });
    await admin.customerPortalAccessToken.deleteMany({ where: { customerId: { in: customerIds } } });
    await admin.proposal.deleteMany({ where: { id: { in: proposalIds } } });
    await admin.project.deleteMany({ where: { id: { in: projectIds } } });
    await admin.customer.deleteMany({ where: { id: { in: customerIds } } });
    await admin.organizationMembership.deleteMany({ where: { id: staffMembership } });
    await admin.appUser.deleteMany({ where: { id: staffUser } });
    await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await app.$disconnect();
    await admin.$disconnect();
  });

  it("accepts a sent proposal: status, signature record, portal audit event, and project award", async () => {
    const context = await portalContextFor(customerA);
    const accepted = await inPortalSession(context, () =>
      service.acceptProposal(context.session, proposalAccept, {
        signerName: "F7 Customer A",
        signatureDataUrl: SIGNATURE,
        signatureIpReported: "203.0.113.7",
        signatureUserAgentReported: "F7Test/1.0",
      }),
    );

    expect(accepted.status).toBe("accepted");
    expect(accepted.signerName).toBe("F7 Customer A");
    expect(accepted.signerEmail).toBe(`f7-${customerA}@example.invalid`);
    expect(accepted.signatureDataUrl).toBe(SIGNATURE);
    expect(accepted.signedAt).not.toBeNull();
    expect(accepted.respondedAt).not.toBeNull();

    const row = await admin.proposal.findUniqueOrThrow({ where: { id: proposalAccept } });
    expect(row.status).toBe("accepted");
    expect(row.scopeOfWork).toBe("Replace the deck");
    expect(Number(row.finalPrice)).toBe(975);
    expect(row.signatureIpReported).toBe("203.0.113.7");
    expect(row.signatureUserAgentReported).toBe("F7Test/1.0");

    const events = await admin.proposalDelivery.findMany({ where: { proposalId: proposalAccept } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "proposal.accepted", deliveryChannel: "portal", actorUserId: null });
    const metadata = events[0].metadataJson as Record<string, unknown>;
    expect(metadata).toMatchObject({
      actorType: "customer_portal",
      customerId: customerA,
      previousStatus: "sent",
      newStatus: "accepted",
      signerName: "F7 Customer A",
    });
    expect(metadata.portalSessionId).toBe(context.session.sessionId);

    expect(
      await admin.activityEvent.count({
        where: { entityId: projectA1, eventType: "proposal.accepted", actorUserId: null },
      }),
    ).toBe(1);

    expect((await admin.project.findUniqueOrThrow({ where: { id: projectA1 } })).status).toBe("awarded");
  });

  it("a second accept of the same proposal returns 409 and records no second event", async () => {
    const context = await portalContextFor(customerA);
    await expect(
      inPortalSession(context, () =>
        service.acceptProposal(context.session, proposalAccept, {
          signerName: "F7 Customer A",
          signatureDataUrl: SIGNATURE,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await admin.proposalDelivery.count({ where: { proposalId: proposalAccept } })).toBe(1);
  });

  it("concurrent double-accept allows exactly one acceptance", async () => {
    const context = await portalContextFor(customerA);
    const attempts = await Promise.allSettled([
      inPortalSession(context, () =>
        service.acceptProposal(context.session, proposalDouble, { signerName: "First", signatureDataUrl: SIGNATURE }),
      ),
      inPortalSession(context, () =>
        service.acceptProposal(context.session, proposalDouble, { signerName: "Second", signatureDataUrl: SIGNATURE }),
      ),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = attempts.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ statusCode: 409 });
    expect(await admin.proposalDelivery.count({ where: { proposalId: proposalDouble, eventType: "proposal.accepted" } })).toBe(1);
  });

  it("declines a viewed proposal, records the reason, and leaves the project untouched", async () => {
    const context = await portalContextFor(customerA);
    const declined = await inPortalSession(context, () =>
      service.declineProposal(context.session, proposalDecline, { reason: "Timing no longer works" }),
    );

    expect(declined.status).toBe("declined");
    expect(declined.declinedReason).toBe("Timing no longer works");
    expect(declined.signerName).toBeNull();
    expect(declined.signedAt).toBeNull();

    const row = await admin.proposal.findUniqueOrThrow({ where: { id: proposalDecline } });
    expect(row.status).toBe("declined");
    expect(row.scopeOfWork).toBe("Rebuild the porch");
    expect(Number(row.finalPrice)).toBe(1200);

    const events = await admin.proposalDelivery.findMany({ where: { proposalId: proposalDecline } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "proposal.declined", deliveryChannel: "portal", actorUserId: null });
    expect(events[0].metadataJson).toMatchObject({
      actorType: "customer_portal",
      declinedReason: "Timing no longer works",
    });

    expect((await admin.project.findUniqueOrThrow({ where: { id: projectA2 } })).status).toBe("estimating");
  });

  it("a typed name with no drawn signature is rejected before any write", async () => {
    const context = await portalContextFor(customerA);
    await expect(
      inPortalSession(context, () =>
        service.acceptProposal(context.session, proposalDecline, {
          signerName: "F7 Customer A",
          signatureDataUrl: "F7 Customer A",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepting or declining a draft proposal returns 404 and leaves it a draft", async () => {
    const context = await portalContextFor(customerA);
    await expect(
      inPortalSession(context, () =>
        service.acceptProposal(context.session, proposalDraft, { signerName: "F7 Customer A", signatureDataUrl: SIGNATURE }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      inPortalSession(context, () => service.declineProposal(context.session, proposalDraft, {})),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await admin.proposal.findUniqueOrThrow({ where: { id: proposalDraft } })).status).toBe("draft");
  });

  it("another customer's and another org's proposals return 404 and stay sent", async () => {
    const context = await portalContextFor(customerA);
    await expect(
      inPortalSession(context, () =>
        service.acceptProposal(context.session, proposalSiblingA, { signerName: "F7 Customer A", signatureDataUrl: SIGNATURE }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      inPortalSession(context, () => service.declineProposal(context.session, proposalB, { reason: "not mine" })),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await admin.proposal.findUniqueOrThrow({ where: { id: proposalSiblingA } })).status).toBe("sent");
    expect((await admin.proposal.findUniqueOrThrow({ where: { id: proposalB } })).status).toBe("sent");
  });

  it("accepting when the customer has no email returns 409 and leaves the proposal sent", async () => {
    const { rawSession } = await seedSession({ customerId: customerNoEmail });
    const session = await service.resolveSession(rawSession);
    const portal = { session, rawSession };
    await expect(
      inPortalSession(portal, () =>
        service.acceptProposal(portal.session, proposalNoEmail, { signerName: "F7 Customer Without Email", signatureDataUrl: SIGNATURE }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await admin.proposal.findUniqueOrThrow({ where: { id: proposalNoEmail } })).status).toBe("sent");
  });

  it("an expired session cannot accept (401) and a replayed link cannot redeem (410)", async () => {
    const { rawSession } = await seedSession({ customerId: customerA, sessionExpiresAt: new Date("2020-01-01T00:00:00.000Z") });
    await expect(service.resolveSession(rawSession)).rejects.toMatchObject({ statusCode: 401 });

    const issued = await issueFor(customerA);
    await service.redeemAccessToken(issued.token);
    await expect(service.redeemAccessToken(issued.token)).rejects.toMatchObject({ statusCode: 410 });
  });

  it("a raw UPDATE under the portal session cannot move a proposal the token does not key", async () => {
    const context = await portalContextFor(customerA);
    // The service assert already 404s a foreign proposal, so prove the
    // database layer too: with app.portal_proposal_id keyed to the
    // already-accepted proposal, a raw update of a different sent proposal
    // in the same portal session must affect zero rows.
    await expect(
      inPortalSession(context, async () => {
        const rows = await app.$queryRaw<Array<{ id: string }>>`
          select set_config('app.portal_proposal_id', ${proposalAccept}, true)
        `;
        expect(rows).toBeDefined();
        const updated = await app.$executeRaw`
          update public.proposals
          set status = 'accepted', responded_at = now()
          where id = ${proposalSiblingA}::uuid
        `;
        expect(updated).toBe(0);
      }),
    ).resolves.toBeUndefined();
    expect((await admin.proposal.findUniqueOrThrow({ where: { id: proposalSiblingA } })).status).toBe("sent");
  });
});

/** Full portal login for a customer: issue + redeem + resolve. */
async function portalContextFor(customerId: string): Promise<{
  session: CustomerPortalContext;
  rawSession: string;
}> {
  const issued = await issueFor(customerId);
  const redeemed = await service.redeemAccessToken(issued.token);
  const session = await service.resolveSession(redeemed.sessionToken);
  return { session, rawSession: redeemed.sessionToken };
}

/** Run a portal operation the way the session-guarded routes do. */
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

/** Issue a link the way staff do: inside a staff database session. */
function issueFor(customerId: string) {
  return runWithDatabaseSession(app, staffAuth, () =>
    service.issueAccessToken({ orgId: orgA, customerId }),
  );
}

/** Seed one token + session pair directly (hashes only persisted). */
async function seedSession(input: {
  customerId: string;
  sessionExpiresAt?: Date;
}): Promise<{ tokenId: string; sessionId: string; rawSession: string }> {
  const tokenId = randomUUID();
  const raw = randomBytes(32).toString("base64url");
  await admin.customerPortalAccessToken.create({
    data: {
      id: tokenId,
      orgId: orgA,
      customerId: input.customerId,
      tokenHash: hashPortalSecret(raw),
      expiresAt: farFuture,
    },
  });
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
  if (!value) throw new Error(`${name} is required for DES-10-F7 PostgreSQL integration evidence`);
  return value;
}
