import crypto from "node:crypto";
import { signAuthToken, verifyAuthToken } from "../backend/auth/jwt";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signRaw(payload: unknown, secret: string, header: Record<string, unknown> = { alg: "HS256", typ: "JWT" }): string {
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

describe("local auth JWT hardening", () => {
  const secret = "test-secret";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_ISSUER: "tradeos-costbook",
      AUTH_AUDIENCE: "tradeos-costbook-api",
      AUTH_JWT_TTL_SECONDS: "3600",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("adds a finite expiration to locally signed access tokens", () => {
    const before = Math.floor(Date.now() / 1000);
    const claims = verifyAuthToken(
      signAuthToken(
        { sub: "auth-sub-1", iss: "tradeos-costbook", aud: "tradeos-costbook-api" },
        secret
      ),
      secret
    );

    const after = Math.floor(Date.now() / 1000);
    expect(claims.exp).toBe(claims.iat! + 3600);
    expect(claims.iat).toBeGreaterThanOrEqual(before);
    expect(claims.iat).toBeLessThanOrEqual(after);
  });

  it.each([
    { label: "expired", exp: Math.floor(Date.now() / 1000) - 1 },
    { label: "at the current second", exp: Math.floor(Date.now() / 1000) },
  ])("rejects a token that is $label", ({ exp }) => {
    const token = signRaw(
      { sub: "auth-sub-1", iat: exp - 60, exp, iss: "tradeos-costbook", aud: "tradeos-costbook-api" },
      secret
    );

    expect(() => verifyAuthToken(token, secret)).toThrow("Bearer token has expired");
  });

  it.each([
    { label: "missing exp", payload: { sub: "auth-sub-1", iat: 1 } },
    { label: "non-string sub", payload: { sub: 42, iat: 1, exp: 2 } },
    { label: "non-numeric exp", payload: { sub: "auth-sub-1", iat: 1, exp: "never" } },
    { label: "non-numeric iat", payload: { sub: "auth-sub-1", iat: "now", exp: 2 } },
    { label: "non-string audience", payload: { sub: "auth-sub-1", iat: 1, exp: 2, aud: 7 } },
  ])("rejects malformed local JWT claims ($label)", ({ payload }) => {
    const token = signRaw(payload, secret);

    expect(() => verifyAuthToken(token, secret)).toThrow(/JWT payload/);
  });

  it("rejects a local token with the wrong issuer or audience", () => {
    const issuerToken = signAuthToken(
      { sub: "auth-sub-1", iss: "other-issuer", aud: "tradeos-costbook-api" },
      secret
    );
    const audienceToken = signAuthToken(
      { sub: "auth-sub-1", iss: "tradeos-costbook", aud: "other-audience" },
      secret
    );

    expect(() => verifyAuthToken(issuerToken, secret)).toThrow("issuer mismatch");
    expect(() => verifyAuthToken(audienceToken, secret)).toThrow("audience mismatch");
  });
});
