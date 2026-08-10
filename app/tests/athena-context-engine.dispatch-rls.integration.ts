import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { createDispatchProvider } from "../modules/athena-context-engine/providers/dispatchProvider";

// Live RLS coverage for the A3 dispatch context provider (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Test Requirements": "dispatch
// provider live-RLS integration test... proves the provider inherits RLS
// rather than trusting selectedScope"). Kept as its own file rather than
// appended to tests/rls.integration.ts, same reasoning
// athena-kernel.integration.ts already used: an independently reviewable
// slice that doesn't touch a large shared fixture.
const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "50000000-0000-0000-0000-000000000001";
const orgB = "60000000-0000-0000-0000-000000000002";
const adminA = "50000000-0000-0000-0000-000000000011";
const technicianA1 = "50000000-0000-0000-0000-000000000012";
const technicianA2 = "50000000-0000-0000-0000-000000000013";
const ownerB = "60000000-0000-0000-0000-000000000021";
const membershipAdminA = "50000000-0000-0000-0000-000000000031";
const membershipTechA1 = "50000000-0000-0000-0000-000000000032";
const membershipTechA2 = "50000000-0000-0000-0000-000000000033";
const membershipOwnerB = "60000000-0000-0000-0000-000000000041";

const customerA = "50000000-0000-0000-0000-000000000051";
const serviceAddressA = "50000000-0000-0000-0000-000000000052";
const projectA = "50000000-0000-0000-0000-000000000053";
const jobA = "50000000-0000-0000-0000-000000000054";
const assignmentA1 = "50000000-0000-0000-0000-000000000055";

describe("live row-level security for the A3 dispatch context provider", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Dispatch Context Org A" }, { id: orgB, name: "Dispatch Context Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: adminA, authSubject: "dispatch-ctx-admin-a", email: "dispatch-ctx-admin-a@example.com" },
        { id: technicianA1, authSubject: "dispatch-ctx-tech-a1", email: "dispatch-ctx-tech-a1@example.com" },
        { id: technicianA2, authSubject: "dispatch-ctx-tech-a2", email: "dispatch-ctx-tech-a2@example.com" },
        { id: ownerB, authSubject: "dispatch-ctx-owner-b", email: "dispatch-ctx-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipAdminA, orgId: orgA, userId: adminA, role: "admin", status: "active" },
        { id: membershipTechA1, orgId: orgA, userId: technicianA1, role: "technician", status: "active" },
        { id: membershipTechA2, orgId: orgA, userId: technicianA2, role: "technician", status: "active" },
        { id: membershipOwnerB, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });
    await adminClient.customer.create({ data: { id: customerA, orgId: orgA, name: "Dispatch Context Customer" } });
    await adminClient.serviceAddress.create({
      data: { id: serviceAddressA, orgId: orgA, customerId: customerA, label: "Primary", addressLine1: "1 Test Street", city: "Indianapolis", state: "IN", postalCode: "46201", isPrimary: true },
    });
    await adminClient.project.create({ data: { id: projectA, orgId: orgA, customerId: customerA, name: "Dispatch Context Project" } });
    await adminClient.job.create({
      data: {
        id: jobA,
        orgId: orgA,
        projectId: projectA,
        customerId: customerA,
        serviceAddressId: serviceAddressA,
        jobNumber: "JOB-DISPATCH-CTX-1",
        title: "Only the assigned technician should see this",
        jobType: "HVAC Service",
        status: "scheduled",
        priority: "high",
        scheduledStart: new Date("2026-08-11T13:00:00.000Z"),
        scheduledEnd: new Date("2026-08-11T15:00:00.000Z"),
        estimatedDurationMinutes: 120,
        createdById: adminA,
      },
    });
    await adminClient.jobAssignment.create({
      data: { id: assignmentA1, orgId: orgA, jobId: jobA, userId: technicianA1, assignmentRole: "lead", isLead: true, assignedById: adminA },
    });
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("lets the assigned technician see the job through the dispatch provider", async () => {
    const provider = createDispatchProvider();
    const result = await inSession(technicianA1, orgA, "technician", () =>
      provider.fetch({ orgId: orgA, actor: { userId: technicianA1, role: "technician" }, selectedScope: {}, deadline: new Date(Date.now() + 5_000), cancellationSignal: new AbortController().signal })
    );
    expect(result.data.jobs.map((job) => job.jobId)).toContain(jobA);
  });

  it("hides the job from a peer technician in the same org who is not assigned (object-scope, not just org-scope)", async () => {
    const provider = createDispatchProvider();
    const result = await inSession(technicianA2, orgA, "technician", () =>
      provider.fetch({ orgId: orgA, actor: { userId: technicianA2, role: "technician" }, selectedScope: {}, deadline: new Date(Date.now() + 5_000), cancellationSignal: new AbortController().signal })
    );
    expect(result.data.jobs.map((job) => job.jobId)).not.toContain(jobA);
  });

  it("lets an org admin see the job regardless of assignment", async () => {
    const provider = createDispatchProvider();
    const result = await inSession(adminA, orgA, "admin", () =>
      provider.fetch({ orgId: orgA, actor: { userId: adminA, role: "admin" }, selectedScope: {}, deadline: new Date(Date.now() + 5_000), cancellationSignal: new AbortController().signal })
    );
    expect(result.data.jobs.map((job) => job.jobId)).toContain(jobA);
  });

  it("never exposes another organization's job, even to that org's owner", async () => {
    const provider = createDispatchProvider();
    const result = await inSession(ownerB, orgB, "owner", () =>
      provider.fetch({ orgId: orgB, actor: { userId: ownerB, role: "owner" }, selectedScope: {}, deadline: new Date(Date.now() + 5_000), cancellationSignal: new AbortController().signal })
    );
    expect(result.data.jobs.map((job) => job.jobId)).not.toContain(jobA);
    expect(result.data.total).toBe(0);
  });

  it("never carries the ambient app-level prisma proxy outside a scoped session (sanity: unscoped read returns nothing usable)", async () => {
    // Establishes that this test file's assertions above are meaningful:
    // an unscoped read through the same `prisma` proxy the provider uses
    // returns zero rows, proving the RLS session (not incidental query
    // shape) is what scopes the results above.
    const rows = await prisma.job.findMany({ where: { id: jobA } });
    expect(rows).toHaveLength(0);
  });
});

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "integration-test");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live RLS integration tests`);
  return value;
}
