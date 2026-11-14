import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../backend/auth/context";
import { runWithDatabaseSession } from "../db/requestSession";
import { JobsService } from "../modules/jobs/service";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for job from-proposal integration tests`);
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
const serviceAddressId = randomUUID();
const proposalId = randomUUID();
const auth: AuthContext = { userId, orgId, role: "admin", canonicalRole: "admin" };

describe("accepted-proposal job conversion in a request-scoped PostgreSQL transaction", () => {
  beforeAll(async () => {
    await adminClient.organization.create({ data: { id: orgId, name: "Job From-Proposal Integration Org" } });
    await adminClient.appUser.create({
      data: {
        id: userId,
        authSubject: `job-from-proposal-${userId}`,
        email: `job-from-proposal-${userId}@example.com`,
      },
    });
    await adminClient.organizationMembership.create({
      data: { orgId, userId, role: "admin", status: "active" },
    });
    await adminClient.customer.create({ data: { id: customerId, orgId, name: "Job From-Proposal Integration Customer" } });
    await adminClient.project.create({
      data: { id: projectId, orgId, customerId, name: "Concurrent Proposal Job", status: "awarded", jobType: "Cabinet refinishing" },
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
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: orgId } });
    await adminClient.appUser.deleteMany({ where: { id: userId } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("returns one persisted job to concurrent duplicate conversions of the same accepted proposal", async () => {
    const service = new JobsService();
    const input = { orgId, actor: auth, proposalId, serviceAddressId };
    const results = await Promise.all([
      runWithDatabaseSession(appClient, auth, () => service.createFromAcceptedProposal(input)),
      runWithDatabaseSession(appClient, auth, () => service.createFromAcceptedProposal(input)),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(results[0].sourceProposalId).toBe(proposalId);

    const jobs = await adminClient.job.findMany({ where: { orgId, sourceProposalId: proposalId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(results[0].id);
  });

  it("recovers after a competing direct create wins the unique source-proposal index", async () => {
    const sourceProposal = await adminClient.proposal.create({
      data: {
        projectId,
        status: "accepted",
        scopeOfWork: "Refinish the bathroom vanity",
        respondedAt: new Date(),
      },
    });
    const service = new JobsService();
    const competingService = new JobsService();
    const originalCreate = service.create.bind(service);
    const create = jest.spyOn(service, "create").mockImplementationOnce(async (input) => {
      // The conversion has checked for an existing Job. A direct writer does
      // not take the conversion lock and commits before the conversion inserts.
      await runWithDatabaseSession(appClient, auth, () => competingService.create(input));
      return originalCreate(input);
    });

    const recovered = await runWithDatabaseSession(appClient, auth, () =>
      service.createFromAcceptedProposal({ orgId, actor: auth, proposalId: sourceProposal.id, serviceAddressId })
    );

    expect(create).toHaveBeenCalledTimes(1);
    await expect(create.mock.results[0].value).rejects.toMatchObject({ code: "P2002" });
    const jobs = await adminClient.job.findMany({ where: { orgId, sourceProposalId: sourceProposal.id } });
    expect(jobs.map((job) => job.id)).toEqual([recovered.id]);
  });

  it("rejects a second transition that reuses the same stale expectedUpdatedAt token", async () => {
    const service = new JobsService();
    const job = await runWithDatabaseSession(appClient, auth, () =>
      service.createFromAcceptedProposal({ orgId, actor: auth, proposalId, serviceAddressId })
    );

    const read = await adminClient.job.findUniqueOrThrow({ where: { id: job.id } });
    const token = read.updatedAt;

    const scheduled = await runWithDatabaseSession(appClient, auth, () =>
      service.schedule(job.id, {
        orgId,
        actor: auth,
        scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
        scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
        expectedUpdatedAt: token,
      })
    );
    expect(scheduled.status).toBe("scheduled");
    expect(new Date(scheduled.updatedAt).getTime()).toBeGreaterThan(token.getTime());

    // The same token is now stale: the schedule above bumped updatedAt.
    // Dispatch from scheduled would otherwise be valid, so a 409 here can
    // only come from the optimistic-concurrency guard.
    await expect(
      runWithDatabaseSession(appClient, auth, () =>
        service.dispatch(job.id, { orgId, actor: auth, expectedUpdatedAt: token })
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "This job changed since you opened it. Refresh the source workspace before saving again.",
    });

    const after = await adminClient.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("scheduled");
  });
});
