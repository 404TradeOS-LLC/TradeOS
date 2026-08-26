import express, { Request } from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { parseTrustProxy } from "../backend/middleware/productionHardening";

// These tests exercise the real `express` + `express-rate-limit` stack (not
// mocks) against the exact `trust proxy` values this app can be configured
// with, to prove three things about the fix for
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR:
//
//   (a) TRUST_PROXY=1 (Vercel's single reverse-proxy hop) is accepted and
//       correctly resolves the real client IP from X-Forwarded-For.
//   (b) Local development (TRUST_PROXY unset) keeps its current, safe
//       behavior: X-Forwarded-For is ignored entirely, so it can't be used
//       to spoof req.ip.
//   (c) With TRUST_PROXY=1, an arbitrarily deep / attacker-prefixed
//       X-Forwarded-For chain is NOT blindly trusted — only the single
//       innermost hop (the entry the trusted proxy itself appended) is
//       used, exactly like https://express-rate-limit.github.io/ERR_ERL_UNEXPECTED_X_FORWARDED_FOR/
//       describes.

function buildApp(trustProxySetting: boolean | number | string) {
  const app = express();
  app.set("trust proxy", trustProxySetting);

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 2,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/probe", limiter, (req: Request, res) => {
    res.json({ ip: req.ip });
  });

  return app;
}

describe("trust proxy — Vercel single-hop topology", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("parseTrustProxy('1') yields the numeric hop count Vercel needs", () => {
    expect(parseTrustProxy("1")).toBe(1);
  });

  describe("(a) production/preview value (TRUST_PROXY=1)", () => {
    it("resolves req.ip from the single X-Forwarded-For entry Vercel's edge appends", async () => {
      const app = buildApp(parseTrustProxy("1"));

      const res = await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.7");

      expect(res.status).toBe(200);
      expect(res.body.ip).toBe("203.0.113.7");
    });

    it("does not trigger express-rate-limit's ERR_ERL_UNEXPECTED_X_FORWARDED_FOR validation", async () => {
      const app = buildApp(parseTrustProxy("1"));

      await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.7");

      const unexpectedXffErrors = errorSpy.mock.calls
        .flat()
        .filter((arg) => arg instanceof Error && (arg as Error & { code?: string }).code === "ERR_ERL_UNEXPECTED_X_FORWARDED_FOR");
      expect(unexpectedXffErrors).toHaveLength(0);
    });

    it("does not trigger express-rate-limit's ERR_ERL_PERMISSIVE_TRUST_PROXY validation (unlike trust proxy=true)", async () => {
      const app = buildApp(parseTrustProxy("1"));

      await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.7");

      const permissiveErrors = errorSpy.mock.calls
        .flat()
        .filter((arg) => arg instanceof Error && (arg as Error & { code?: string }).code === "ERR_ERL_PERMISSIVE_TRUST_PROXY");
      expect(permissiveErrors).toHaveLength(0);
    });
  });

  describe("(b) local development default (TRUST_PROXY unset)", () => {
    it("parseTrustProxy(undefined) is false, matching the documented .env.example default", () => {
      expect(parseTrustProxy(undefined)).toBe(false);
    });

    it("ignores X-Forwarded-For entirely and uses the real socket address", async () => {
      const app = buildApp(parseTrustProxy(undefined));

      const res = await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.7");

      expect(res.status).toBe(200);
      // Never the attacker/test-supplied header value.
      expect(res.body.ip).not.toBe("203.0.113.7");
      // supertest connects over loopback.
      expect(res.body.ip).toMatch(/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/);
    });

    it("reproduces the original warning when a client sends X-Forwarded-For and trust proxy is left at the default", async () => {
      const app = buildApp(parseTrustProxy(undefined));

      await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.7");

      const unexpectedXffErrors = errorSpy.mock.calls
        .flat()
        .filter((arg) => arg instanceof Error && (arg as Error & { code?: string }).code === "ERR_ERL_UNEXPECTED_X_FORWARDED_FOR");
      expect(unexpectedXffErrors.length).toBeGreaterThan(0);
    });
  });

  describe("(c) a spoofed/arbitrarily deep X-Forwarded-For chain is not blindly trusted", () => {
    it("uses only the innermost (rightmost) hop, ignoring attacker-prefixed entries", async () => {
      const app = buildApp(parseTrustProxy("1"));

      // Simulates a client sending its own fabricated X-Forwarded-For prefix;
      // "203.0.113.7" represents the value Vercel's edge itself appended
      // (the only entry that should be trusted).
      const res = await request(app)
        .get("/probe")
        .set("X-Forwarded-For", "6.6.6.6, 9.9.9.9, 203.0.113.7");

      expect(res.status).toBe(200);
      expect(res.body.ip).toBe("203.0.113.7");
      expect(res.body.ip).not.toBe("6.6.6.6");
      expect(res.body.ip).not.toBe("9.9.9.9");
    });

    it("rate-limits by the trusted innermost hop, so rotating the spoofable prefix cannot evade the limiter", async () => {
      const app = buildApp(parseTrustProxy("1"));

      const first = await request(app).get("/probe").set("X-Forwarded-For", "1.1.1.1, 203.0.113.7");
      const second = await request(app).get("/probe").set("X-Forwarded-For", "2.2.2.2, 203.0.113.7");
      const third = await request(app).get("/probe").set("X-Forwarded-For", "3.3.3.3, 203.0.113.7");

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      // limit is 2 per window; a real attacker rotating only the spoofable
      // prefix must still be blocked because the trusted trailing IP is
      // unchanged.
      expect(third.status).toBe(429);
    });

    it("does not conflate two distinct real clients into the same rate-limit bucket", async () => {
      const app = buildApp(parseTrustProxy("1"));

      const clientA1 = await request(app).get("/probe").set("X-Forwarded-For", "198.51.100.1");
      const clientA2 = await request(app).get("/probe").set("X-Forwarded-For", "198.51.100.1");
      const clientA3 = await request(app).get("/probe").set("X-Forwarded-For", "198.51.100.1");
      const clientB1 = await request(app).get("/probe").set("X-Forwarded-For", "198.51.100.2");

      expect(clientA1.status).toBe(200);
      expect(clientA2.status).toBe(200);
      expect(clientA3.status).toBe(429); // clientA exceeded the limit of 2
      expect(clientB1.status).toBe(200); // a genuinely different client is unaffected
    });
  });
});
