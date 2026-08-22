import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";

const databaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const singleConnectionUrl = new URL(databaseUrl);
singleConnectionUrl.searchParams.set("connection_limit", "1");

const appClient = new PrismaClient({
  datasources: { db: { url: singleConnectionUrl.toString() } },
});

const auth = {
  userId: "59000000-0000-0000-0000-000000000001",
  orgId: "59000000-0000-0000-0000-000000000002",
  role: "admin" as const,
};

describe("request database session transaction acquisition", () => {
  const originalMaxWait = process.env.RLS_TRANSACTION_MAX_WAIT_MS;
  const originalTimeout = process.env.RLS_TRANSACTION_TIMEOUT_MS;

  afterAll(async () => {
    if (originalMaxWait === undefined) delete process.env.RLS_TRANSACTION_MAX_WAIT_MS;
    else process.env.RLS_TRANSACTION_MAX_WAIT_MS = originalMaxWait;
    if (originalTimeout === undefined) delete process.env.RLS_TRANSACTION_TIMEOUT_MS;
    else process.env.RLS_TRANSACTION_TIMEOUT_MS = originalTimeout;
    await appClient.$disconnect();
  });

  it("waits beyond Prisma's default acquisition window for a busy single-connection pool", async () => {
    process.env.RLS_TRANSACTION_MAX_WAIT_MS = "5000";
    process.env.RLS_TRANSACTION_TIMEOUT_MS = "5000";

    let releaseFirst!: () => void;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstAcquired!: () => void;
    const acquiredFirst = new Promise<void>((resolve) => {
      firstAcquired = resolve;
    });

    const first = runWithDatabaseSession(appClient, auth, async () => {
      firstAcquired();
      await holdFirst;
    }, "integration-test");
    await acquiredFirst;

    const second = runWithDatabaseSession(appClient, auth, async () => "acquired", "integration-test");

    await new Promise((resolve) => setTimeout(resolve, 2_200));
    releaseFirst();

    await expect(second).resolves.toBe("acquired");
    await first;
  }, 10_000);
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for request database session integration tests`);
  return value;
}
