import { detectSecrets, redactSecrets } from "../modules/athena-security/secretProtection";

describe("athena-security detectSecrets()", () => {
  it("returns not detected for ordinary business content", () => {
    expect(detectSecrets("prefers concise morning summaries")).toEqual({ detected: false, detectorNames: [] });
    expect(detectSecrets({ responseStyle: "concise", units: "imperial" })).toEqual({ detected: false, detectorNames: [] });
  });

  it.each([
    ["password field name", { password: "hunter2" }],
    ["nested credential field name", { auth: { apiKey: "irrelevant-value" } }],
    ["database url field name", { databaseUrl: "postgres://x" }],
    ["cookie field name", { sessionCookie: "abc" }],
    ["ssn field name", { ssn: "000-00-0000" }],
  ])("flags %s via sensitive_field_name", (_label, value) => {
    const result = detectSecrets(value);
    expect(result.detected).toBe(true);
    expect(result.detectorNames).toContain("sensitive_field_name");
  });

  it.each([
    ["a JWT-shaped string", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", "jwt"],
    ["a bearer header", "Bearer abc123.def456-ghi", "bearer_header"],
    ["an AWS access key id", "AKIAABCDEFGHIJKLMNOP", "aws_access_key_id"],
    ["a PEM private key block", "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK...\n-----END RSA PRIVATE KEY-----", "pem_private_key"],
    ["a Stripe-shaped secret key", ["sk", "live", "abcdefghijklmnopqrstuvwx"].join("_"), "generic_prefixed_api_key"],
    ["a credential-bearing URL", "postgres://user:hunter2@db.internal:5432/app", "credential_bearing_url"],
  ])("flags %s via the matching string pattern detector", (_label, value, detectorName) => {
    const result = detectSecrets(value);
    expect(result.detected).toBe(true);
    expect(result.detectorNames).toContain(detectorName);
  });

  it("does not flag an ordinary UUID or plain sentence merely because it is a long string", () => {
    expect(detectSecrets("f47ac10b-58cc-4372-a567-0e02b2c3d479").detected).toBe(false);
    expect(detectSecrets("The customer prefers to be called after 3pm on weekdays.").detected).toBe(false);
  });

  it("finds a secret nested arbitrarily deep in an object/array", () => {
    const value = { a: { b: [{ c: { d: { token: "irrelevant" } } } ] } };
    expect(detectSecrets(value).detected).toBe(true);
  });
});

describe("athena-security redactSecrets()", () => {
  it("replaces a sensitive-field-name value with a placeholder and reports its path", () => {
    const result = redactSecrets({ user: "alice", password: "hunter2" });
    expect(result.data).toEqual({ user: "alice", password: "[redacted]" });
    expect(result.redactedFieldPaths).toEqual(["password"]);
  });

  it("redacts a secret-shaped value under an innocuous key name", () => {
    const result = redactSecrets({ note: "Bearer abc123.def456-ghi" });
    expect(result.data).toEqual({ note: "[redacted]" });
    expect(result.redactedFieldPaths).toEqual(["note"]);
  });

  it("redacts nested and array-contained fields, preserving structure and safe fields", () => {
    const result = redactSecrets({ items: [{ id: "1", apiKey: "sk_live_abcdefghijklmnop" }, { id: "2", apiKey: "irrelevant" }] });
    expect(result.data).toEqual({ items: [{ id: "1", apiKey: "[redacted]" }, { id: "2", apiKey: "[redacted]" }] });
    expect(result.redactedFieldPaths.sort()).toEqual(["items[0].apiKey", "items[1].apiKey"].sort());
  });

  it("leaves ordinary data completely unchanged", () => {
    const input = { customerName: "Acme Roofing", jobId: "job-1", amount: 4200 };
    const result = redactSecrets(input);
    expect(result.data).toEqual(input);
    expect(result.redactedFieldPaths).toEqual([]);
  });

  it("handles null, primitives, and a bare secret-shaped string", () => {
    expect(redactSecrets(null).data).toBeNull();
    expect(redactSecrets(42).data).toBe(42);
    expect(redactSecrets("Bearer abc123.def456-ghi").data).toBe("[redacted]");
  });
});
