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

  function stubAuth(userId: string) {
    return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (req as unknown as { auth: { userId: string } }).auth = { userId };
      next();
    };
  }

  it("blocks requests beyond the configured max within the window, per user", async () => {
    // require after setting env so the factory picks up the test config
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createMembershipsRateLimit } = require("../backend/middleware/membershipsRateLimit");
    const limiter = createMembershipsRateLimit({
      windowMs: 60000,
      limit: 2,
      store: new MemoryStore(),
    });

    const app = express();
    app.get("/memberships", stubAuth("user-1"), limiter, (_req, res) =>
      res.status(200).json({ ok: true }),
    );

    const first = await request(app).get("/memberships");
    const second = await request(app).get("/memberships");
    const third = await request(app).get("/memberships");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ error: expect.stringContaining("Too many membership requests") });
  });

  it("limits per authenticated user, not per IP: another user is unaffected", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createMembershipsRateLimit } = require("../backend/middleware/membershipsRateLimit");
    const limiter = createMembershipsRateLimit({
      windowMs: 60000,
      limit: 1,
      store: new MemoryStore(),
    });

    const app = express();
    app.get(
      "/memberships",
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as unknown as { auth: { userId: string } }).auth = {
          userId: req.header("x-test-user") ?? "unknown",
        };
        next();
      },
      limiter,
      (_req, res) => res.status(200).json({ ok: true }),
    );

    expect((await request(app).get("/memberships").set("x-test-user", "user-1")).status).toBe(200);
    expect((await request(app).get("/memberships").set("x-test-user", "user-1")).status).toBe(429);
    expect((await request(app).get("/memberships").set("x-test-user", "user-2")).status).toBe(200);
  });

  it("wires the limiter onto GET /memberships, after requireAuth", () => {
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
    expect(handles.indexOf(requireAuth)).toBeLessThan(handles.indexOf(membershipsRateLimit));
  });
});
