const mockParseSpecs = jest.fn();
const mockRunJobs = jest.fn();

jest.mock("../modules/supplier-integration/scheduler", () => ({
  parseSupplierPriceSyncJobSpecs: (...args: unknown[]) => mockParseSpecs(...args),
  runSupplierPriceSyncJobs: (...args: unknown[]) => mockRunJobs(...args),
}));

import { cronController } from "../backend/controllers/cron.controller";

const CRON_SECRET = "test-cron-secret";

function request(authorization?: string) {
  return {
    headers: authorization === undefined ? {} : { authorization },
  } as never;
}

interface MockResponse {
  json: jest.Mock;
  status: jest.Mock;
}

function response(): MockResponse {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
}

function callController(authorization?: string, res?: MockResponse) {
  const responseToUse = res ?? response();
  return {
    promise: cronController.runSupplierPriceSync(request(authorization), responseToUse as never),
    res: responseToUse,
  };
}

describe("cronController.runSupplierPriceSync", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
    mockParseSpecs.mockReturnValue([{ label: "ABC Supply" }]);
    mockRunJobs.mockResolvedValue([{ status: "succeeded" }]);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects requests without the cron bearer secret", async () => {
    const { promise, res } = callController();
    await promise;
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockRunJobs).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong secret", async () => {
    const { promise, res } = callController("Bearer wrong-secret");
    await promise;
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "unauthorized" });
    expect(mockRunJobs).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { promise, res } = callController(`Bearer ${CRON_SECRET}`);
    await promise;
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "cron_not_configured" });
    expect(mockRunJobs).not.toHaveBeenCalled();
  });

  it("runs the configured sync jobs and returns outcomes on valid cron auth", async () => {
    process.env.SUPPLIER_PRICE_SYNC_JOBS = JSON.stringify([{ label: "ABC Supply" }]);
    const { promise, res } = callController(`Bearer ${CRON_SECRET}`);
    await promise;
    expect(mockParseSpecs).toHaveBeenCalledWith(process.env.SUPPLIER_PRICE_SYNC_JOBS);
    expect(mockRunJobs).toHaveBeenCalledWith([{ label: "ABC Supply" }]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ outcomes: [{ status: "succeeded" }] });
    delete process.env.SUPPLIER_PRICE_SYNC_JOBS;
  });
});
