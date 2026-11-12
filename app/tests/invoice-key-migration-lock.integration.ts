import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = "invoice_key_rehearsal";
const migration = readFileSync(resolve(__dirname, "../prisma/migrations/20261109172000_add_invoice_create_request_key/migration.sql"), "utf8");

// Fail closed outside the disposable PostgreSQL created by test-integration-db.sh.
function databaseUrl(): string {
  const uri = process.env.TEST_DATABASE_ADMIN_URL ?? "";
  if (!/^postgresql:\/\/postgres:tradeos_test@127\.0\.0\.1:\d+\/tradeos_test\?schema=public$/.test(uri)) {
    throw new Error("Invoice rehearsal requires isolated local tradeos_test Postgres");
  }
  return uri.slice(0, uri.indexOf("?"));
}

function sql(input: string, allowFailure = false) {
  const result = spawnSync("psql", [databaseUrl(), "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    input, encoding: "utf8", timeout: 90_000, maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const status = result.status ?? -1;
  if (status !== 0 && !allowFailure) throw new Error(`psql failed: ${result.stderr}`);
  return { output: result.stdout, error: result.stderr, status };
}

function prepare(rowCount: number): void {
  sql(`
    DROP SCHEMA IF EXISTS ${schema} CASCADE;
    CREATE SCHEMA ${schema};
    CREATE TABLE ${schema}.invoices (LIKE public.invoices INCLUDING ALL);
    ALTER TABLE ${schema}.invoices DROP COLUMN create_request_key;
    ALTER TABLE ${schema}.invoices DROP COLUMN create_request_hash;
    INSERT INTO ${schema}.invoices (id, project_id, invoice_number)
      SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000777', i
      FROM generate_series(1, ${rowCount}) AS i;
  `);
}

function apply(allowFailure = false) {
  return sql(`SET search_path TO ${schema};\n${migration}`, allowFailure);
}

function requestColumnCount(): number {
  return Number(sql(`SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = 'invoices'
      AND column_name IN ('create_request_key', 'create_request_hash');`).output.trim());
}

function holdReadLock(): Promise<ChildProcessWithoutNullStreams> {
  return new Promise((resolveLock, rejectLock) => {
    const holder = spawn("psql", [databaseUrl(), "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"]);
    let ready = false;
    let output = "";
    holder.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (!ready && output.includes("LOCK_HELD")) {
        ready = true;
        resolveLock(holder);
      }
    });
    holder.once("error", rejectLock);
    holder.once("close", (code) => {
      if (!ready) rejectLock(new Error(`Reader exited before acquiring lock: ${code}`));
    });
    holder.stdin.end(`BEGIN;
      LOCK TABLE ${schema}.invoices IN ACCESS SHARE MODE;
      SELECT 'LOCK_HELD';
      SELECT pg_sleep(6);
      COMMIT;`);
  });
}

describe("invoice request-key migration on disposable PostgreSQL", () => {
  beforeAll(() => {
    databaseUrl();
    expect(migration).toContain("SET LOCAL lock_timeout = '3s'");
    expect(migration).toContain("CREATE UNIQUE INDEX invoices_project_create_request_key");
  });
  afterAll(() => sql(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`));

  it("rejects a read-lock conflict and rolls back without partial columns", async () => {
    prepare(39);
    const holder = await holdReadLock();
    try {
      const started = Date.now();
      const result = apply(true);
      expect(result.status).not.toBe(0);
      expect(result.error).toMatch(/lock timeout/i);
      expect(Date.now() - started).toBeLessThan(6_000);
      expect(requestColumnCount()).toBe(0);
    } finally {
      await new Promise<void>((finish) => {
        if (holder.exitCode !== null) return finish();
        holder.once("close", () => finish());
      });
    }
  }, 30_000);

  it.each([39, 100_000])("applies the exact migration to %i cloned invoice rows", (count) => {
    prepare(count);
    const bytes = Number(sql(`SELECT pg_total_relation_size('${schema}.invoices'::regclass);`).output.trim());
    const start = Date.now();
    apply();
    const wallClockMs = Date.now() - start;
    expect(requestColumnCount()).toBe(2);
    expect(sql(`SELECT i.indisunique::text || ',' || i.indisvalid::text
      FROM pg_index i JOIN pg_class idx ON idx.oid = i.indexrelid
      WHERE idx.relnamespace = '${schema}'::regnamespace
        AND idx.relname = 'invoices_project_create_request_key';`).output.trim()).toBe("true,true");
    expect(sql(`SELECT convalidated::text FROM pg_constraint
      WHERE conrelid = '${schema}.invoices'::regclass
        AND conname = 'invoices_create_request_pair_check';`).output.trim()).toBe("false");
    console.log(`Invoice migration rehearsal: syntheticRows=${count} preMigrationBytes=${bytes} psqlWallClockMs=${wallClockMs} (disposable PostgreSQL only)`);
  }, 90_000);
});
