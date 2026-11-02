import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { hash, projectRef, stagingConnection, validateEvidence as validateHandoff,
  migrationName as handoffName, migrationHash as handoffHash } from "./staging-job-handoff-migration.mjs";

export { handoffName, handoffHash };
export const expenseName = "20261102020000_add_job_expenses";
export const expenseHash = "c6599040d635a5aa69ae8b5b01a2f29014617a751b822ea015395ea9231743a1";

export function validateRequest({ ref, sourceSha, mode, approvedSha, confirmation }) {
  if (ref !== "refs/heads/main") throw Error("Only trusted main may invoke this runner");
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? "")) throw Error("Exact reviewed staging source SHA required");
  if (!["preflight", "apply"].includes(mode)) throw Error("Unknown migration mode");
  if (mode === "apply" && (approvedSha !== sourceSha || confirmation !== "APPLY_STAGING_JOB_EXPENSES")) {
    throw Error("Apply requires protected, exact-SHA approval and typed staging confirmation");
  }
}

export function verifySourceSql(handoffSql, expenseSql) {
  if (hash(handoffSql) !== handoffHash) throw Error("Applied Job handoff source checksum changed");
  if (hash(expenseSql) !== expenseHash) throw Error("Expense source checksum differs from reviewed SQL");
  return true;
}

const expectedColumns = ["id","org_id","job_id","amount_cents","category","vendor","receipt_note",
  "incurred_on","created_by_id","created_at","updated_at"].sort();
const expectedIndexes = ["job_expenses_pkey","job_expenses_org_job_idx","job_expenses_job_incurred_idx"].sort();
const expectedPolicies = ["job_expenses_select_policy","job_expenses_insert_policy",
  "job_expenses_update_policy","job_expenses_delete_policy"].sort();
const expectedChecks = ["job_expenses_amount_cents_check","job_expenses_category_check",
  "job_expenses_vendor_check","job_expenses_receipt_note_check","job_expenses_pkey"];
const equalSorted = (a, b) => Array.isArray(a) && a.length === b.length &&
  a.slice().sort().every((v, i) => v === b.slice().sort()[i]);

export function validateProof(inventory, evidence, { requireApplied = false } = {}) {
  if (!evidence || !Array.isArray(evidence.ledger) || !evidence.expenses) {
    throw Error("Incomplete migration evidence");
  }
  if (evidence.helpers !== 4) throw Error("Staging request-session RLS helper drift");
  if (inventory[expenseName] !== expenseHash || inventory[handoffName] !== handoffHash) {
    throw Error("Reviewed migration checksum missing from inventory");
  }
  const handoffInventory = { ...inventory };
  delete handoffInventory[expenseName];
  // Reuse the independently tested, strict handoff verification to preserve
  // every earlier successful migration checksum, the original Job schema,
  // unique source index, and FORCE RLS. No replay or ledger stamping.
  validateHandoff(handoffInventory, {
    ledger: evidence.ledger.filter((row) => row.name !== expenseName),
    columns: evidence.columns, indexes: evidence.indexes,
    rls: evidence.rls, forced: evidence.forced
  }, { requireApplied: true });

  const attempts = evidence.ledger.filter((row) => row.name === expenseName && !row.rolled_back);
  if (attempts.some((row) => !row.finished) || attempts.length > 1 ||
      attempts.some((row) => row.checksum !== expenseHash)) {
    throw Error("Unfinished, duplicate or checksum-drifted Expense migration");
  }
  const targetApplied = attempts.length === 1;
  if (requireApplied && !targetApplied) throw Error("Expense migration is not successfully applied");
  const e = evidence.expenses;
  if (!targetApplied) {
    if (e.exists || e.columns.length || e.indexes.length || e.policies.length) {
      throw Error("Partial/untracked Expense table exists before migration");
    }
  } else {
    if (!e.exists || e.rls !== true || e.forced !== true || e.grants !== 0 ||
        !equalSorted(e.columns, expectedColumns) ||
        !equalSorted(e.indexes, expectedIndexes) ||
        !equalSorted(e.policies, expectedPolicies) ||
        !Array.isArray(e.constraints) || expectedChecks.some((n) => !e.constraints.includes(n)) ||
        !equalSorted(e.appRoleGrants, ["SELECT","INSERT","UPDATE","DELETE"])) {
      throw Error("Expense schema, RLS, policies, role grants or constraints failed postflight");
    }
  }
  return { targetApplied, completed: Object.keys(handoffInventory).length + (targetApplied ? 1 : 0),
    missing: targetApplied ? [] : [expenseName] };
}

export function performMigration(mode, inventory, before, deploy, captureAfter) {
  if (!["preflight", "apply"].includes(mode)) throw Error("Unknown migration mode");
  const initial = validateProof(inventory, before);
  if (mode === "preflight" || initial.targetApplied) return initial;
  deploy();
  return validateProof(inventory, captureAfter(), { requireApplied: true });
}

function evidenceSql(role) {
  // The role name is an exact-match restricted identifier, never a user string.
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw Error("Missing or invalid staging application role");
  const roleLiteral = "'" + role + "'";
  const privileges = ["SELECT","INSERT","UPDATE","DELETE"];
  const roleGrants = privileges.map((p) => "CASE WHEN has_table_privilege(" + roleLiteral +
    ", 'public.job_expenses', '" + p + "') THEN '" + p + "' END").join(",");
  return [
    "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;",
    "SELECT json_build_object(",
    " 'ledger', (SELECT coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum,'finished',finished_at IS NOT NULL,'rolled_back',rolled_back_at IS NOT NULL)), '[]'::json) FROM public._prisma_migrations),",
    " 'columns', (SELECT coalesce(json_agg(json_build_object('name',column_name,'type',data_type,'nullable',is_nullable='YES','default',column_default)), '[]'::json) FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name IN ('source_proposal_id','accepted_baseline_json')),",
    " 'indexes', (SELECT coalesce(json_agg(json_build_object('unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,'keys',pg_get_indexdef(i.indexrelid,1,true),'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid),'keyCount',i.indnkeyatts,'totalCount',i.indnatts,'nullsNotDistinct',i.indnullsnotdistinct)), '[]'::json) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.jobs'::regclass AND c.relname='jobs_source_proposal_id_key'),",
    " 'rls', (SELECT relrowsecurity FROM pg_class WHERE oid='public.jobs'::regclass),",
    " 'forced', (SELECT relforcerowsecurity FROM pg_class WHERE oid='public.jobs'::regclass),",
    " 'helpers', (SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('current_app_org_id','current_app_can_administer','current_app_user_id','current_app_role')),",
    " 'expenses', json_build_object(",
    "  'exists', to_regclass('public.job_expenses') IS NOT NULL,",
    "  'rls', (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.job_expenses')),",
    "  'forced', (SELECT relforcerowsecurity FROM pg_class WHERE oid=to_regclass('public.job_expenses')),",
    "  'columns', (SELECT coalesce(json_agg(column_name ORDER BY ordinal_position),'[]'::json) FROM information_schema.columns WHERE table_schema='public' AND table_name='job_expenses'),",
    "  'indexes', (SELECT coalesce(json_agg(indexname ORDER BY indexname),'[]'::json) FROM pg_indexes WHERE schemaname='public' AND tablename='job_expenses'),",
    "  'policies', (SELECT coalesce(json_agg(policyname ORDER BY policyname),'[]'::json) FROM pg_policies WHERE schemaname='public' AND tablename='job_expenses'),",
    "  'constraints', (SELECT coalesce(json_agg(conname ORDER BY conname),'[]'::json) FROM pg_constraint WHERE conrelid=to_regclass('public.job_expenses')),",
    "  'grants', (SELECT count(*)::integer FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='job_expenses' AND grantee IN ('anon','authenticated','PUBLIC')),",
    "  'appRoleGrants', CASE WHEN to_regclass('public.job_expenses') IS NULL THEN '[]'::json ELSE",
    "   to_json(array_remove(ARRAY[" + roleGrants + "], NULL)) END",
    " )",
    ");",
    "COMMIT;"
  ].join("\n");
}

function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024, ...options
  });
  // Never print subprocess logs. CLI/psql errors can contain DB connection URLs.
  if (result.error || result.status !== 0) {
    throw Error("Protected migration tool failed: " + path.basename(program) + "; inspect protected evidence");
  }
  return result.stdout;
}

export function main(env = process.env) {
  validateRequest({ ref: env.GITHUB_REF, sourceSha: env.SOURCE_SHA, mode: env.MIGRATION_MODE,
    approvedSha: env.APPROVED_SOURCE_SHA, confirmation: env.CONFIRMATION });
  const url = stagingConnection(env.STAGING_DATABASE_ADMIN_URL);
  const role = env.STAGING_APP_DB_ROLE_NAME;
  if (!/^[a-z_][a-z0-9_]*$/.test(role ?? "") || !env.APP_DB_ROLE_PASSWORD) {
    throw Error("Staging application role/name credentials missing or invalid");
  }
  const root = fileURLToPath(new URL("../", import.meta.url));
  const trustedEnv = { PATH: env.PATH, HOME: env.HOME, CI: "true" };
  // Source SHA is fetched as data only. Neither branch scripts nor package
  // dependencies are checked out or executed with the staging admin secret.
  const readMigration = (name) => run("git", ["show", env.SOURCE_SHA +
    ":app/prisma/migrations/" + name + "/migration.sql"], { cwd: root, env: trustedEnv });
  const handoffSql = readMigration(handoffName);
  const expenseSql = readMigration(expenseName);
  verifySourceSql(handoffSql, expenseSql);

  const migrationRoot = path.join(root, "app/prisma/migrations");
  const inventory = {};
  for (const entry of readdirSync(migrationRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      inventory[entry.name] = hash(readFileSync(path.join(migrationRoot, entry.name, "migration.sql")));
    }
  }
  if (inventory[expenseName] !== expenseHash) throw Error("Trusted main Expense SQL differs from reviewed source");
  if (inventory[handoffName] && inventory[handoffName] !== handoffHash) {
    throw Error("Trusted main Job handoff SQL differs from applied historical checksum");
  }
  inventory[handoffName] = handoffHash;
  const pgEnv = { ...trustedEnv, PGHOST: url.hostname, PGPORT: url.port,
    PGDATABASE: "postgres", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "require", PGCONNECT_TIMEOUT: "15" };
  const capture = () => JSON.parse(run("psql", ["-X","-qAt","-v","ON_ERROR_STOP=1"], {
    env: pgEnv, input: evidenceSql(role)
  }));
  const before = capture();
  const first = validateProof(inventory, before);
  console.log(JSON.stringify({ mode: env.MIGRATION_MODE, sourceSha: env.SOURCE_SHA,
    projectRef, handoffName, expenseName, expenseHash, ...first }));
  const after = performMigration(env.MIGRATION_MODE, inventory, before, () => {
    // Only reviewed, checksum-pinned SQL bytes are added to trusted main's
    // inventory; Prisma runs from main, never a feature-branch package.
    const destination = path.join(migrationRoot, handoffName);
    if (!inventory[handoffName]) throw Error("Handoff identity absent");
    mkdirSync(destination, { recursive: true });
    writeFileSync(path.join(destination, "migration.sql"), handoffSql);
    const credentials = { ...trustedEnv, DATABASE_URL: url.toString(),
      DATABASE_ADMIN_URL: url.toString(), APP_DB_ROLE_NAME: role,
      APP_DB_ROLE_PASSWORD: env.APP_DB_ROLE_PASSWORD };
    run(path.join(root, "app/node_modules/.bin/prisma"),
      ["migrate", "deploy", "--schema", "app/prisma/schema.prisma"],
      { cwd: root, env: credentials });
    // Normal trusted-main role provisioning grants the existing app role
    // scoped CRUD on the new table without granting anon/authenticated access.
    run("bash", ["app/scripts/provision-app-role.sh"], { cwd: root, env: credentials });
  }, capture);
  console.log(JSON.stringify({ projectRef, expenseName, expenseHash, ...after }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
