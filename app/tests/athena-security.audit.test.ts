import { buildAthenaSecurityAuditMetadata } from "../modules/athena-security/audit";
import type { AthenaSecurityDecision } from "../modules/athena-security/types";

function decision(overrides: Partial<AthenaSecurityDecision>): AthenaSecurityDecision {
  return { version: "1.0.0", decision: "allow", riskLevel: "low", reasons: ["athena_security_allowed"], requiredControls: [], metadata: {}, ...overrides };
}

describe("athena-security buildAthenaSecurityAuditMetadata()", () => {
  it("shapes a plain metadata object with only IDs, decision, risk level, reasons, and controls", () => {
    const metadata = buildAthenaSecurityAuditMetadata(decision({ metadata: { toolTrustLevel: "internal" } }));
    expect(metadata).toEqual({
      securityDecision: "allow",
      securityRiskLevel: "low",
      securityReasons: ["athena_security_allowed"],
      securityRequiredControls: [],
      securityMetadata: { toolTrustLevel: "internal" },
    });
  });

  it("never leaks a raw secret value even if a caller's own metadata carried a secret-shaped field", () => {
    const metadata = buildAthenaSecurityAuditMetadata(decision({ metadata: { apiKey: "sk_live_abcdefghijklmnop" } }));
    expect(JSON.stringify(metadata)).not.toContain("abcdefghijklmnop");
  });
});
