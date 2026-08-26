const runSupplierPriceSyncJob = jest.fn();
jest.mock("../modules/supplier-integration/worker", () => ({ runSupplierPriceSyncJob }));

const scheduledTask = { stop: jest.fn() };
const cronValidate = jest.fn().mockReturnValue(true);
const cronSchedule = jest.fn().mockReturnValue(scheduledTask);
jest.mock("node-cron", () => ({ validate: cronValidate, schedule: cronSchedule }));

import {
  parseSupplierPriceSyncJobSpecs,
  runSupplierPriceSyncJobs,
  startSupplierPriceSyncScheduler,
} from "../modules/supplier-integration/scheduler";

const validSpec = {
  orgId: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  supplierId: "00000000-0000-0000-0000-000000000003",
  label: "Acme",
};

describe("parseSupplierPriceSyncJobSpecs", () => {
  it("returns an empty array when unset or blank", () => {
    expect(parseSupplierPriceSyncJobSpecs(undefined)).toEqual([]);
    expect(parseSupplierPriceSyncJobSpecs("   ")).toEqual([]);
  });

  it("parses a valid JSON array of job specs", () => {
    expect(parseSupplierPriceSyncJobSpecs(JSON.stringify([validSpec]))).toEqual([validSpec]);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSupplierPriceSyncJobSpecs("not json")).toThrow("must be valid JSON");
  });

  it("rejects a spec missing required fields", () => {
    expect(() => parseSupplierPriceSyncJobSpecs(JSON.stringify([{ orgId: "not-a-uuid" }]))).toThrow("malformed");
  });
});

describe("runSupplierPriceSyncJobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs every spec and isolates failures from one another", async () => {
    const secondSpec = { ...validSpec, supplierId: "00000000-0000-0000-0000-000000000004", label: "Beta" };
    runSupplierPriceSyncJob
      .mockRejectedValueOnce(new Error("missing membership"))
      .mockResolvedValueOnce({ proposed: 2, skipped: 1 });

    const outcomes = await runSupplierPriceSyncJobs([validSpec, secondSpec]);

    expect(outcomes).toEqual([
      { spec: validSpec, error: "missing membership" },
      { spec: secondSpec, result: { proposed: 2, skipped: 1 } },
    ]);
    expect(runSupplierPriceSyncJob).toHaveBeenCalledTimes(2);
  });
});

describe("startSupplierPriceSyncScheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cronValidate.mockReturnValue(true);
    delete process.env.SUPPLIER_PRICE_SYNC_CRON_SCHEDULE;
    delete process.env.SUPPLIER_PRICE_SYNC_JOBS;
  });

  it("no-ops when no schedule or job specs are configured", () => {
    expect(startSupplierPriceSyncScheduler({ jobSpecs: [validSpec] })).toBeUndefined();
    expect(startSupplierPriceSyncScheduler({ schedule: "0 * * * *" })).toBeUndefined();
    expect(cronSchedule).not.toHaveBeenCalled();
  });

  it("throws on an invalid cron expression instead of silently failing", () => {
    cronValidate.mockReturnValue(false);
    expect(() =>
      startSupplierPriceSyncScheduler({ schedule: "not a cron expression", jobSpecs: [validSpec] })
    ).toThrow("not a valid cron expression");
  });

  it("schedules the job and runs every spec on each tick", async () => {
    const task = startSupplierPriceSyncScheduler({ schedule: "0 * * * *", jobSpecs: [validSpec] });

    expect(task).toBe(scheduledTask);
    expect(cronSchedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function));

    runSupplierPriceSyncJob.mockResolvedValue({ proposed: 1, skipped: 0 });
    const tickFn = cronSchedule.mock.calls[0][1] as () => void;
    tickFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(runSupplierPriceSyncJob).toHaveBeenCalledWith(validSpec);
  });

  it("reports outcomes via onTick", async () => {
    const onTick = jest.fn();
    startSupplierPriceSyncScheduler({ schedule: "0 * * * *", jobSpecs: [validSpec], onTick });

    runSupplierPriceSyncJob.mockResolvedValue({ proposed: 0, skipped: 0 });
    const tickFn = cronSchedule.mock.calls[0][1] as () => void;
    tickFn();
    await new Promise((resolve) => setImmediate(resolve));

    expect(onTick).toHaveBeenCalledWith([{ spec: validSpec, result: { proposed: 0, skipped: 0 } }]);
  });
});
