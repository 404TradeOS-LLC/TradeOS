import { Prisma, PrismaClient } from "@prisma/client";
import { getCurrentDatabaseSessionActor, getRequestDatabaseClient, runWithDatabaseSession } from "../db/requestSession";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required for rotation pool integration tests");
const singleConnectionUrl = new URL(testUrl);
singleConnectionUrl.searchParams.set("connection_limit", "1");
const options = { datasources: { db: { url: singleConnectionUrl.toString() } } };

// Two separate Prisma pools: the HTTP pricing request owns its only
// connection while token rotation commits through another restricted client.
const requestClient = new PrismaClient(options);
const rotationClient = new PrismaClient(options);
const actor = {
  userId: "59000000-0000-0000-0000-000000000001",
  orgId: "59000000-0000-0000-0000-000000000002",
  role: "owner" as const,
};

describe("ABC provider refresh rotation database pool", () => {
  afterAll(async () => {
    await Promise.all([requestClient.$disconnect(), rotationClient.$disconnect()]);
  });

  it("acquires a second scoped transaction while the request's sole connection is held", async () => {
    await expect(
      runWithDatabaseSession(requestClient, actor, async () => {
        const outer = getRequestDatabaseClient();
        if (!outer) throw new Error("missing outer transaction");
        const outerRows = await outer.$queryRaw<Array<{ pid: number }>>(Prisma.sql`select pg_backend_pid()::int as pid`);

        const rotationPid = await runWithDatabaseSession(
          rotationClient,
          actor,
          async () => {
            const inner = getRequestDatabaseClient();
            if (!inner || inner === outer) throw new Error("rotation reused the request transaction");
            expect(getCurrentDatabaseSessionActor()).toMatchObject(actor);
            const innerRows = await inner.$queryRaw<Array<{ pid: number }>>(Prisma.sql`select pg_backend_pid()::int as pid`);
            return innerRows[0].pid;
          },
          "supplier_refresh_token_rotation",
        );
        expect(rotationPid).not.toBe(outerRows[0].pid);
        // The inner transaction committed; the caller may now roll back.
        throw new Error("pricing transaction rolled back");
      }, "pricing-probe"),
    ).rejects.toThrow("pricing transaction rolled back");
  }, 20_000);
});
