import { evaluateAthenaToolPolicy } from "../modules/athena-tool-registry/policy";
import type { AthenaToolRisk } from "../modules/athena-tool-registry/types";

describe("evaluateAthenaToolPolicy", () => {
  it("denies when the role lacks a required permission, regardless of risk", () => {
    const decision = evaluateAthenaToolPolicy("technician", { permissions: ["dispatch.manage"], risk: "low" });

    expect(decision.decision).toBe("deny");
    expect(decision.evaluatedRisk).toBe("low");
  });

  it("allows a low-risk tool when the role has every required permission", () => {
    const decision = evaluateAthenaToolPolicy("owner", { permissions: ["crm.read"], risk: "low" });

    expect(decision.decision).toBe("allow");
  });

  it.each(["medium", "high"] as const)("requires approval for a %s-risk tool even when the role has every required permission", (risk: AthenaToolRisk) => {
    const decision = evaluateAthenaToolPolicy("owner", { permissions: ["crm.read"], risk });

    expect(decision.decision).toBe("approval_required");
    expect(decision.evaluatedRisk).toBe(risk);
  });

  it("still reports evaluatedPermissions and role on a denied decision", () => {
    const decision = evaluateAthenaToolPolicy("technician", { permissions: ["dispatch.manage"], risk: "high" });

    expect(decision.role).toBe("technician");
    expect(decision.evaluatedPermissions).toContain("crm.read");
    expect(decision.evaluatedPermissions).not.toContain("dispatch.manage");
  });
});
