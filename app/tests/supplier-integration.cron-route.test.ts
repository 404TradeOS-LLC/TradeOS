const parseSupplierPriceSyncJobSpecs = jest.fn();
const runSupplierPriceSyncJobs = jest.fn();

jest.mock("../modules/supplier-integration/scheduler", () => ({
  parseSupplierPriceSyncJobSpecs,
  runSupplierPriceSyncJobs,
}));

jest.mock("../backend/logging", () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

import express from "express";
import request from "supertest";
import { createSupplierPriceSyncCronRouter } from "../backend/routes/supplierPriceSyncCron.routes";

const validSpec = {
  orgId: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  supplierId: "00000000-0000-0000-0000-000000000003",
  label: "ABC Supply",
};

function buildApp(options: { rateLimitWindowMs?: number; rateLimitMax?: number } = {}) {
  const app = express();
  app.use("/api/cron", createSupplierPriceSyncCronRouter(options));
  return app;
}

describe("supplier price sync Vercel cron route", () => {
  const previousCronSecret = process.env.CRON_SECRET;
  const previousJobs = process.env.SUPPLIER_PRICE_SYNC_JOBS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.SUPPLIER_PRICE_SYNC_JOBS = JSON.stringify([validSpec]);
    parseSupplierPriceSyncJobSpecs.mockReturnValue([validSpec]);
  });

  afterAll(() => {
    if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCronSecret;

    if (previousJobs === undefined) delete process.env.SUPPLIER_PRICE_SYNC_JOBS;
    else process.env.SUPPLIER_PRICE_SYNC_JOBS = previousJobs;
  });

  it("rejects requests without the Vercel cron bearer secret", async () => {
    const response = await request(buildApp()).get("/api/cron/supplier-price-sync");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
    expect(runSupplierPriceSyncJobs).not.toHaveBeenCalled();
  });

  it("fails closed when the supplier job list is empty", async () => {
    parseSupplierPriceSyncJobSpecs.mockReturnValue([]);

    const response = await request(buildApp())
      .get("/api/cron/supplier-price-sync")
      .set("Authorization", "Bearer test-cron-secret");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "supplier_price_sync_not_configured" });
    expect(runSupplierPriceSyncJobs).not.toHaveBeenCalled();
  });

  it("returns 500 when the configured job JSON is invalid", async () => {
    parseSupplierPriceSyncJobSpecs.mockImplementation(() => {
      throw new Error("SUPPLIER_PRICE_SYNC_JOBS must be valid JSON");
    });

    const response = await request(buildApp())
      .get("/api/cron/supplier-price-sync")
      .set("Authorization", "Bearer test-cron-secret");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "supplier_price_sync_configuration_invalid",
    });
    expect(runSupplierPriceSyncJobs).not.toHaveBeenCalled();
  });

  it("rate limits repeated cron attempts before invoking the supplier worker again", async () => {
    runSupplierPriceSyncJobs.mockResolvedValue([
      {
        spec: validSpec,
        status: "succeeded",
        attempt: 1,
        correlationId: "corr-rate-limit",
        result: { proposed: 0, skipped: 0 },
      },
    ]);

    const app = buildApp({ rateLimitMax: 1, rateLimitWindowMs: 60_000 });
    const first = await request(app)
      .get("/api/cron/supplier-price-sync")
      .set("Authorization", "Bearer test-cron-secret");
    const second = await request(app)
      .get("/api/cron/supplier-price-sync")
      .set("Authorization", "Bearer test-cron-secret");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: "too_many_supplier_sync_attempts" });
    expect(runSupplierPriceSyncJobs).toHaveBeenCalledTimes(1);
  });

  it("runs the configured sync jobs and returns aggregate success counts", async () => {
    runSupplierPriceSyncJobs.mockResolvedValue([
      {
        spec: validSpec,
        status: "succeeded",
        attempt: 1,
        correlationId: "corr-1",
        result: { proposed: 4, skipped: 2 },
      },
    ]);

    const response = await request(buildApp())
      .get("/api/cron/supplier-price-sync")
      .set("Authorization", "Bearer test-cron-secret");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      jobs: 1,
      proposed: 4,
      skipped: 2,
    });
    expect(runSupplierPriceSyncJobs).toHaveBeenCalledWith([validSpec]);
  });

  it("returns non-2xx when any configured sync target fails", async () => {
    runSupplierPriceSyncJobs.mockResolvedValue([
      {
        spec: validSpec,
        status: "terminal_failure",
        attempt: 1,
        correlationId: "corr-2",
        failureCode: "background_identity_invalid",
        nextAttemptAt: null,
        error: "background_identity_invalid",
      },
    ]);

    const response = await request(buildApp())
      .get("/api/cron/supplier-price-sync")
      .set("Authorization", "Bearer test-cron-secret");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: "failed",
      jobs: 1,
      succeeded: 0,
      failed: 1,
      proposed: 0,
      skipped: 0,
    });
  });
});
