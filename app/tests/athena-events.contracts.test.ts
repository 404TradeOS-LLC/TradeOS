import { assertValidAthenaBusinessEvent } from "../modules/athena-events/validation";
import type { AthenaBusinessEvent } from "../modules/athena-events/types";

// Backs the `athena:contracts` gate alongside the kernel/tool-registry/
// context-engine/permissions/planner/action-engine/memory contract tests.
// Exercises assertValidAthenaBusinessEvent, the exact runtime boundary C008
// (docs/athena/contracts/README.md) is enforced through.
function validEvent(): AthenaBusinessEvent {
  return {
    id: "evt-1",
    type: "ProposalSent",
    version: "1.0.0",
    orgId: "org-1",
    entity: { type: "proposal", id: "proposal-1" },
    actor: { type: "user", id: "user-1" },
    occurredAt: "2026-08-10T00:00:00.000Z",
    payload: { projectId: "project-1", customerId: "customer-1" },
    correlationId: "req-abc",
    idempotencyKey: "proposal-1:sent:v1",
  };
}

describe("athena:contracts - business event (C008)", () => {
  it("accepts a conforming event", () => {
    expect(() => assertValidAthenaBusinessEvent(validEvent())).not.toThrow();
  });

  it("accepts every documented actor type", () => {
    for (const type of ["user", "system", "athena"] as const) {
      expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), actor: { type, id: "actor-1" } })).not.toThrow();
    }
  });

  it("accepts a null actor id", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), actor: { type: "system", id: null } })).not.toThrow();
  });

  it("accepts optional causationId, isReplay, and replayedAt", () => {
    const withOptional = { ...validEvent(), causationId: "evt-0", isReplay: true, replayedAt: "2026-08-10T01:00:00.000Z" };
    expect(() => assertValidAthenaBusinessEvent(withOptional)).not.toThrow();
  });

  it("accepts a non-object payload such as null or a primitive", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), payload: null })).not.toThrow();
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), payload: "ok" })).not.toThrow();
  });

  describe("required fields", () => {
    const requiredKeys = ["id", "type", "version", "orgId", "entity", "actor", "occurredAt", "payload", "correlationId", "idempotencyKey"] as const;

    it.each(requiredKeys)("rejects an event missing required key: %s", (key) => {
      const event = validEvent() as unknown as Record<string, unknown>;
      delete event[key];
      expect(() => assertValidAthenaBusinessEvent(event)).toThrow(new RegExp(key));
    });
  });

  it("rejects an event carrying an undocumented top-level key", () => {
    const withExtra = { ...validEvent(), extra: "not allowed" };
    expect(() => assertValidAthenaBusinessEvent(withExtra)).toThrow(/undocumented/);
  });

  it("rejects a non-object value", () => {
    expect(() => assertValidAthenaBusinessEvent("not an event")).toThrow(/object/);
    expect(() => assertValidAthenaBusinessEvent(null)).toThrow(/object/);
  });

  it("rejects a blank id", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), id: "" })).toThrow(/id/);
  });

  it("rejects a blank type", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), type: "" })).toThrow(/type/);
  });

  it("rejects a blank version", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), version: "" })).toThrow(/version/);
  });

  it("rejects a blank orgId", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), orgId: "" })).toThrow(/orgId/);
  });

  it("rejects a blank occurredAt", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), occurredAt: "" })).toThrow(/occurredAt/);
  });

  it("rejects a blank correlationId", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), correlationId: "" })).toThrow(/correlationId/);
  });

  it("rejects a blank idempotencyKey", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), idempotencyKey: "" })).toThrow(/idempotencyKey/);
  });

  describe("malformed entity", () => {
    it("rejects a non-object entity", () => {
      expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), entity: "proposal-1" })).toThrow(/entity/);
    });

    it("rejects an entity missing type", () => {
      expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), entity: { id: "proposal-1" } })).toThrow(/entity\.type/);
    });

    it("rejects an entity with an empty id", () => {
      expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), entity: { type: "proposal", id: "" } })).toThrow(/entity\.id/);
    });
  });

  describe("malformed actor", () => {
    it("rejects a non-object actor", () => {
      expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), actor: "user-1" })).toThrow(/actor/);
    });

    it("rejects an actor with an unrecognized type", () => {
      expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), actor: { type: "robot", id: "x" } })).toThrow(/actor\.type/);
    });

    it("rejects an actor id that is neither a string nor null", () => {
      expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), actor: { type: "user", id: 123 } })).toThrow(/actor\.id/);
    });
  });

  it("rejects a non-string causationId when present", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), causationId: 123 })).toThrow(/causationId/);
  });

  it("rejects a non-boolean isReplay when present", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), isReplay: "yes" })).toThrow(/isReplay/);
  });

  it("rejects a non-string replayedAt when present", () => {
    expect(() => assertValidAthenaBusinessEvent({ ...validEvent(), replayedAt: 123 })).toThrow(/replayedAt/);
  });
});
