import { Prisma } from "@prisma/client";
import { getRequestDatabaseClient, runWithDatabaseSession } from "../db/requestSession";

describe("request database session", () => {
  const originalMaxWait = process.env.RLS_TRANSACTION_MAX_WAIT_MS;
  const originalTimeout = process.env.RLS_TRANSACTION_TIMEOUT_MS;

  beforeEach(() => {
    delete process.env.RLS_TRANSACTION_MAX_WAIT_MS;
    delete process.env.RLS_TRANSACTION_TIMEOUT_MS;
  });

  afterEach(() => {
    if (originalMaxWait === undefined) delete process.env.RLS_TRANSACTION_MAX_WAIT_MS;
    else process.env.RLS_TRANSACTION_MAX_WAIT_MS = originalMaxWait;
    if (originalTimeout === undefined) delete process.env.RLS_TRANSACTION_TIMEOUT_MS;
    else process.env.RLS_TRANSACTION_TIMEOUT_MS = originalTimeout;
  });

  it("sets transaction-local auth values and exposes the transaction client", async () => {
    const transaction = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const client = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<string>) => callback(transaction)),
    };

    const result = await runWithDatabaseSession(
      client as never,
      { userId: "user-1", orgId: "org-1", role: "admin" },
      async () => {
        expect(getRequestDatabaseClient()).toBe(transaction);
        return "complete";
      }
    );

    expect(result).toBe("complete");
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw.mock.calls[0][0]).toBeInstanceOf(Object);
    expect(transaction.$queryRaw.mock.calls[0][0]).toMatchObject({
      values: ["user-1", "org-1", "admin", "http"],
    } satisfies Partial<Prisma.Sql>);
    expect(getRequestDatabaseClient()).toBeUndefined();
  });

  it("uses bounded default transaction acquisition and execution timeouts", async () => {
    const transaction = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const client = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
    };

    await runWithDatabaseSession(
      client as never,
      { userId: "user-1", orgId: "org-1", role: "viewer" },
      async () => undefined
    );

    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 15_000,
      timeout: 60_000,
    });
  });

  it("accepts a positive transaction acquisition wait override", async () => {
    process.env.RLS_TRANSACTION_MAX_WAIT_MS = "9000";
    const transaction = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const client = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
    };

    await runWithDatabaseSession(
      client as never,
      { userId: "user-1", orgId: "org-1", role: "viewer" },
      async () => undefined
    );

    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 9_000,
      timeout: 60_000,
    });
  });

  it.each(["0", "-1", "not-a-number"])(
    "falls back to the bounded acquisition wait for invalid override %s",
    async (value) => {
      process.env.RLS_TRANSACTION_MAX_WAIT_MS = value;
      const transaction = { $queryRaw: jest.fn().mockResolvedValue([]) };
      const client = {
        $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
      };

      await runWithDatabaseSession(
        client as never,
        { userId: "user-1", orgId: "org-1", role: "viewer" },
        async () => undefined
      );

      expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 15_000,
        timeout: 60_000,
      });
    }
  );
});
