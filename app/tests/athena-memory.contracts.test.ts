import { assertValidAthenaMemoryRecord } from "../modules/athena-memory/resultValidation";
import type { AthenaMemoryRecord } from "../modules/athena-memory/types";

// Backs the `athena:contracts` gate alongside the kernel/tool-registry/
// context-engine/permissions/planner/action-engine contract tests.
// Exercises the exact assertValidAthenaMemoryRecord function
// AthenaMemoryService's callers should validate against (C006,
// docs/athena/contracts/README.md).
function validRecord(): AthenaMemoryRecord {
  return {
    id: "mem-1",
    version: "1.0.0",
    orgId: "org-1",
    scope: "user",
    subjectId: "user-1",
    kind: "preference.response_style",
    value: "concise",
    source: { kind: "user_message", trusted: true },
    confidence: 0.8,
    retention: { tier: "standard" },
    status: "active",
    visibility: "actor",
    createdByActor: { type: "user", id: "user-1" },
    updatedByActor: { type: "user", id: "user-1" },
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    metadata: {},
  };
}

describe("athena:contracts - memory record (C006)", () => {
  it("accepts a conforming record", () => {
    expect(() => assertValidAthenaMemoryRecord(validRecord())).not.toThrow();
  });

  it("accepts every documented scope", () => {
    for (const scope of ["user", "organization", "project", "job", "conversation"] as const) {
      expect(() => assertValidAthenaMemoryRecord({ ...validRecord(), scope })).not.toThrow();
    }
  });

  it("accepts every documented status", () => {
    for (const status of ["active", "corrected", "deleted"] as const) {
      expect(() => assertValidAthenaMemoryRecord({ ...validRecord(), status })).not.toThrow();
    }
  });

  it("accepts every documented source kind", () => {
    for (const kind of ["user_message", "approved_action", "application_record", "event", "document", "admin_policy"] as const) {
      expect(() => assertValidAthenaMemoryRecord({ ...validRecord(), source: { kind, trusted: true } })).not.toThrow();
    }
  });

  it("accepts optional supersedes and lastAccessedAt", () => {
    const withOptional = { ...validRecord(), supersedes: "mem-0", lastAccessedAt: "2026-08-10T01:00:00.000Z" };
    expect(() => assertValidAthenaMemoryRecord(withOptional)).not.toThrow();
  });

  it("accepts a null value (a forgotten memory)", () => {
    expect(() => assertValidAthenaMemoryRecord({ ...validRecord(), status: "deleted", value: null })).not.toThrow();
  });

  it("rejects a record missing a required key", () => {
    const { confidence: _confidence, ...rest } = validRecord();
    expect(() => assertValidAthenaMemoryRecord(rest)).toThrow(/confidence/);
  });

  it("rejects a record carrying an undocumented top-level key", () => {
    const withExtra = { ...validRecord(), extra: "not allowed" };
    expect(() => assertValidAthenaMemoryRecord(withExtra)).toThrow(/undocumented/);
  });

  it("rejects an unrecognized scope", () => {
    const invalid = { ...validRecord(), scope: "planet" as never };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/scope/);
  });

  it("rejects a wrong version string", () => {
    const invalid = { ...validRecord(), version: "2.0.0" as never };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/version/);
  });

  it("rejects confidence below 0", () => {
    const invalid = { ...validRecord(), confidence: -0.1 };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/confidence/);
  });

  it("rejects confidence above 1", () => {
    const invalid = { ...validRecord(), confidence: 1.1 };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/confidence/);
  });

  it("rejects a source with an unrecognized kind", () => {
    const invalid = { ...validRecord(), source: { kind: "telepathy" as never, trusted: true } };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/source/);
  });

  it("rejects a source missing trusted", () => {
    const invalid = { ...validRecord(), source: { kind: "user_message" } as never };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/trusted/);
  });

  it("rejects an unrecognized retention tier", () => {
    const invalid = { ...validRecord(), retention: { tier: "forever" as never } };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/retention/);
  });

  it("rejects an unrecognized status", () => {
    const invalid = { ...validRecord(), status: "archived" as never };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/status/);
  });

  it("rejects an unrecognized visibility", () => {
    const invalid = { ...validRecord(), visibility: "public" as never };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/visibility/);
  });

  it("rejects a createdByActor with an invalid type", () => {
    const invalid = { ...validRecord(), createdByActor: { type: "robot" as never, id: "x" } };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/createdByActor/);
  });

  it("rejects non-object metadata", () => {
    const invalid = { ...validRecord(), metadata: "none" as never };
    expect(() => assertValidAthenaMemoryRecord(invalid)).toThrow(/metadata/);
  });
});
