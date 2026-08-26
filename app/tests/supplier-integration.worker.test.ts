const runWithBackgroundDatabaseSession = jest.fn((_client, _input, operation: () => unknown) => operation());

jest.mock("../db/requestSession", () => ({ runWithBackgroundDatabaseSession }));
jest.mock("../db/client", () => ({ basePrisma: {} }));

import { runSupplierPriceSyncJob } from "../modules/supplier-integration/worker";

describe("runSupplierPriceSyncJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs the sync inside a background database session scoped to the worker identity", async () => {
    const syncFromFeed = jest.fn().mockResolvedValue({ proposed: 2, skipped: 1 });
    const service = { syncFromFeed } as never;

    const result = await runSupplierPriceSyncJob(
      { orgId: "org-1", userId: "worker-user-1", supplierId: "supplier-1" },
      service
    );

    expect(runWithBackgroundDatabaseSession).toHaveBeenCalledWith(
      {},
      { jobName: "supplier-price-sync", orgId: "org-1", userId: "worker-user-1" },
      expect.any(Function)
    );
    expect(syncFromFeed).toHaveBeenCalledWith({
      orgId: "org-1",
      supplierId: "supplier-1",
      requestedByJob: "job:supplier-price-sync",
    });
    expect(result).toEqual({ proposed: 2, skipped: 1 });
  });
});
