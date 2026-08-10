import { assertValidAthenaPermissionDecision } from "../modules/athena-permissions/resultValidation";
import type { AthenaPermissionDecision } from "../modules/athena-permissions/types";

// Backs the `athena:contracts` gate alongside the kernel/tool-registry/
// context-engine contract tests. Exercises the exact
// assertValidAthenaPermissionDecision function evaluateAthenaPermission()'s
// callers should validate against, not a test-only duplicate (C007,
// docs/athena/contracts/README.md).
function validDecision(): AthenaPermissionDecision {
  return {
    version: "1.0.0",
    orgId: "org-1",
    userId: "user-1",
    role: "dispatcher",
    permissions: ["dispatch.manage"],
    capability: "tradeos.athena.fixture.echo",
    deniedFields: [],
    decision: "allow",
    reasonCode: "athena_permission_allowed",
  };
}

describe("athena:contracts - permission decision (C007)", () => {
  it("accepts a conforming decision without resourceScope", () => {
    expect(() => assertValidAthenaPermissionDecision(validDecision())).not.toThrow();
  });

  it("accepts a conforming decision with resourceScope", () => {
    const withScope: AthenaPermissionDecision = { ...validDecision(), resourceScope: { entityType: "job", entityId: "job-1", relationship: "assignee" } };
    expect(() => assertValidAthenaPermissionDecision(withScope)).not.toThrow();
  });

  it("accepts every canonical role", () => {
    for (const role of ["owner", "admin", "dispatcher", "technician"] as const) {
      expect(() => assertValidAthenaPermissionDecision({ ...validDecision(), role })).not.toThrow();
    }
  });

  it("accepts every documented decision value", () => {
    for (const decision of ["allow", "deny", "approval_required"] as const) {
      expect(() => assertValidAthenaPermissionDecision({ ...validDecision(), decision })).not.toThrow();
    }
  });

  it("accepts every documented resourceScope relationship", () => {
    for (const relationship of ["owner", "assignee", "member", "viewer", "none"] as const) {
      const withScope: AthenaPermissionDecision = { ...validDecision(), resourceScope: { entityType: "job", entityId: "job-1", relationship } };
      expect(() => assertValidAthenaPermissionDecision(withScope)).not.toThrow();
    }
  });

  it("rejects a decision missing a required key", () => {
    const { reasonCode: _reasonCode, ...rest } = validDecision();
    expect(() => assertValidAthenaPermissionDecision(rest)).toThrow(/reasonCode/);
  });

  it("rejects a decision carrying an undocumented top-level key", () => {
    const withExtra = { ...validDecision(), extra: "not allowed" };
    expect(() => assertValidAthenaPermissionDecision(withExtra)).toThrow(/undocumented/);
  });

  it("rejects a non-canonical role", () => {
    const invalid = { ...validDecision(), role: "estimator" as never };
    expect(() => assertValidAthenaPermissionDecision(invalid)).toThrow(/role/);
  });

  it("rejects a wrong version string", () => {
    const invalid = { ...validDecision(), version: "2.0.0" as never };
    expect(() => assertValidAthenaPermissionDecision(invalid)).toThrow(/version/);
  });

  it("rejects an unknown decision value", () => {
    const invalid = { ...validDecision(), decision: "maybe" as never };
    expect(() => assertValidAthenaPermissionDecision(invalid)).toThrow(/decision/);
  });

  it("rejects a non-array permissions field", () => {
    const invalid = { ...validDecision(), permissions: "dispatch.manage" as never };
    expect(() => assertValidAthenaPermissionDecision(invalid)).toThrow(/permissions/);
  });

  it("rejects an empty capability string", () => {
    const invalid = { ...validDecision(), capability: "" };
    expect(() => assertValidAthenaPermissionDecision(invalid)).toThrow(/capability/);
  });

  it("rejects a resourceScope with an unknown relationship", () => {
    const invalid = { ...validDecision(), resourceScope: { entityType: "job", entityId: "job-1", relationship: "friend" as never } };
    expect(() => assertValidAthenaPermissionDecision(invalid)).toThrow(/relationship/);
  });

  it("rejects a resourceScope missing entityId", () => {
    const invalid = { ...validDecision(), resourceScope: { entityType: "job", relationship: "assignee" } as never };
    expect(() => assertValidAthenaPermissionDecision(invalid)).toThrow(/entityId/);
  });
});
