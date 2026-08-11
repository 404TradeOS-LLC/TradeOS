import { AthenaEventError } from "../modules/athena-events/errors";
import { createInMemoryAthenaEventRepository } from "../modules/athena-events/fixtures/inMemoryRepository";
import { publishAthenaEvent } from "../modules/athena-events/publisher";
import type { AthenaPublishEventInput } from "../modules/athena-events/types";

const ORG_ID = "org-1";

function buildInput(overrides: Partial<AthenaPublishEventInput> = {}): AthenaPublishEventInput {
  return {
    orgId: ORG_ID,
    type: "ProposalSent",
    version: "1.0.0",
    entity: { type: "proposal", id: "proposal-1" },
    actor: { type: "user", id: "user-1" },
    payload: { proposalId: "proposal-1" },
    correlationId: "corr-1",
    idempotencyKey: "proposal-1:sent:v1",
    ...overrides,
  };
}

// A11 hardening (docs/athena/09-security/README.md "Secrets, PII, And Data
// Minimization"; athena-events/publisher.ts). Mirrors athena-memory's own
// "reject, never silently redact-and-persist" posture for prohibited
// content - a secret-shaped event payload must never reach storage.
describe("athena-events publisher A11 secret-shaped payload rejection", () => {
  it("rejects a payload whose value matches a secret field-name pattern", async () => {
    const repository = createInMemoryAthenaEventRepository();
    await expect(publishAthenaEvent(repository, buildInput({ payload: { proposalId: "proposal-1", apiKey: "irrelevant-value" } }), [])).rejects.toMatchObject({ reasonCode: "secret_shaped_payload" });
    await expect(publishAthenaEvent(repository, buildInput({ payload: { proposalId: "proposal-1", apiKey: "irrelevant-value" } }), [])).rejects.toBeInstanceOf(AthenaEventError);
  });

  it("rejects a payload whose value matches a secret string pattern regardless of key name", async () => {
    const repository = createInMemoryAthenaEventRepository();
    await expect(publishAthenaEvent(repository, buildInput({ payload: { note: "Bearer abc123.def456-ghi" } }), [])).rejects.toMatchObject({ reasonCode: "secret_shaped_payload" });
  });

  it("creates no event/delivery row for a rejected publish", async () => {
    const repository = createInMemoryAthenaEventRepository();
    await expect(publishAthenaEvent(repository, buildInput({ payload: { apiKey: "irrelevant-value" } }), [])).rejects.toThrow();
    expect(await repository.findByIdempotencyKey(ORG_ID, "proposal-1:sent:v1")).toBeNull();
  });

  it("does not scan Athena's own structural fields (id/type/actor/entity) for secret patterns", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const result = await publishAthenaEvent(repository, buildInput({ idempotencyKey: "AKIAABCDEFGHIJKLMNOP-not-actually-a-secret-field" }), []);
    expect(result.deduplicated).toBe(false);
  });

  it("still accepts an ordinary business payload with no secret-shaped content", async () => {
    const repository = createInMemoryAthenaEventRepository();
    const result = await publishAthenaEvent(repository, buildInput(), []);
    expect(result.deduplicated).toBe(false);
  });
});
