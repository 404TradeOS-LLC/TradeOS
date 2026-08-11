import { assertValidAthenaSecurityDecision } from "../modules/athena-security/resultValidation";
import type { AthenaSecurityDecision } from "../modules/athena-security/types";

function validDecision(): AthenaSecurityDecision {
  return {
    version: "1.0.0",
    decision: "allow",
    riskLevel: "low",
    reasons: ["athena_security_allowed"],
    requiredControls: [],
    metadata: {},
  };
}

describe("athena:contracts - security decision", () => {
  it("accepts a conforming allow decision", () => {
    expect(() => assertValidAthenaSecurityDecision(validDecision())).not.toThrow();
  });

  it("accepts a conforming deny decision with metadata and required controls", () => {
    const denied: AthenaSecurityDecision = {
      ...validDecision(),
      decision: "deny",
      riskLevel: "critical",
      reasons: ["athena_security_denied_cross_tenant_reference"],
      requiredControls: ["approval_required"],
      metadata: { referencedOrgId: "org-b" },
    };
    expect(() => assertValidAthenaSecurityDecision(denied)).not.toThrow();
  });

  it("accepts every documented risk level", () => {
    for (const riskLevel of ["low", "medium", "high", "critical"] as const) {
      expect(() => assertValidAthenaSecurityDecision({ ...validDecision(), riskLevel })).not.toThrow();
    }
  });

  it("rejects a decision missing a required key", () => {
    const { metadata: _metadata, ...rest } = validDecision();
    expect(() => assertValidAthenaSecurityDecision(rest)).toThrow(/metadata/);
  });

  it("rejects a decision carrying an undocumented top-level key", () => {
    const withExtra = { ...validDecision(), extra: "not allowed" };
    expect(() => assertValidAthenaSecurityDecision(withExtra)).toThrow(/undocumented/);
  });

  it("rejects a wrong version string", () => {
    expect(() => assertValidAthenaSecurityDecision({ ...validDecision(), version: "2.0.0" as never })).toThrow(/version/);
  });

  it("rejects an unknown decision value", () => {
    expect(() => assertValidAthenaSecurityDecision({ ...validDecision(), decision: "maybe" as never })).toThrow(/decision/);
  });

  it("rejects an unknown risk level", () => {
    expect(() => assertValidAthenaSecurityDecision({ ...validDecision(), riskLevel: "extreme" as never })).toThrow(/riskLevel/);
  });

  it("rejects an empty reasons array", () => {
    expect(() => assertValidAthenaSecurityDecision({ ...validDecision(), reasons: [] })).toThrow(/reasons/);
  });

  it("rejects a non-array requiredControls", () => {
    expect(() => assertValidAthenaSecurityDecision({ ...validDecision(), requiredControls: "approval_required" as never })).toThrow(/requiredControls/);
  });

  it("rejects a non-object metadata", () => {
    expect(() => assertValidAthenaSecurityDecision({ ...validDecision(), metadata: null as never })).toThrow(/metadata/);
  });
});
