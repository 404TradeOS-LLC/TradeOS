import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { createPrismaAthenaEventRepository } from "../modules/athena-events/store";
import {
  recordCanonicalEventPublishFailure,
  runWithRequiredCanonicalEvents,
} from "../modules/athena-events/transactionalContext";
import type { AthenaBusinessEvent } from "../modules/athena-events/types";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgId = "54000000-0000-0000-0000-000000000001";
const adminUserId = "54000000-0000-0000-0000-000000000011";
const membershipId = "54000000-0000-0000-0000-000000000021";
const customerId = "54000000-0000-0000-0000-000000000031";
const serviceAddressId = "54000000-0000-0000-0000-000000000032";
const projectId = "54000000-0000-0000-0000-000000000033";
const jobId = "54000000-0000-0000-0000-000000000034";
const originalStart = new Date("2026-08-11T13:00:00.000Z");
const originalEnd = new Date("2026-08-11T15:00:00.000Z");
const attemptedStart = new Date("2026-08-12T13:00:00.000Z");
const attemptedEnd = new Date("2026-08-12T15:00:00.000Z");
const concurrentEventIdA = "54000000-0000-0000-0000-000000000041";
const concurrentEventIdB = "54000000-0000-0000-0000-000000000042";
const concurrentIdempotencyKey = `job:${jobId}:transactional-race:v1`;

const auth = { userId: adminUserId, orgId, role: "admin" as const };

describe("transactional canonical event rollback against live PostgreSQL", () => {
  beforeAll(async () => {
    await adminClient.organization.create({ data: { id: orgId, name: "Athena Transaction Rollback Org" } });
    await adminClient.appUser.create({
      data: {
        id: adminUserId,
        authSubject: "athena-transaction-rollback-admin",
        email: "athena-transaction-rollback-admin@example.com",
      },
    });
    await adminClient.organizationMembership.create({
      data: { id: membershipId, orgId, userId: adminUserId, role: "admin", status: "active" },
    });
    await adminClient.customer.create({ data: { id: customerId, orgId, name: "Athena Rollback Customer" } });
    await adminClient.serviceAddress.create({
      data: {
        id: serviceAddressId,
        orgId,
        customerId,
        label: "Primary",
        addressLine1: "1 Transaction Way",
        city: "Indianapolis",
        state: "IN",
        postalCode: "46201",
        isPrimary: true,
      },
    });
    await adminClient.project.create({
      data: { id: projectId, orgId, customerId, name: "Athena Transaction Rollback Project" },
    });
    await adminClient.job.create({
      data: {
        id: jobId,
        orgId,
        projectId,
        customerId,
        serviceAddressId,
        jobNumber: "JOB-ATHENA-TX-ROLLBACK",
        title: "Canonical event rollback fixture",
        jobType: "Service",
        status: "scheduled",
        priority: "medium",
        scheduledStart: originalStart,
        scheduledEnd: originalEnd,
        estimatedDurationMinutes: 120,
        createdById: adminUserId,
      },
    });
  });

  afterAll(async () => {
    await adminClient.organization.delete({ where: { id: orgId } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("rolls back a JobScheduled business mutation when canonical event persistence fails", async () => {
    const publishError = new Error("simulated canonical event insert failure");

    await expect(
      runWithDatabaseSession(
        appClient,
        auth,
        () =>
          runWithRequiredCanonicalEvents(["JobScheduled"], async () => {
            await prisma.job.update({
              where: { id: jobId },
              data: {
                scheduledStart: attemptedStart,
                scheduledEnd: attemptedEnd,
              },
            });

            recordCanonicalEventPublishFailure("JobScheduled", publishError);
            return { id: jobId };
          }),
        "integration-test"
      )
    ).rejects.toBe(publishError);

    const persisted = await adminClient.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(persisted.scheduledStart?.toISOString()).toBe(originalStart.toISOString());
    expect(persisted.scheduledEnd?.toISOString()).toBe(originalEnd.toISOString());
  });

  it("reconciles concurrent inserts for one idempotency key without aborting either transaction", async () => {
    const repository = createPrismaAthenaEventRepository();
    const eventA = buildConcurrentEvent(concurrentEventIdA, "corr-a");
    const eventB = buildConcurrentEvent(concurrentEventIdB, "corr-b");

    const [resultA, resultB] = await Promise.all([
      runWithDatabaseSession(
        appClient,
        auth,
        () => repository.createEventWithDeliveries(eventA, []),
        "integration-test"
      ),
      runWithDatabaseSession(
        appClient,
        auth,
        () => repository.createEventWithDeliveries(eventB, []),
        "integration-test"
      ),
    ]);

    expect(resultA.event.id).toBe(resultB.event.id);
    expect([concurrentEventIdA, concurrentEventIdB]).toContain(resultA.event.id);
    expect(resultA.deliveries).toHaveLength(0);
    expect(resultB.deliveries).toHaveLength(0);

    const rows = await adminClient.athenaEvent.findMany({
      where: { orgId, idempotencyKey: concurrentIdempotencyKey },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(resultA.event.id);
  });
});

function buildConcurrentEvent(id: string, correlationId: string): AthenaBusinessEvent {
  return {
    id,
    orgId,
    type: "JobScheduled",
    version: "1.0.0",
    entity: { type: "job", id: jobId },
    actor: { type: "user", id: adminUserId },
    occurredAt: new Date("2026-08-12T16:00:00.000Z").toISOString(),
    payload: { jobId, projectId, customerId },
    correlationId,
    idempotencyKey: concurrentIdempotencyKey,
    isReplay: false,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Athena transactional rollback integration tests`);
  return value;
}
