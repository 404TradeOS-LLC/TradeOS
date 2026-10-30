import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("TEST_DATABASE_ADMIN_URL is required for Team & Time RLS tests");
const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
const rawMigration = readFileSync(
  resolve(__dirname, "../prisma/migrations/20261030010000_force_team_time_rls/migration.sql"), "utf8",
);
const requiredTables = ["team_time_events", "team_time_profiles", "team_time_shifts"];

afterAll(async () => admin.$disconnect());

test("missing Team & Time foundation fails closed without an applied-looking no-op", async () => {
  const schema = `p0_force_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const migration = rawMigration.replaceAll("public.", `${schema}.`);
  await expect(admin.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(migration);
  }, { timeout: 30_000 })).rejects.toThrow(/Team & Time schema missing/);
  const rows = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='${schema}') AS exists`,
  );
  expect(rows[0]?.exists).toBe(false);
});

test("FORCE migration is repeatable with absent policies; non-bypass roles still see zero rows", async () => {
  const schema = `p0_force_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const migration = rawMigration.replaceAll("public.", `${schema}.`);
  await expect(admin.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const table of requiredTables) {
      await tx.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (id integer PRIMARY KEY)`);
      await tx.$executeRawUnsafe(`INSERT INTO "${schema}"."${table}" (id) VALUES (1)`);
    }
    await tx.$executeRawUnsafe(migration);
    await tx.$executeRawUnsafe(migration);

    const states = await tx.$queryRawUnsafe<Array<{
      relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean; policies: bigint;
    }>>(`
      SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
        (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='${schema}' AND c.relkind='r'
      ORDER BY c.relname
    `);
    expect(states.map(s => s.relname)).toEqual(requiredTables);
    expect(states.every(s => s.relrowsecurity && s.relforcerowsecurity && s.policies === 0n)).toBe(true);

    // Grant fixture access so the RLS policy default-deny, not table ACLs,
    // is what blocks the non-bypass application role.
    await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA "${schema}" TO tradeos_app`);
    await tx.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO tradeos_app`);
    const ownerRows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "${schema}"."team_time_shifts"`,
    );
    expect(ownerRows[0]?.count).toBe(1n); // administrative test role
    await tx.$executeRawUnsafe("SET LOCAL ROLE tradeos_app");
    const appRows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "${schema}"."team_time_shifts"`,
    );
    expect(appRows[0]?.count).toBe(0n);
    await tx.$executeRawUnsafe("RESET ROLE");
    throw new Error("ROLL_BACK_RLS_FIXTURE");
  }, { timeout: 30_000 })).rejects.toThrow("ROLL_BACK_RLS_FIXTURE");

  const after = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='${schema}') AS exists`,
  );
  expect(after[0]?.exists).toBe(false);
});

test("migrated source-controlled Team & Time foundation precedes FORCE with audited indexes", async () => {
  const tables = await admin.$queryRawUnsafe<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>(
    `SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('team_time_events','team_time_profiles','team_time_shifts')
    ORDER BY c.relname`,
  );
  expect(tables.map(r => r.relname)).toEqual(requiredTables);
  expect(tables.every(r => r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
  const trigger = await admin.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*) AS count FROM pg_trigger
    WHERE tgrelid='public.team_time_shifts'::regclass
      AND tgname='team_time_shift_audit' AND NOT tgisinternal`,
  );
  expect(trigger[0]?.count).toBe(1n);
});
