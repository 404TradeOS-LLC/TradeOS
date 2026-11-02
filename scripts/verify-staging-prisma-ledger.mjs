/**
 * Read-only staging ledger gate. It never applies DDL or changes migration history.
 * Run before/after the existing protected staging Prisma deployment on trusted main.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const baselineMigration = "20261102020000_add_job_expenses";
export const reviewedStagingJobHandoff = Object.freeze({
  name: "20261028151000_accepted_proposal_job_handoff",
  checksum: "3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293",
});
const requiredPolicies = [
  "job_expenses_select_policy",
  "job_expenses_insert_policy",
  "job_expenses_update_policy",
  "job_expenses_delete_policy",
];
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export function evaluateLedger(inventory, ledger, expense, phase) {
  if (!["preflight", "postflight"].includes(phase)) throw Error("Unknown verification phase");
  if (!inventory || !Object.hasOwn(inventory, baselineMigration)) throw Error("Trusted main is missing expense baseline migration");
  if (!Array.isArray(ledger) || !expense || !Array.isArray(expense.policies)) throw Error("Missing staging evidence");
  const applied = new Set();
  for (const row of ledger) {
    if (row.rolled_back) continue;
    if (!row.finished) throw Error(`Unfinished migration: ${row.name}`);
    if (applied.has(row.name)) throw Error(`Duplicate successful migration: ${row.name}`);
    const expected = Object.hasOwn(inventory, row.name) ? inventory[row.name]
      : row.name === reviewedStagingJobHandoff.name ? reviewedStagingJobHandoff.checksum : undefined;
    if (!expected) throw Error(`Unrecognized/untracked staging migration: ${row.name}`);
    if (row.checksum !== expected) throw Error(`Migration checksum mismatch: ${row.name}`);
    applied.add(row.name);
  }
  const pending = Object.keys(inventory).filter(name => !applied.has(name));
  if (pending.some(name => name !== baselineMigration)) throw Error("Unrelated pending migration; do not deploy");
  if (phase === "postflight" && pending.length) throw Error("Expense baseline migration is pending after deployment");
  const isApplied = applied.has(baselineMigration);
  if (Boolean(expense.exists) !== isApplied) throw Error("Expense table/schema and migration ledger mismatch");
  if (expense.payerColumn) throw Error("Untracked payer column; separate payer migration approval required");
  if (isApplied) {
    if (expense.rls !== true || expense.forced !== true) throw Error("Expense RLS must be enabled and forced");
    const actual = new Set(expense.policies);
    if (actual.size !== requiredPolicies.length || requiredPolicies.some(p => !actual.has(p))) {
      throw Error("Expense RLS policy set drift");
    }
  } else if (expense.policies.length || expense.rls || expense.forced) {
    throw Error("Expense schema exists before tracked migration");
  }
  return { applied: applied.size, pending, expenseBaselineApplied: isApplied,
    stagingOnlyJobHandoff: applied.has(reviewedStagingJobHandoff.name) };
}

export function inventoryFromMain(root) {
  const base = path.join(root, "app/prisma/migrations");
  const inventory = Object.create(null);
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    inventory[entry.name] = sha256(readFileSync(path.join(base, entry.name, "migration.sql")));
  }
  return inventory;
}

export const evidenceSql = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'ledger', (SELECT COALESCE(json_agg(json_build_object(
    'name', migration_name, 'checksum', checksum,
    'finished', finished_at IS NOT NULL, 'rolled_back', rolled_back_at IS NOT NULL)), '[]'::json)
    FROM public._prisma_migrations),
  'expense', json_build_object(
    'exists', to_regclass('public.job_expenses') IS NOT NULL,
    'rls', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.job_expenses')), false),
    'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.job_expenses')), false),
    'policies', (SELECT COALESCE(json_agg(p.polname), '[]'::json) FROM pg_policy p
      WHERE p.polrelid = to_regclass('public.job_expenses')),
    'payerColumn', EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='job_expenses' AND column_name='payment_responsibility')
  )
);
COMMIT;`;

export function stagingUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error("Invalid staging database URL"); }
  const ref = "qfbgdkbamfaasmtjfyru";
  const user = decodeURIComponent(url.username);
  const direct = url.hostname === `db.${ref}.supabase.co` && (!url.port || url.port === "5432");
  const sessionPooler = url.hostname === "aws-0-us-east-2.pooler.supabase.com" &&
    ["5432","6543"].includes(url.port) && user.endsWith(`.${ref}`) &&
    /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-z0-9]{20}$/.test(user);
  if (!["postgres:","postgresql:"].includes(url.protocol) || url.pathname !== "/postgres" || !url.password ||
    !user || !(direct || sessionPooler) || url.hash) throw Error("Unapproved staging database identity");
  for (const [key,val] of url.searchParams) {
    if (!((key === "schema" && val === "public") || (key === "sslmode" && val === "require")) ||
        url.searchParams.getAll(key).length !== 1) throw Error("Unapproved staging database URL parameter");
  }
  return url;
}

export function main(env = process.env) {
  if (env.GITHUB_REF !== "refs/heads/main") throw Error("Trusted main workflow required");
  const phase = env.LEDGER_PHASE;
  if (!["preflight","postflight"].includes(phase)) throw Error("Unknown verification phase");
  const url = stagingUrl(env.DATABASE_ADMIN_URL);
  const pgEnv = {
    PATH: env.PATH, HOME: env.HOME, PGHOST: url.hostname,
    PGPORT: url.port === "6543" ? "5432" : (url.port || "5432"),
    PGDATABASE: "postgres", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "require",
    PGCONNECT_TIMEOUT: "15",
  };
  const result = spawnSync("psql", ["-X","-qAt","-v","ON_ERROR_STOP=1"],
    { input: evidenceSql, env: pgEnv, encoding: "utf8", timeout: 120_000, maxBuffer: 4*1024*1024 });
  if (result.error || result.status !== 0) throw Error("Protected staging evidence query failed (output redacted)");
  let evidence;
  try { evidence = JSON.parse(result.stdout.trim()); } catch { throw Error("Invalid staging evidence payload"); }
  const root = fileURLToPath(new URL("../",import.meta.url));
  const verdict = evaluateLedger(inventoryFromMain(root), evidence.ledger, evidence.expense, phase);
  console.log(JSON.stringify({ phase, projectRef: "qfbgdkbamfaasmtjfyru", ...verdict }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
