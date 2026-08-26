import { runWithBackgroundDatabaseSession } from "../db/requestSession";

describe("background database session", () => {
  it("rejects invalid job names before opening a transaction", async () => {
    const client = { $transaction: jest.fn() };

    await expect(
      runWithBackgroundDatabaseSession(
        client as never,
        { jobName: "bad job name", orgId: "org-1", userId: "user-1" },
        async () => undefined
      )
    ).rejects.toThrow("Background job name");
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("rejects identities without an active membership", async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      appUser: { findFirst: jest.fn().mockResolvedValue({ id: "user-1", email: "worker@example.com" }) },
      organizationMembership: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const client = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };

    await expect(
      runWithBackgroundDatabaseSession(
        client as never,
        { jobName: "pricing-refresh", orgId: "org-1", userId: "user-1" },
        async () => undefined
      )
    ).rejects.toThrow("active organization membership");
  });
});
