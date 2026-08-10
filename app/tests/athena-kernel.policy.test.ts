import { classifyAthenaCapability, evaluateAthenaPolicy } from "../modules/athena-kernel/policy";

describe("athena kernel policy adapter", () => {
  it("allows draft_response for every canonical role", () => {
    for (const role of ["owner", "admin", "dispatcher", "technician"]) {
      const decision = evaluateAthenaPolicy({ rawRole: role, orgId: "org-1", userId: "user-1", capability: "draft_response" });
      expect(decision.decision).toBe("allow");
      expect(decision.reasonCode).toBe("athena_a1_draft_response_allowed");
    }
  });

  it("denies mutate_business_record for every canonical role - A1 has no mutating tools", () => {
    for (const role of ["owner", "admin", "dispatcher", "technician"]) {
      const decision = evaluateAthenaPolicy({ rawRole: role, orgId: "org-1", userId: "user-1", capability: "mutate_business_record" });
      expect(decision.decision).toBe("deny");
      expect(decision.reasonCode).toBe("athena_capability_not_available");
    }
  });

  it("normalizes legacy roles itself instead of trusting an upstream canonicalRole (MEDIUM-2)", () => {
    const estimatorDecision = evaluateAthenaPolicy({ rawRole: "estimator", orgId: "org-1", userId: "user-1", capability: "draft_response" });
    expect(estimatorDecision.role).toBe("dispatcher");

    const viewerDecision = evaluateAthenaPolicy({ rawRole: "viewer", orgId: "org-1", userId: "user-1", capability: "draft_response" });
    expect(viewerDecision.role).toBe("technician");
  });

  it("falls back to the safest canonical role for an unrecognized input", () => {
    const decision = evaluateAthenaPolicy({ rawRole: "not-a-real-role", orgId: "org-1", userId: "user-1", capability: "draft_response" });
    expect(decision.role).toBe("technician");
  });

  it("derives permissions from the normalized role, not the raw input", () => {
    const decision = evaluateAthenaPolicy({ rawRole: "owner", orgId: "org-1", userId: "user-1", capability: "draft_response" });
    expect(decision.permissions).toContain("billing.write");
  });

  describe("classifyAthenaCapability", () => {
    it("classifies plain questions as draft_response", () => {
      expect(classifyAthenaCapability("What is the status of this project?")).toBe("draft_response");
      expect(classifyAthenaCapability("Summarize this week's activity")).toBe("draft_response");
    });

    it("classifies mutation-shaped requests as mutate_business_record", () => {
      expect(classifyAthenaCapability("Send the invoice to the customer")).toBe("mutate_business_record");
      expect(classifyAthenaCapability("Cancel job 42")).toBe("mutate_business_record");
      expect(classifyAthenaCapability("Please approve this estimate")).toBe("mutate_business_record");
      expect(classifyAthenaCapability("Schedule a technician for tomorrow")).toBe("mutate_business_record");
    });
  });
});
