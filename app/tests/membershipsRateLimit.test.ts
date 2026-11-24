import express from "express";
import request from "supertest";
import { MemoryStore } from "express-rate-limit";
import { authRouter } from "../backend/routes/auth.routes";
import { requireAuth } from "../backend/middleware/auth";
import { membershipsRateLimit } from "../backend/middleware/membershipsRateLimit";

describe("memberships rate limit (CodeQL alert 43, js/missing-rate-limiting)", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  it("blocks requests beyond the configured max within the window, per credential", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createMembershipsRateLimit } = require("../backend/middleware/membershipsRateLimit");
    const limiter = createMembershipsRateLimit({
      windowMs: 60000,
      limit: 2,
      store: new MemoryStore(),
    });

    const app = express();
    app.get("/memberships", limiter, (_req, res) => res.status(200).json({ ok: true }));

    const auth = { Authorization: "Bearer test-credential-user-1" };
    const first = await request(app).get("/memberships").set(auth);
    const second = await request(app).get("/memberships").set(auth);
    const third = await request(app).get("/memberships").set(auth);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ error: expect.stringContaining("Too many membership requests") });
  });

  it("limits per credential, not per IP: another credential is unaffected; no credential shares one bucket", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createMembershipsRateLimit } = require("../backend/middleware/membershipsRateLimit");
    const limiter = createMembershipsRateLimit({
      windowMs: 60000,
      limit: 1,
      store: new MemoryStore(),
    });

    const app = express();
    app.get("/memberships", limiter, (_req, res) => res.status(200).json({ ok: true }));

    const user1 = { Authorization: "Bearer test-credential-user-1" };
    const user2 = { Authorization: "Bearer test-credential-user-2" };
    expect((await request(app).get("/memberships").set(user1)).status).toBe(200);
    expect((await request(app).get("/memberships").set(user1)).status).toBe(429);
    expect((await request(app).get("/memberships").set(user2)).status).toBe(200);
    // No credential at all: a single shared "unknown" bucket.
    expect((await request(app).get("/memberships")).status).toBe(200);
    expect((await request(app).get("/memberships")).status).toBe(429);
  });

  it("wires the limiter onto GET /memberships, before requireAuth", () => {
    const layer = (authRouter as unknown as { stack: Array<Record<string, unknown>> }).stack.find(
      (candidate) => {
        const route = candidate.route as { path?: string; methods?: Record<string, boolean> } | undefined;
        return route?.path === "/memberships" && route?.methods?.get === true;
      },
    );
    expect(layer).toBeDefined();
    const handles = (
      (layer as unknown as { route: { stack: Array<{ handle: unknown }> } }).route.stack.map(
        (entry) => entry.handle,
      )
    );
    expect(handles).toContain(membershipsRateLimit);
    expect(handles).toContain(requireAuth);
    // The limiter must precede requireAuth: CodeQL's guard check only
    // counts a limiter that runs before the authorization it protects
    // (the three alert references are inside requireAuth itself).
    expect(handles.indexOf(membershipsRateLimit)).toBeLessThan(handles.indexOf(requireAuth));
  });
});
