import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithSessionActor } from "../db/requestSession";
import { resolveAuthContext } from "../backend/auth/session";
import type { CanonicalRole, SupportedRole } from "../domain";
import { getRolePermissions } from "../domain";
import { AthenaKernelService } from "../modules/athena-kernel/service";
import type { AthenaProviderAdapter } from "../modules/athena-kernel/provider";
import type { AthenaActorContext } from "../modules/athena-kernel/types";
import { getExecutionRecord } from "../modules/athena-kernel/executionStore";

// Live PostgreSQL coverage for the Fluid PR-4 transaction split
// (docs/CURRENT_STATE.md: before splitting the Athena transaction, require
// PostgreSQL coverage for an allowed member, an inactive membership, a
// foreign organization, and successive calls by different tenants on a
// reused connection).
//
// The chat route runs outside the request-scoped RLS transaction: the
// controller establishes the validated session actor and each persist opens
// its own short RLS session from it. These tests prove, against real
// PostgreSQL with forced RLS, that the split preserves the tenant-isolation
// guarantees and that no transaction is held across the provider wait.
//
// Fixture UUIDs use the 55000000 range so they cannot collide with the
// 30000000/40000000 fixtures in tests/athena-kernel.integration.ts or the
// 50000000/60000000 fixtures in
// tests/athena-context-engine.dispatch-rls.integration.ts when the whole
// integration suite shares one database (the 50000000 range collided with
// dispatch-rls and failed beforeAll with a unique-constraint error).
const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "55000000-0000-0000-0000-000000000001";
const orgB = "55000000-0000-0000-0000-000000000002";
const techA1 = "55000000-0000-0000-0000-000000000011";
const adminA = "55000000-0000-0000-0000-000000000012";
const inactiveUser = "55000000-0000-0000-0000-000000000013";
const suspendedUser = "55000000-0000-0000-0000-000000000014";
const ownerB = "55000000-0000-0000-0000-000000000021";

const draftEnv = { ATHENA_PROVIDER_MODE: "fake", ATHENA_DRAFT_RESPONSES_ENABLED: "true" } as NodeJS.ProcessEnv;

function actor(userId: string, orgId: string, role: CanonicalRole): AthenaActorContext {
  return { userId, orgId, role, permissions: [...getRolePermissions(role)] };
}

function sessionActor(userId: string, orgId: string, role: SupportedRole) {
  return { userId, orgId, role };
}

describe("Athena chat transaction split against live PostgreSQL (Fluid PR-4)", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "TxSplit Org A" }, { id: orgB, name: "TxSplit Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: techA1, authSubject: "txsplit-tech-a1", email: "txsplit-tech-a1@example.com" },
        { id: adminA, authSubject: "txsplit-admin-a", email: "txsplit-admin-a@example.com" },
        { id: inactiveUser, authSubject: "txsplit-inactive-a", email: "txsplit-inactive-a@example.com", isActive: false },
        { id: suspendedUser, authSubject: "txsplit-suspended-a", email: "txsplit-suspended-a@example.com" },
        { id: ownerB, authSubject: "txsplit-owner-b", email: "txsplit-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: "55000000-0000-0000-0000-000000000031", orgId: orgA, userId: techA1, role: "technician", status: "active" },
        { id: "55000000-0000-0000-0000-000000000032", orgId: orgA, userId: adminA, role: "admin", status: "active" },
        { id: "55000000-0000-0000-0000-000000000033", orgId: orgA, userId: inactiveUser, role: "technician", status: "active" },
        { id: "55000000-0000-0000-0000-000000000034", orgId: orgA, userId: suspendedUser, role: "technician", status: "suspended" },
        { id: "55000000-0000-0000-0000-000000000041", orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });
  });

  afterAll(async () => {
    // Deleting the orgs cascades executions/memberships/transitions, which
    // clears the Restrict on AthenaExecution.actor; the AppUser rows are NOT
    // org-owned, so delete them explicitly — otherwise a re-run against the
    // same database trips the unique constraint on id/authSubject/email.
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await adminClient.appUser.deleteMany({ where: { id: { in: [techA1, adminA, inactiveUser, suspendedUser, ownerB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("allowed member: a chat holds no transaction during the provider wait and its records commit", async () => {
    let releaseProvider!: (result: { text: string; provider: string; model: string; providerVersion: string }) => void;
    let providerCalledResolve!: () => void;
    const providerCalled = new Promise<void>((resolve) => {
      providerCalledResolve = resolve;
    });
    const provider: AthenaProviderAdapter = {
      generateDraft: jest.fn(() => {
        providerCalledResolve();
        return new Promise((resolve) => {
          releaseProvider = resolve;
        });
      }),
    };

    const service = new AthenaKernelService();
    const resultPromise = runWithSessionActor(sessionActor(techA1, orgA, "technician"), () =>
      service.handleRequest({
        request: { message: "What is the status of this project this week?", requestSource: "http" },
        actor: actor(techA1, orgA, "technician"),
        requestId: "req-txsplit-delay",
        env: draftEnv,
        provider,
      })
    );
    await providerCalled;

    // The execution record is already committed: it is visible from a
    // second connection (the admin client, which bypasses RLS) while the
    // provider is still pending. Inside an uncommitted request transaction
    // it would be invisible here — this is the live-DB proof that no
    // transaction is held across the provider wait.
    const midFlight = await adminClient.athenaExecution.findFirst({ where: { requestId: "req-txsplit-delay" } });
    expect(midFlight).not.toBeNull();
    expect(midFlight?.orgId).toBe(orgA);
    expect(midFlight?.actorUserId).toBe(techA1);
    expect(["created", "context_building", "routing", "planning", "policy_check"]).toContain(midFlight?.state);

    releaseProvider({ text: "Here is your draft.", provider: "fake", model: "athena-fake-v1", providerVersion: "1.0.0" });
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.state).toBe("succeeded");
    const stored = await adminClient.athenaExecution.findFirst({ where: { id: result.executionId } });
    expect(stored?.orgId).toBe(orgA);
    expect(stored?.state).toBe("succeeded");
    const generations = await adminClient.athenaGenerationRun.findMany({ where: { executionId: result.executionId } });
    expect(generations).toHaveLength(1);
    expect(generations[0]?.orgId).toBe(orgA);
  }, 30_000);

  it("inactive membership: the auth boundary denies an inactive user and a user without an active membership", async () => {
    // resolveAuthContext is the gate requireAuth runs before the controller
    // ever establishes the session actor PR-4's short sessions are built
    // from — an inactive identity can never obtain that actor.
    await expect(resolveAuthContext({ sub: "txsplit-inactive-a", orgId: orgA })).rejects.toThrow(
      "not provisioned in this organization"
    );
    await expect(resolveAuthContext({ sub: "txsplit-suspended-a", orgId: orgA })).rejects.toThrow(
      "does not belong to the requested organization"
    );
    const allowed = await resolveAuthContext({ sub: "txsplit-tech-a1", orgId: orgA });
    expect(allowed).toMatchObject({ userId: techA1, orgId: orgA, role: "technician" });
  });

  it("foreign organization: a short session in another org sees no org-A execution", async () => {
    const orgAExecution = await adminClient.athenaExecution.findFirst({ where: { requestId: "req-txsplit-delay" } });
    expect(orgAExecution).not.toBeNull();

    // The org-B owner reads through a short RLS session (runWithSessionActor
    // + the store's own runInDatabaseTransaction) — the org-A row is
    // invisible, even though an owner can administer their own org.
    const asOwnerB = await runWithSessionActor(sessionActor(ownerB, orgB, "owner"), () =>
      getExecutionRecord(orgAExecution!.id)
    );
    expect(asOwnerB).toBeNull();
    const rowsAsOwnerB = await runWithSessionActor(sessionActor(ownerB, orgB, "owner"), () =>
      prisma.athenaExecution.findMany({ where: { id: orgAExecution!.id } })
    );
    expect(rowsAsOwnerB).toHaveLength(0);

    // The org-A admin sees it through the same short-session path.
    const asAdminA = await runWithSessionActor(sessionActor(adminA, orgA, "admin"), () =>
      getExecutionRecord(orgAExecution!.id)
    );
    expect(asAdminA?.id).toBe(orgAExecution!.id);
  });

  it("successive calls by different tenants on a reused connection leave no identity behind", async () => {
    const quickProvider: AthenaProviderAdapter = {
      generateDraft: jest.fn(async () => ({ text: "draft", provider: "fake", model: "athena-fake-v1", providerVersion: "1.0.0" })),
    };
    const service = new AthenaKernelService();

    // Both chats run through the same basePrisma singleton (connection
    // pool of one in this environment): org A first, then org B.
    const resultA = await runWithSessionActor(sessionActor(techA1, orgA, "technician"), () =>
      service.handleRequest({
        request: { message: "What is the status of this project this week?", requestSource: "http" },
        actor: actor(techA1, orgA, "technician"),
        requestId: "req-txsplit-tenant-a",
        env: draftEnv,
        provider: quickProvider,
      })
    );
    const resultB = await runWithSessionActor(sessionActor(ownerB, orgB, "owner"), () =>
      service.handleRequest({
        request: { message: "What is the status of this project this week?", requestSource: "http" },
        actor: actor(ownerB, orgB, "owner"),
        requestId: "req-txsplit-tenant-b",
        env: draftEnv,
        provider: quickProvider,
      })
    );
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);

    const storedA = await adminClient.athenaExecution.findFirst({ where: { id: resultA.executionId } });
    const storedB = await adminClient.athenaExecution.findFirst({ where: { id: resultB.executionId } });
    expect(storedA?.orgId).toBe(orgA);
    expect(storedA?.actorUserId).toBe(techA1);
    expect(storedB?.orgId).toBe(orgB);
    expect(storedB?.actorUserId).toBe(ownerB);

    // No identity carries over: a bare read with no session at all sees
    // nothing (the short sessions' set_config is transaction-local and
    // cannot leak onto the reused connection), and the org-A technician
    // cannot see the org-B execution created just before on that same
    // connection.
    const bare = await prisma.athenaExecution.findMany({ where: { id: { in: [resultA.executionId, resultB.executionId] } } });
    expect(bare).toHaveLength(0);
    const crossRead = await runWithSessionActor(sessionActor(techA1, orgA, "technician"), () =>
      getExecutionRecord(resultB.executionId)
    );
    expect(crossRead).toBeNull();
  }, 30_000);
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live RLS integration tests`);
  return value;
}
