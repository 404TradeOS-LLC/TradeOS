import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("TEST_DATABASE_ADMIN_URL is required for Team & Time FORCE RLS tests");

const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
const rawMigration = readFileSync(
  resolve(__dirname, "../prisma/migrations/20261030010000_force_team_time_rls/migration.sql"),
  "utf8",
);

afterAll(async () => {
  await admin.$disconnect();
});

test("Team & Time FORCE RLS skips missing tables, protects present tables, and is repeatable", async () => {
  // Use an isolated, randomly named test schema, never the live public schema.
  // Only the literal schema qualifier changes; the actual reviewed migration
  // logic and table-name inventory are executed unchanged.
  const schema = `p0_force_rls_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const migration = rawMigration.replaceAll("public.", `${schema}.`);
  expect(migration).toContain("FORCE ROW LEVEL SECURITY");
  expect(migration).toContain("to_regclass");

  await expect(admin.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    // Missing tables are a valid state for a clean Prisma-only installation.
    await tx.$executeRawUnsafe(migration);
    const empty = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relkind='r'`,
    );
    expect(empty[0]?.count).toBe(0n);

    for (const table of ["team_time_profiles", "team_time_shifts", "team_time_events"]) {
      await tx.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (id uuid PRIMARY KEY)`);
    }
    await tx.$executeRawUnsafe(migration);
    await tx.$executeRawUnsafe(migration);

    const states = await tx.$queryRawUnsafe<
      Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean; policies: bigint }>
    >(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
        (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='${schema}' AND c.relkind='r'
      ORDER BY c.relname
    `);
    expect(states).toHaveLength(3);
    expect(states.map(x => x.relname).sort()).toEqual([
      "team_time_events", "team_time_profiles", "team_time_shifts",
    ]);
    expect(states.every(x => x.relrowsecurity && x.relforcerowsecurity)).toBe(true);
    expect(states.every(x => x.policies === 0n)).toBe(true);
    // Test fixture DDL must not survive the transaction.
    throw new Error("ROLLED_BACK_TEAM_TIME_RLS_TEST");
  })).rejects.toThrow("ROLLED_BACK_TEAM_TIME_RLS_TEST");

  const schemaAfter = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='${schema}') AS exists`,
  );
  expect(schemaAfter[0]?.exists).toBe(false);
});
