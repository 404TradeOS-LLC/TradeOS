import { classifyAthenaMemory } from "../modules/athena-security/memoryClassification";

describe("athena-security classifyAthenaMemory()", () => {
  it("classifies untrusted-source content as untrusted_information regardless of scope/kind", () => {
    expect(classifyAthenaMemory({ scope: "user", kind: "preference.units", sourceKind: "user_message", sourceTrusted: false })).toBe("untrusted_information");
    expect(classifyAthenaMemory({ scope: "organization", kind: "policy.discount", sourceKind: "admin_policy", sourceTrusted: false })).toBe("untrusted_information");
  });

  it("classifies a trusted admin_policy write as system_knowledge", () => {
    expect(classifyAthenaMemory({ scope: "organization", kind: "policy.discount", sourceKind: "admin_policy", sourceTrusted: true })).toBe("system_knowledge");
  });

  it("classifies a conversation-scoped write as temporary_context", () => {
    expect(classifyAthenaMemory({ scope: "conversation", kind: "context.last_topic", sourceKind: "user_message", sourceTrusted: true })).toBe("temporary_context");
  });

  it("classifies a user-scoped preference.* write as user_preference", () => {
    expect(classifyAthenaMemory({ scope: "user", kind: "preference.units", sourceKind: "user_message", sourceTrusted: true })).toBe("user_preference");
  });

  it("classifies a trusted application_record/event write as business_fact", () => {
    expect(classifyAthenaMemory({ scope: "project", kind: "project.summary", sourceKind: "application_record", sourceTrusted: true })).toBe("business_fact");
    expect(classifyAthenaMemory({ scope: "job", kind: "job.completed", sourceKind: "event", sourceTrusted: true })).toBe("business_fact");
  });

  it("classifies a non-preference user-scoped write as user_preference (fallback)", () => {
    expect(classifyAthenaMemory({ scope: "user", kind: "workflow.last_completed_tool", sourceKind: "approved_action", sourceTrusted: true })).toBe("user_preference");
  });

  it("falls back to business_fact for an organization-scoped conversational write", () => {
    expect(classifyAthenaMemory({ scope: "organization", kind: "misc.note", sourceKind: "user_message", sourceTrusted: true })).toBe("business_fact");
  });
});
