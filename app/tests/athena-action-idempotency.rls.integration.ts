import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import {
  buildAthenaIdempotencyScopeKey,
  createPrismaAthenaIdempotencyStore,
  type AthenaCompletedActionOutcome,
} from "../modules/athena-action-engine/idempotency";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "d1000000-0000-0000-0000-000000000001";
const orgB = "d2000000-0000-0000-0000-000000000002";
const ownerA = "d1000000-0000-0000-0000-000000000011";
const peerA = "d1000000-0000-0000-0000-000000000012";
const ownerB = "d2000000-0000-0000-0000-000000000021";
const membershipOwnerA = "d1000000-0000-0000-0000-000000000031";
const membershipPeerA = "d1000000-0000-0000-0000-000000000032";
const membershipOwnerB = "d2000000-0000-0000-0000-000000000041";
const toolId = "tradeos.athena.fixture.durable-idempotency";
const toolVersion = "1.0.0";

describe("live row-level security for Athena action idempotency", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Idempotency Org A" }, { id: orgB, name: "Idempotency Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "idem-owner-a", email: "idem-owner-a@example.com" },
        { id: peerA, authSubject: "idem-peer-a", email: "idem-peer-a@example.com" },
        { id: ownerB, authSubject: "idem-owner-b", email: "idem-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipOwnerA, orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { id: membershipPeerA, orgId: orgA, userId: peerA, role: "technician", status: "active" },
        { id: membershipOwnerB, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("persists a completed outcome across fresh store instances", async () => {
    const key = `restart-${randomUUID()}`;
    const scope = buildAthenaIdempotencyScopeKey(orgA, toolId, toolVersion, key);
    const firstStore = createPrismaAthenaIdempotencyStore();
    const first = await inSession(ownerA, orgA, "owner", () => firstStore.reserve(scope));
    expect(first.outcome).toBe("new");

    const original = completedOutcome(orgA, ownerA, key, "persisted");
    await inSession(ownerA, orgA, "owner", () => firstStore.complete(scope, original));

    const freshStore = createPrismaAthenaIdempotencyStore();
    const duplicate = await inSession(ownerA, orgA, "owner", () => freshStore.reserve(scope));
    expect(duplicate.outcome).toBe("duplicate");
    expect(duplicate.existing?.action.id).toBe(original.action.id);
    expect(duplicate.existing?.result.toolResult.data).toEqual({ value: "persisted" });
  });

  it("allows only one concurrent claimant for the same actor/org/tool/version/key", async () => {
    const key = `race-${randomUUID()}`;
    const scope = buildAthenaIdempotencyScopeKey(orgA, toolId, toolVersion, key);
    const store = createPrismaAthenaIdempotencyStore();

    const results = await Promise.all([
      inSession(ownerA, orgA, "owner", () => store.reserve(scope)),
      inSession(ownerA, orgA, "owner", () => store.reserve(scope)),
    ]);

    expect(results.filter((result) => result.outcome === "new")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "duplicate")).toHaveLength(1);
  });

  it("fails closed when a peer actor in the same organization reuses another actor's key", async () => {
    const key = `actor-${randomUUID()}`;
    const scope = buildAthenaIdempotencyScopeKey(orgA, toolId, toolVersion, key);
    const store = createPrismaAthenaIdempotencyStore();
    expect((await inSession(ownerA, orgA, "owner", () => store.reserve(scope))).outcome).toBe("new");

    await expect(inSession(peerA, orgA, "technician", () => store.reserve(scope))).rejects.toThrow(/another actor|not visible/i);
  });

  it("keeps the same literal idempotency key independent across organizations", async () => {
    const literalKey = `cross-org-${randomUUID()}`;
    const scopeA = buildAthenaIdempotencyScopeKey(orgA, toolId, toolVersion, literalKey);
    const scopeB = buildAthenaIdempotencyScopeKey(orgB, toolId, toolVersion, literalKey);
    const store = createPrismaAthenaIdempotencyStore();

    const [resultA, resultB] = await Promise.all([
      inSession(ownerA, orgA, "owner", () => store.reserve(scopeA)),
      inSession(ownerB, orgB, "owner", () => store.reserve(scopeB)),
    ]);

    expect(resultA.outcome).toBe("new");
    expect(resultB.outcome).toBe("new");
  });
});

function completedOutcome(orgId: string, actorUserId: string, idempotencyKey: string, value: string): AthenaCompletedActionOutcome<{ value: string }> {
  const actionId = randomUUID();
  const executionId = randomUUID();
  const traceId = randomUUID();
  const executor = { kind: "tool" as const, name: "Durable Idempotency", category: "system" as const, toolId, toolVersion };
  return {
    action: {
      id: actionId,
      version: "1.0.0",
      orgId,
      actorUserId,
      name: "Durable Idempotency",
      toolId,
      toolVersion,
      input: { value },
      risk: "low",
      approvalRequirement: "not_required",
      idempotencyKey,
      status: "succeeded",
      attempt: 1,
      executor,
      compensationPolicy: "none",
    },
    result: {
      version: "1.0.0",
      actionId,
      state: "succeeded",
      name: "Durable Idempotency",
      toolId,
      toolVersion,
      approvalRequirement: "not_required",
      idempotencyKey,
      executor,
      compensationPolicy: "none",
      toolResult: {
        success: true,
        summary: "Persisted durable idempotency outcome",
        data: { value },
        events: [],
        warnings: [],
        followUps: [],
        telemetry: { traceId, executionId },
      },
    },
  };
}

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "integration-test");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live RLS integration tests`);
  return value;
}
