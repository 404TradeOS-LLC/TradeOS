import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { generateKeyPair, SignJWT, exportJWK, type KeyLike } from "jose";
import { verifyAnyAuthToken } from "../backend/auth/jwt";

// Regression coverage for a real production incident: jwt.ts verifies
// Supabase-issued tokens via `await import("jose")`, which this project's
// CommonJS TypeScript compilation downlevels to a plain `require("jose")`
// (confirmed against the compiled dist/ output). jose v5+ ships ESM-only,
// so that require() throws ERR_REQUIRE_ESM at runtime — every request
// bearing a Supabase JWT (including POST /api/v1/auth/bootstrap) failed
// with a 500 in production, and no existing test caught it because the
// rest of the suite only calls bootstrapSupabaseIdentity directly with an
// already-verified authSubject, never exercising this module at all. This
// test signs a real token and verifies it against a local JWKS HTTP
// server so it fails again if a future dependency bump reintroduces an
// ESM-only `jose` (or anything else jwt.ts dynamically imports the same
// way).
describe("verifyAnyAuthToken against a Supabase-style RS256 JWT", () => {
  let server: Server;
  let jwksUrl: string;
  let privateKey: KeyLike;

  const issuer = "https://jwt-regression-test.supabase.co/auth/v1";
  const subject = "11111111-2222-3333-4444-555555555555";
  const email = "hello@404tradeos.com";

  beforeAll(async () => {
    const { publicKey, privateKey: generatedPrivateKey } = await generateKeyPair("RS256");
    privateKey = generatedPrivateKey;

    const jwk = await exportJWK(publicKey);
    jwk.kid = "test-key";
    jwk.alg = "RS256";
    jwk.use = "sig";

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    jwksUrl = `http://127.0.0.1:${port}/jwks.json`;

    process.env.SUPABASE_JWT_ISSUER = issuer;
    process.env.SUPABASE_JWT_JWKS_URL = jwksUrl;
    delete process.env.SUPABASE_JWT_AUDIENCE;
  });

  afterAll(async () => {
    delete process.env.SUPABASE_JWT_ISSUER;
    delete process.env.SUPABASE_JWT_JWKS_URL;
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("verifies a validly signed token without throwing ERR_REQUIRE_ESM", async () => {
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuedAt()
      .setIssuer(issuer)
      .setSubject(subject)
      .setExpirationTime("1h")
      .sign(privateKey);

    const claims = await verifyAnyAuthToken(token);

    expect(claims.sub).toBe(subject);
    expect(claims.email).toBe(email);
    expect(claims.iss).toBe(issuer);
  });

  it("rejects a token signed by an untrusted key", async () => {
    const { privateKey: otherKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuedAt()
      .setIssuer(issuer)
      .setSubject(subject)
      .setExpirationTime("1h")
      .sign(otherKey);

    await expect(verifyAnyAuthToken(token)).rejects.toThrow("Invalid bearer token");
  });

  it("rejects a validly signed token without finite session timestamps", async () => {
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setSubject(subject)
      .sign(privateKey);

    await expect(verifyAnyAuthToken(token)).rejects.toThrow("JWT payload is missing required claims");
  });
});
