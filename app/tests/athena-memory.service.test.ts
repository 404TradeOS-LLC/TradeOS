import { createInMemoryAthenaMemoryRepository } from "../modules/athena-memory/fixtures/inMemoryRepository";
import { AthenaMemoryError } from "../modules/athena-memory/errors";
import { createAthenaMemoryService } from "../modules/athena-memory/service";
import type { AthenaMemoryActor } from "../modules/athena-memory/types";
import type { AthenaMemoryRepository } from "../modules/athena-memory/store";

const ORG_A = "org-a";
const ORG_B = "org-b";
const USER_A: AthenaMemoryActor = { orgId: ORG_A, userId: "user-a", role: "owner" };
const USER_A_TECH: AthenaMemoryActor = { orgId: ORG_A, userId: "user-a", role: "technician" };
const USER_B: AthenaMemoryActor = { orgId: ORG_A, userId: "user-b", role: "owner" };
const USER_ORG_B: AthenaMemoryActor = { orgId: ORG_B, userId: "user-c", role: "owner" };
const ADMIN_A: AthenaMemoryActor = { orgId: ORG_A, userId: "admin-a", role: "admin" };
const TECH_A: AthenaMemoryActor = { orgId: ORG_A, userId: "tech-a", role: "technician" };

function buildService() {
  const repository = createInMemoryAthenaMemoryRepository();
  const service = createAthenaMemoryService({ repository });
  return { service, repository };
}

describe("AthenaMemoryService", () => {
  it("1. stores a valid new memory", async () => {
    const { service } = buildService();
    const outcome = await service.remember({
      orgId: ORG_A,
      actor: USER_A,
      scope: "user",
      subjectId: USER_A.userId,
      kind: "preference.response_style",
      value: "concise",
      source: { kind: "user_message", trusted: true },
    });
    expect(outcome.decision).toBe("store");
    expect(outcome.record?.status).toBe("active");
    expect(outcome.record?.confidence).toBeGreaterThan(0);
  });

  it("2. retrieves a stored memory by its stable key", async () => {
    const { service } = buildService();
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.units", value: "imperial", source: { kind: "user_message", trusted: true } });
    const found = await service.recall({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.units" });
    expect(found?.value).toBe("imperial");
    expect(found?.lastAccessedAt).toBeUndefined(); // fixture doesn't echo touch, but recall must not throw
  });

  it("3+5. keyed upsert: a second write with a different value updates rather than duplicates", async () => {
    const { service, repository } = buildService();
    const first = await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });
    const second = await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "casual", source: { kind: "user_message", trusted: true } });

    expect(second.decision).toBe("update");
    expect(second.record?.supersedes).toBe(first.record?.id);

    const active = await repository.findActiveByStableKey(ORG_A, "user", USER_A.userId, "preference.tone");
    expect(active?.id).toBe(second.record?.id);
    expect(active?.value).toBe("casual");

    const previous = await repository.findById(ORG_A, first.record!.id);
    expect(previous?.status).toBe("corrected");
  });

  it("4. ignores a redundant write with an identical value (no duplicate row)", async () => {
    const { service } = buildService();
    const first = await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });
    const second = await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });

    expect(first.decision).toBe("store");
    expect(second.decision).toBe("ignore");
    expect(second.reasonCode).toBe("athena_memory_duplicate_ignored");
    expect(second.record).toBeUndefined();
  });

  it("6. forgets one memory by id", async () => {
    const { service } = buildService();
    const stored = await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });
    const outcome = await service.forget({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, id: stored.record!.id });
    expect(outcome.deletedCount).toBe(1);

    const after = await service.recall({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone" });
    expect(after).toBeNull();
  });

  it("7. forgets a memory by its stable key", async () => {
    const { service } = buildService();
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });
    const outcome = await service.forgetByKey({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone" });
    expect(outcome.deletedCount).toBe(1);
    expect(await service.recall({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone" })).toBeNull();
  });

  it("forgets all memories for a subject", async () => {
    const { service } = buildService();
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.units", value: "imperial", source: { kind: "user_message", trusted: true } });
    const outcome = await service.forgetAllForSubject({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId });
    expect(outcome.deletedCount).toBe(2);
    expect(await service.list({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId })).toEqual([]);
  });

  it("8. lists memories for a subject", async () => {
    const { service } = buildService();
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.units", value: "imperial", source: { kind: "user_message", trusted: true } });
    const listed = await service.list({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId });
    expect(listed).toHaveLength(2);
  });

  it("9. excludes expired memories from search results", async () => {
    // writePolicy/service.ts refuse an already-past expiresAt at write time
    // (see the "invalid input" test below), so a row only becomes expired
    // by the clock advancing past a previously valid future date - seed the
    // repository directly with an already-expired active row to exercise
    // that read-time exclusion in isolation.
    const repository = createInMemoryAthenaMemoryRepository();
    const service = createAthenaMemoryService({ repository });
    const past = new Date(Date.now() - 1_000).toISOString();
    await repository.create({
      id: "mem-expired",
      version: "1.0.0",
      orgId: ORG_A,
      scope: "user",
      subjectId: USER_A.userId,
      kind: "preference.temporary",
      value: "expires-soon",
      source: { kind: "user_message", trusted: true },
      confidence: 0.6,
      retention: { tier: "short_term", expiresAt: past },
      status: "active",
      visibility: "actor",
      createdByActor: { type: "user", id: USER_A.userId },
      updatedByActor: { type: "user", id: USER_A.userId },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    });

    expect(await service.search({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.temporary" })).toEqual([]);
    expect(await service.recall({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.temporary" })).toBeNull();
  });

  it("10. returns search/list results in deterministic order (newest first)", async () => {
    const { service } = buildService();
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "fact.a", value: "1", source: { kind: "user_message", trusted: true } });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "fact.b", value: "2", source: { kind: "user_message", trusted: true } });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "fact.c", value: "3", source: { kind: "user_message", trusted: true } });

    const first = await service.list({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId });
    const second = await service.list({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId });
    expect(first.map((r) => r.kind)).toEqual(second.map((r) => r.kind));
    expect(first.map((r) => r.kind)).toEqual(["fact.c", "fact.b", "fact.a"]);
  });

  it("11. wrong-user isolation: user B cannot recall, search, list, or forget user A's memory even with the exact id", async () => {
    const { service } = buildService();
    const stored = await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });

    expect(await service.recall({ orgId: ORG_A, actor: USER_B, scope: "user", subjectId: USER_A.userId, kind: "preference.tone" })).toBeNull();
    expect(await service.getById({ orgId: ORG_A, actor: USER_B, id: stored.record!.id })).toBeNull();
    expect(await service.search({ orgId: ORG_A, actor: USER_B, scope: "user", subjectId: USER_A.userId })).toEqual([]);
    expect(await service.list({ orgId: ORG_A, actor: USER_B, scope: "user", subjectId: USER_A.userId })).toEqual([]);

    await expect(service.forget({ orgId: ORG_A, actor: USER_B, scope: "user", subjectId: USER_A.userId, id: stored.record!.id })).rejects.toBeInstanceOf(AthenaMemoryError);
    await expect(service.remember({ orgId: ORG_A, actor: USER_B, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "hijacked", source: { kind: "user_message", trusted: true } })).rejects.toBeInstanceOf(AthenaMemoryError);

    // Confirm user A's memory is genuinely untouched.
    expect(await service.recall({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone" })).not.toBeNull();
  });

  it("12. wrong-org isolation: an actor from a different org cannot retrieve or mutate memory by orgId or by id", async () => {
    const { service } = buildService();
    const stored = await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "formal", source: { kind: "user_message", trusted: true } });

    // Same orgId param as the record, but the actor belongs to a different org.
    await expect(service.recall({ orgId: ORG_A, actor: USER_ORG_B, scope: "user", subjectId: USER_A.userId, kind: "preference.tone" })).rejects.toBeInstanceOf(AthenaMemoryError);
    await expect(service.getById({ orgId: ORG_A, actor: USER_ORG_B, id: stored.record!.id })).rejects.toBeInstanceOf(AthenaMemoryError);
    await expect(service.forget({ orgId: ORG_A, actor: USER_ORG_B, scope: "user", subjectId: USER_A.userId, id: stored.record!.id })).rejects.toBeInstanceOf(AthenaMemoryError);

    // Recall using the actor's own org still finds nothing (never crosses orgs).
    expect(await service.recall({ orgId: ORG_B, actor: USER_ORG_B, scope: "user", subjectId: USER_A.userId, kind: "preference.tone" })).toBeNull();
  });

  it("13. rejects prohibited secret-like content end-to-end through remember()", async () => {
    const { service } = buildService();
    const outcome = await service.remember({
      orgId: ORG_A,
      actor: USER_A,
      scope: "user",
      subjectId: USER_A.userId,
      kind: "integration.notes",
      // Built via concatenation, not a literal token (see writePolicy.test.ts's
      // identical fixture comment) - avoids tripping secret-scanning on an
      // intentionally secret-shaped test value.
      value: { note: "connected the account", apiKey: ["sk", "live", "abcdefghijklmnopqrstuvwx"].join("_") },
      source: { kind: "user_message", trusted: true },
    });
    expect(outcome.decision).toBe("ignore");
    expect(outcome.reasonCode).toBe("athena_memory_write_rejected_prohibited_content");
    expect(await service.list({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId })).toEqual([]);
  });

  it("14. rejects invalid input: missing kind, out-of-range confidence, already-expired retention, org mismatch", async () => {
    const { service } = buildService();

    await expect(
      service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "", value: "x", source: { kind: "user_message", trusted: true } })
    ).rejects.toBeInstanceOf(AthenaMemoryError);

    await expect(
      service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "fact.x", value: "x", source: { kind: "user_message", trusted: true }, confidence: 1.5 })
    ).rejects.toBeInstanceOf(AthenaMemoryError);

    const past = new Date(Date.now() - 1_000).toISOString();
    await expect(
      service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "fact.x", value: "x", source: { kind: "user_message", trusted: true }, retention: { tier: "short_term", expiresAt: past } })
    ).rejects.toBeInstanceOf(AthenaMemoryError);

    // orgId param does not match the caller's own actor.orgId.
    await expect(
      service.remember({ orgId: ORG_B, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "fact.x", value: "x", source: { kind: "user_message", trusted: true } })
    ).rejects.toBeInstanceOf(AthenaMemoryError);
  });

  it("15. wraps a repository failure as a storage-unavailable AthenaMemoryError, never leaking the raw error", async () => {
    const failingRepository: AthenaMemoryRepository = {
      findById: jest.fn(),
      findActiveByStableKey: jest.fn().mockRejectedValue(new Error("connection reset by peer: db-internal-detail")),
      listActive: jest.fn(),
      create: jest.fn(),
      correct: jest.fn(),
      touchLastAccessed: jest.fn(),
      forgetById: jest.fn(),
      forgetByStableKey: jest.fn(),
      forgetAllForSubject: jest.fn(),
    };
    const service = createAthenaMemoryService({ repository: failingRepository });

    let caught: unknown;
    try {
      await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "fact.x", value: "x", source: { kind: "user_message", trusted: true } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AthenaMemoryError);
    const memoryError = caught as AthenaMemoryError;
    expect(memoryError.reasonCode).toBe("storage_unavailable");
    expect(memoryError.publicError.safeSummary).not.toContain("db-internal-detail");
  });

  it("18. rejects malformed (non-object) metadata", async () => {
    const { service } = buildService();
    await expect(
      service.remember({
        orgId: ORG_A,
        actor: USER_A,
        scope: "user",
        subjectId: USER_A.userId,
        kind: "fact.x",
        value: "x",
        source: { kind: "user_message", trusted: true },
        metadata: "not-an-object" as never,
      })
    ).rejects.toBeInstanceOf(AthenaMemoryError);
  });

  it("19. repeated remember() calls converge deterministically (sequential update safety)", async () => {
    const { service, repository } = buildService();
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "v1", source: { kind: "user_message", trusted: true } });
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "v2", source: { kind: "user_message", trusted: true } });
    await service.remember({ orgId: ORG_A, actor: USER_A, scope: "user", subjectId: USER_A.userId, kind: "preference.tone", value: "v3", source: { kind: "user_message", trusted: true } });

    const active = await repository.findActiveByStableKey(ORG_A, "user", USER_A.userId, "preference.tone");
    expect(active?.value).toBe("v3");
    // Exactly one active row ever exists for this stable key.
    const all = await repository.listActive(ORG_A, "user", USER_A.userId, "preference.tone", 10);
    expect(all).toHaveLength(1);
  });

  it("organization-scope memory requires the correct subjectId and an admin-capable role to write", async () => {
    const { service } = buildService();
    await expect(
      service.remember({ orgId: ORG_A, actor: ADMIN_A, scope: "organization", subjectId: "not-the-org-id", kind: "policy.approval_threshold", value: 1000, source: { kind: "admin_policy", trusted: true } })
    ).rejects.toBeInstanceOf(AthenaMemoryError);

    await expect(
      service.remember({ orgId: ORG_A, actor: TECH_A, scope: "organization", subjectId: ORG_A, kind: "policy.approval_threshold", value: 1000, source: { kind: "admin_policy", trusted: true } })
    ).rejects.toBeInstanceOf(AthenaMemoryError);

    const outcome = await service.remember({ orgId: ORG_A, actor: ADMIN_A, scope: "organization", subjectId: ORG_A, kind: "policy.approval_threshold", value: 1000, source: { kind: "admin_policy", trusted: true } });
    expect(outcome.decision).toBe("store");

    // Any org member can read organization-scope memory.
    const read = await service.recall({ orgId: ORG_A, actor: TECH_A, scope: "organization", subjectId: ORG_A, kind: "policy.approval_threshold" });
    expect(read?.value).toBe(1000);
  });

  it("any role may manage their own user-scope memory (no elevated permission required)", async () => {
    const { service } = buildService();
    const outcome = await service.remember({ orgId: ORG_A, actor: USER_A_TECH, scope: "user", subjectId: USER_A_TECH.userId, kind: "preference.tone", value: "casual", source: { kind: "user_message", trusted: true } });
    expect(outcome.decision).toBe("store");
  });
});
