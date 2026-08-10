import { createInMemoryAthenaMemoryRepository } from "../modules/athena-memory/fixtures/inMemoryRepository";
import { AthenaMemoryError } from "../modules/athena-memory/errors";
import { createAthenaMemoryService } from "../modules/athena-memory/service";
import type { AthenaMemoryActor, AthenaMemoryRecord } from "../modules/athena-memory/types";

const ORG = "org-a";
const OWNER: AthenaMemoryActor = { orgId: ORG, userId: "owner-a", role: "owner" };

function buildService() {
  const repository = createInMemoryAthenaMemoryRepository();
  return { repository, service: createAthenaMemoryService({ repository }) };
}

function record(overrides: Partial<AthenaMemoryRecord>): AthenaMemoryRecord {
  const now = new Date().toISOString();
  return {
    id: "memory-a",
    version: "1.0.0",
    orgId: ORG,
    scope: "user",
    subjectId: OWNER.userId,
    kind: "preference.units",
    value: "imperial",
    source: { kind: "user_message", trusted: true },
    confidence: 0.8,
    retention: { tier: "standard" },
    status: "active",
    visibility: "actor",
    createdByActor: { type: "user", id: OWNER.userId },
    updatedByActor: { type: "user", id: OWNER.userId },
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides,
  };
}

describe("A7 memory security regressions", () => {
  it.each(["project", "job"] as const)("fails closed for unresolved %s object scope reads and writes", async (scope) => {
    const { repository, service } = buildService();
    await repository.create(
      record({
        id: `memory-${scope}`,
        scope,
        subjectId: `${scope}-outside-object-scope`,
        kind: "preference.test",
        visibility: "organization",
      })
    );

    expect(await service.recall({ orgId: ORG, actor: OWNER, scope, subjectId: `${scope}-outside-object-scope`, kind: "preference.test" })).toBeNull();
    expect(await service.search({ orgId: ORG, actor: OWNER, scope, subjectId: `${scope}-outside-object-scope` })).toEqual([]);
    expect(await service.list({ orgId: ORG, actor: OWNER, scope, subjectId: `${scope}-outside-object-scope` })).toEqual([]);
    expect(await service.getById({ orgId: ORG, actor: OWNER, id: `memory-${scope}` })).toBeNull();

    await expect(
      service.remember({
        orgId: ORG,
        actor: OWNER,
        scope,
        subjectId: `${scope}-outside-object-scope`,
        kind: "preference.test",
        value: "blocked",
        source: { kind: "admin_policy", trusted: true },
      })
    ).rejects.toBeInstanceOf(AthenaMemoryError);

    await expect(
      service.forgetByKey({ orgId: ORG, actor: OWNER, scope, subjectId: `${scope}-outside-object-scope`, kind: "preference.test" })
    ).rejects.toBeInstanceOf(AthenaMemoryError);
  });

  it("getById excludes corrected records from the caller-facing memory API", async () => {
    const { repository, service } = buildService();
    await repository.create(record({ id: "corrected-memory", status: "corrected", value: "stale-value" }));
    expect(await service.getById({ orgId: ORG, actor: OWNER, id: "corrected-memory" })).toBeNull();
  });

  it("getById excludes expired active records from the caller-facing memory API", async () => {
    const { repository, service } = buildService();
    await repository.create(
      record({
        id: "expired-memory",
        retention: { tier: "short_term", expiresAt: new Date(Date.now() - 1_000).toISOString() },
      })
    );
    expect(await service.getById({ orgId: ORG, actor: OWNER, id: "expired-memory" })).toBeNull();
  });
});
