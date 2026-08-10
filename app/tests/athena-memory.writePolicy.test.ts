import { ATHENA_MEMORY_DEFAULT_CONFIDENCE, detectProhibitedMemoryContent, evaluateAthenaMemoryWritePolicy } from "../modules/athena-memory/writePolicy";
import type { AthenaMemoryRecord, AthenaMemoryWriteCandidate } from "../modules/athena-memory/types";

function candidate(overrides: Partial<AthenaMemoryWriteCandidate> = {}): AthenaMemoryWriteCandidate {
  return {
    orgId: "org-1",
    actor: { orgId: "org-1", userId: "user-1", role: "owner" },
    scope: "user",
    subjectId: "user-1",
    kind: "preference.response_style",
    value: "concise",
    source: { kind: "user_message", trusted: true },
    ...overrides,
  };
}

function existingRecord(overrides: Partial<AthenaMemoryRecord> = {}): AthenaMemoryRecord {
  return {
    id: "mem-existing",
    version: "1.0.0",
    orgId: "org-1",
    scope: "user",
    subjectId: "user-1",
    kind: "preference.response_style",
    value: "concise",
    source: { kind: "user_message", trusted: true },
    confidence: 0.6,
    retention: { tier: "standard" },
    status: "active",
    visibility: "actor",
    createdByActor: { type: "user", id: "user-1" },
    updatedByActor: { type: "user", id: "user-1" },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("evaluateAthenaMemoryWritePolicy", () => {
  it("stores a new candidate when nothing exists yet", () => {
    const decision = evaluateAthenaMemoryWritePolicy(candidate(), 0.7, null);
    expect(decision).toEqual({ decision: "store", reasonCode: "athena_memory_created", confidence: 0.7 });
  });

  it("ignores a duplicate write with an identical value", () => {
    const decision = evaluateAthenaMemoryWritePolicy(candidate(), 0.7, existingRecord());
    expect(decision.decision).toBe("ignore");
    expect(decision.reasonCode).toBe("athena_memory_duplicate_ignored");
  });

  it("updates an existing memory when the value changes from an equal-or-higher-ranked source", () => {
    const decision = evaluateAthenaMemoryWritePolicy(candidate({ value: "detailed", source: { kind: "user_message", trusted: true } }), 0.7, existingRecord());
    expect(decision).toEqual({ decision: "update", reasonCode: "athena_memory_updated_existing", confidence: 0.7 });
  });

  it("ignores an untrusted-source write outright, even for a brand-new key", () => {
    const decision = evaluateAthenaMemoryWritePolicy(candidate({ source: { kind: "document", trusted: false } }), 0.7, null);
    expect(decision.decision).toBe("ignore");
    expect(decision.reasonCode).toBe("athena_memory_write_rejected_untrusted_source");
  });

  it("ignores a lower-ranked source trying to overwrite a higher-ranked active record", () => {
    const authoritative = existingRecord({ source: { kind: "admin_policy", trusted: true }, value: "policy-set" });
    const decision = evaluateAthenaMemoryWritePolicy(candidate({ value: "user-guessed", source: { kind: "user_message", trusted: true } }), 0.7, authoritative);
    expect(decision.decision).toBe("ignore");
    expect(decision.reasonCode).toBe("athena_memory_write_ignored_lower_rank_source");
  });

  it("allows an equal-or-higher-ranked source to update an admin_policy record", () => {
    const authoritative = existingRecord({ source: { kind: "admin_policy", trusted: true }, value: "policy-set" });
    const decision = evaluateAthenaMemoryWritePolicy(candidate({ value: "policy-changed", source: { kind: "admin_policy", trusted: true } }), 0.7, authoritative);
    expect(decision.decision).toBe("update");
  });

  it("rejects a candidate whose value contains a prohibited secret-shaped field", () => {
    const decision = evaluateAthenaMemoryWritePolicy(candidate({ value: { note: "call back", apiKey: "irrelevant" } }), 0.7, null);
    expect(decision.decision).toBe("ignore");
    expect(decision.reasonCode).toBe("athena_memory_write_rejected_prohibited_content");
  });

  it("uses the default confidence constant as documented", () => {
    expect(ATHENA_MEMORY_DEFAULT_CONFIDENCE).toBeGreaterThanOrEqual(0);
    expect(ATHENA_MEMORY_DEFAULT_CONFIDENCE).toBeLessThanOrEqual(1);
  });
});

describe("detectProhibitedMemoryContent", () => {
  it("returns null for ordinary business content", () => {
    expect(detectProhibitedMemoryContent("prefers concise morning summaries")).toBeNull();
    expect(detectProhibitedMemoryContent({ responseStyle: "concise", units: "imperial" })).toBeNull();
  });

  it.each([
    ["password field name", { password: "hunter2" }],
    ["nested credential field name", { auth: { apiKey: "irrelevant-value" } }],
    ["cookie field name", { sessionCookie: "abc" }],
    ["ssn field name", { ssn: "000-00-0000" }],
    ["card number field name", { cardNumber: "4111111111111111" }],
  ])("flags %s", (_label, value) => {
    expect(detectProhibitedMemoryContent(value)).not.toBeNull();
  });

  it.each([
    ["a JWT-shaped string", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"],
    ["a bearer header", "Bearer abc123.def456-ghi"],
    ["an AWS access key id", "AKIAABCDEFGHIJKLMNOP"],
    ["a PEM private key block", "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK...\n-----END RSA PRIVATE KEY-----"],
    // Built via concatenation, not a literal token, so this fixture is not
    // itself a scannable secret-shaped string in the diff/history.
    ["a Stripe-shaped secret key", ["sk", "live", "abcdefghijklmnopqrstuvwx"].join("_")],
  ])("flags %s", (_label, value) => {
    expect(detectProhibitedMemoryContent(value)).not.toBeNull();
  });

  it("does not flag an ordinary UUID or plain sentence merely because it is a long string", () => {
    expect(detectProhibitedMemoryContent("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBeNull();
    expect(detectProhibitedMemoryContent("The customer prefers to be called after 3pm on weekdays.")).toBeNull();
  });
});
