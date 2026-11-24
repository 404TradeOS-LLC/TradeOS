import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../backend/auth/context";
import { runWithDatabaseSession } from "../db/requestSession";
import { JobsService } from "../modules/jobs/service";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for DEV-22 integration tests`);
  return value;
}

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgId = randomUUID();
const userId = randomUUID();
const techUserId = randomUUID();
const customerId = randomUUID();
const customer2Id = randomUUID();
const projectId = randomUUID();
const serviceAddressId = randomUUID();
const serviceAddress2Id = randomUUID();
const proposalId = randomUUID();
const proposal2Id = randomUUID();
const foreignOrgId = randomUUID();
const foreignUserId = randomUUID();
const foreignCustomerId = randomUUID();
const foreignProjectId = randomUUID();
const foreignProposalId = randomUUID();
const auth: AuthContext = { userId, orgId, role: "admin", canonicalRole: "admin" };

describe("DEV-22 proposal-acceptance follow-ups in a request-scoped PostgreSQL transaction", () => {
  beforeAll(async () => {
    await adminClient.organization.create({ data: { id: orgId, name: "DEV-22 Integration Org" } });
    await adminClient.appUser.create({
      data: {
        id: userId,
        authSubject: `dev22-${userId}`,
        email: `dev22-${userId}@example.com`,
      },
    });
    await adminClient.organizationMembership.create({
      data: { orgId, userId, role: "admin", status: "active" },
    });
    await adminClient.appUser.create({
      data: {
        id: techUserId,
        authSubject: `dev22-tech-${techUserId}`,
        email: `dev22-tech-${techUserId}@example.com`,
      },
    });
    await adminClient.organizationMembership.create({
      data: { orgId, userId: techUserId, role: "technician", status: "active" },
    });
    await adminClient.customer.create({ data: { id: customerId, orgId, name: "DEV-22 Customer" } });
    await adminClient.customer.create({ data: { id: customer2Id, orgId, name: "DEV-22 Second Customer" } });
    await adminClient.project.create({
      data: { id: projectId, orgId, customerId, name: "DEV-22 Project", status: "awarded", jobType: "Cabinet refinishing" },
    });
    await adminClient.serviceAddress.create({
      data: {
        id: serviceAddressId,
        orgId,
        customerId,
        addressLine1: "123 Main St",
        city: "Terre Haute",
        state: "IN",
        postalCode: "47802",
        label: "Primary",
        country: "US",
      },
    });
    await adminClient.serviceAddress.create({
      data: {
        id: serviceAddress2Id,
        orgId,
        customerId,
        addressLine1: "456 Oak Ave",
        city: "Terre Haute",
        state: "IN",
        postalCode: "47802",
        label: "Side gate",
        country: "US",
      },
    });
    await adminClient.proposal.create({
      data: {
        id: proposalId,
        projectId,
        status: "accepted",
        scopeOfWork: "Refinish fifteen cabinets",
        respondedAt: new Date(),
      },
    });
    await adminClient.proposal.create({
      data: {
        id: proposal2Id,
        projectId,
        status: "accepted",
        scopeOfWork: "Refinish the bathroom vanity",
        respondedAt: new Date(),
      },
    });
    await adminClient.organization.create({ data: { id: foreignOrgId, name: "DEV-22 Foreign Org" } });
    await adminClient.appUser.create({
      data: {
        id: foreignUserId,
        authSubject: `dev22-foreign-${foreignUserId}`,
        email: `dev22-foreign-${foreignUserId}@example.com`,
      },
    });
    await adminClient.organizationMembership.create({
      data: { orgId: foreignOrgId, userId: foreignUserId, role: "admin", status: "active" },
    });
    await adminClient.customer.create({ data: { id: foreignCustomerId, orgId: foreignOrgId, name: "DEV-22 Foreign Customer" } });
    await adminClient.project.create({
      data: { id: foreignProjectId, orgId: foreignOrgId, customerId: foreignCustomerId, name: "DEV-22 Foreign Project", status: "awarded" },
    });
    await adminClient.proposal.create({
      data: {
        id: foreignProposalId,
        projectId: foreignProjectId,
        status: "accepted",
        scopeOfWork: "Foreign scope",
        respondedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgId, foreignOrgId] } } });
    await adminClient.appUser.deleteMany({ where: { id: { in: [userId, techUserId, foreignUserId] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("(a) the source-proposal foreign key restricts deleting a proposal a job derives from", async () => {
    const service = new JobsService();
    const job = await runWithDatabaseSession(appClient, auth, () =>
      service.createFromAcceptedProposal({ orgId, actor: auth, proposalId, serviceAddressId })
    );
    expect(job.sourceProposalId).toBe(proposalId);

    await expect(
      adminClient.proposal.delete({ where: { id: proposalId } })
    ).rejects.toMatchObject({ code: "P2003" });

    const kept = await adminClient.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(kept.sourceProposalId).toBe(proposalId);
  });

  it("(a) a direct create linking a proposal from another organization is rejected", async () => {
    const service = new JobsService();
    await expect(
      runWithDatabaseSession(appClient, auth, () =>
        service.create({
          orgId,
          actor: auth,
          projectId,
          customerId,
          serviceAddressId,
          title: "Foreign-linked job",
          jobType: "Cabinet refinishing",
          sourceProposalId: foreignProposalId,
        })
      )
    ).rejects.toMatchObject({ statusCode: 404 });

    const jobs = await adminClient.job.findMany({ where: { orgId, sourceProposalId: foreignProposalId } });
    expect(jobs).toHaveLength(0);
  });

  it("(b) the conversion baseline freezes the accepted customer and service address", async () => {
    const service = new JobsService();
    const job = await runWithDatabaseSession(appClient, auth, () =>
      service.createFromAcceptedProposal({ orgId, actor: auth, proposalId: proposal2Id, serviceAddressId })
    );

    const read = await adminClient.job.findUniqueOrThrow({ where: { id: job.id } });
    const baseline = read.acceptedBaselineJson as Record<string, unknown>;
    expect(baseline.customerId).toBe(customerId);
    expect(baseline.serviceAddressId).toBe(serviceAddressId);
    expect(baseline.serviceAddress).toEqual({
      id: serviceAddressId,
      label: "Primary",
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "Terre Haute",
      state: "IN",
      postalCode: "47802",
      country: "US",
    });
  });

  it("(b) the live service address stays editable while the project and customer stay frozen", async () => {
    const service = new JobsService();
    const job = await runWithDatabaseSession(appClient, auth, () =>
      service.createFromAcceptedProposal({ orgId, actor: auth, proposalId: proposal2Id, serviceAddressId })
    );

    const moved = await runWithDatabaseSession(appClient, auth, () =>
      service.update(job.id, { orgId, actor: auth, serviceAddressId: serviceAddress2Id })
    );
    expect(moved.serviceAddressId).toBe(serviceAddress2Id);

    // The accepted baseline still records the address the proposal was
    // accepted for, even after the live row moved.
    const read = await adminClient.job.findUniqueOrThrow({ where: { id: job.id } });
    const baseline = read.acceptedBaselineJson as Record<string, unknown>;
    expect(baseline.serviceAddressId).toBe(serviceAddressId);

    await expect(
      runWithDatabaseSession(appClient, auth, () =>
        service.update(job.id, { orgId, actor: auth, customerId: customer2Id })
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("(c) rescheduling a dispatched job requires confirmation, records the reversal, and needs explicit redispatch", async () => {
    const service = new JobsService();
    const job = await runWithDatabaseSession(appClient, auth, () =>
      service.createFromAcceptedProposal({ orgId, actor: auth, proposalId: proposal2Id, serviceAddressId })
    );

    const start = new Date("2026-07-16T13:00:00.000Z");
    const end = new Date("2026-07-16T15:00:00.000Z");
    const scheduled = await runWithDatabaseSession(appClient, auth, () =>
      service.schedule(job.id, { orgId, actor: auth, scheduledStart: start, scheduledEnd: end })
    );
    expect(scheduled.status).toBe("scheduled");

    await runWithDatabaseSession(appClient, auth, () =>
      service.addAssignment(job.id, { orgId, actor: auth, userId: techUserId, assignmentRole: "lead", isLead: true })
    );
    const dispatched = await runWithDatabaseSession(appClient, auth, () =>
      service.dispatch(job.id, { orgId, actor: auth })
    );
    expect(dispatched.status).toBe("dispatched");

    const nextStart = new Date("2026-07-17T13:00:00.000Z");
    const nextEnd = new Date("2026-07-17T15:00:00.000Z");
    await expect(
      runWithDatabaseSession(appClient, auth, () =>
        service.reschedule(job.id, { orgId, actor: auth, scheduledStart: nextStart, scheduledEnd: nextEnd })
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { code: "dispatch_reversal_confirmation_required" },
    });

    const rescheduled = await runWithDatabaseSession(appClient, auth, () =>
      service.reschedule(job.id, {
        orgId,
        actor: auth,
        scheduledStart: nextStart,
        scheduledEnd: nextEnd,
        confirmDispatchReversal: true,
      })
    );
    expect(rescheduled.status).toBe("scheduled");

    const reversalEvents = await adminClient.activityEvent.findMany({
      where: { entityId: job.id, eventType: "job.dispatch_reversed" },
    });
    expect(reversalEvents).toHaveLength(1);
    const reversalMetadata = reversalEvents[0].metadataJson as Record<string, unknown>;
    expect(reversalMetadata.previousStatus).toBe("dispatched");
    expect(reversalMetadata.newStatus).toBe("scheduled");

    // Explicit redispatch works from the returned-to-scheduled state.
    const redispatched = await runWithDatabaseSession(appClient, auth, () =>
      service.dispatch(job.id, { orgId, actor: auth })
    );
    expect(redispatched.status).toBe("dispatched");
  });
});
