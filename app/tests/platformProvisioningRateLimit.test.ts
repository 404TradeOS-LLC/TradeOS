import express from "express";
import request from "supertest";

describe("platform provisioning rate limit", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  it("blocks requests beyond the configured max within the window", async () => {
    process.env.PLATFORM_PROVISIONING_RATE_LIMIT_MAX = "2";
    process.env.PLATFORM_PROVISIONING_RATE_LIMIT_WINDOW_MS = "60000";

    // require after setting env so the module picks up the test config
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { platformProvisioningRateLimit } = require("../backend/middleware/platformProvisioningRateLimit");

    const app = express();
    app.post("/organizations", platformProvisioningRateLimit, (_req, res) => res.status(200).json({ ok: true }));

    const first = await request(app).post("/organizations");
    const second = await request(app).post("/organizations");
    const third = await request(app).post("/organizations");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ error: expect.stringContaining("Too many provisioning attempts") });
  });
});
