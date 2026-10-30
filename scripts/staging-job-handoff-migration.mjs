import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const migrationName = "20261028151000_accepted_proposal_job_handoff";
export const migrationHash = "3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293";
export const projectRef = "qfbgdkbamfaasmtjfyru";
const migrationPath = `app/prisma/migrations/${migrationName}/migration.sql`;
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function verifySourceSql(sql) {
  if (hash(sql) !== migrationHash) throw Error("Source migration checksum is not the reviewed SQL");
  return sql;
}

export function validateRequest({ sourceSha, approvedSha, mode, confirmation, ref }) {
  if (ref !== "refs/heads/main") throw Error("Run trusted workflow from main only");
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? "")) throw Error("Full source SHA required");
  if (!["preflight", "apply"].includes(mode)) throw Error("Unknown migration mode");
  if (mode === "apply" && (approvedSha !== sourceSha || confirmation !== "APPLY_STAGING_JOB_HANDOFF")) {
    throw Error("Apply requires exact protected approved SHA and typed confirmation");
  }
}

export function stagingConnection(value) {
  let url;
  try { url = new URL(value); } catch { throw Error("Invalid staging connection"); }
  let user;
  try { user = decodeURIComponent(url.username); } catch { throw Error("Invalid staging username"); }
  const direct = url.hostname === `db.${projectRef}.supabase.co` && ["", "5432"].includes(url.port);
  const pooler = url.hostname === "aws-0-us-east-2.pooler.supabase.com" &&
    ["5432", "6543"].includes(url.port) &&
    /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-z0-9]{20}$/.test(user) && user.endsWith(`.${projectRef}`);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== "/postgres" ||
      url.hash || !url.password || !user || !(direct || pooler)) throw Error("Staging identity refused");
  // Reject libpq/Prisma routing overrides, options and unknown parameters.
  for (const [key, val] of url.searchParams) {
    if (!((key === "schema" && val === "public") || (key === "sslmode" && val === "require"))) {
      throw Error("Unapproved connection parameter");
    }
    if (url.searchParams.getAll(key).length !== 1) throw Error("Duplicate connection parameter");
  }
  url.port = "5432"; // Prisma uses session pooling, never transaction pooling.
  url.searchParams.set("sslmode", "require");
  return url;
}

export function validateEvidence(inventory, evidence, { requireApplied = false } = {}) {
  if (!Array.isArray(evidence.ledger) || !Array.isArray(evidence.columns) || !Array.isArray(evidence.indexes)) {
    throw Error("Incomplete schema/ledger evidence");
  }
  if (evidence.rls !== true || evidence.forced !== true) throw Error("Jobs RLS must remain enabled and forced");
  const applied = new Map();
  for (const row of evidence.ledger) {
    if (row.rolled_back) continue;
    if (!row.finished) throw Error("Unfinished migration");
    if (applied.has(row.name)) throw Error("Duplicate successful migration");
    if (!Object.hasOwn(inventory, row.name) || inventory[row.name] !== row.checksum) {
      throw Error("Unexpected migration or checksum drift");
    }
    applied.set(row.name, row.checksum);
  }
  const missing = Object.keys(inventory).filter(name => !applied.has(name));
  if (missing.some(name => name !== migrationName)) throw Error("Unrelated pending migration");
  const targetApplied = applied.has(migrationName);
  if (requireApplied && !targetApplied) throw Error("Job migration is not applied");
  if (!targetApplied) {
    if (evidence.columns.length || evidence.indexes.length) throw Error("Partial or untracked Job schema");
  } else {
    const cols = evidence.columns;
    if (cols.length !== 2 || !cols.some(c => c.name === "source_proposal_id" && c.type === "text") ||
        !cols.some(c => c.name === "accepted_baseline_json" && c.type === "jsonb") ||
        cols.some(c => c.nullable !== true || c.default !== null)) throw Error("Job column drift");
    const [index] = evidence.indexes;
    if (evidence.indexes.length !== 1 || index.unique !== true || index.valid !== true || index.ready !== true ||
        index.keys !== "source_proposal_id" || index.predicate !== null || index.expressions !== null ||
        index.keyCount !== 1 || index.totalCount !== 1) throw Error("Job unique index drift");
  }
  return { targetApplied, completed: applied.size, missing };
}

export function performMigration(mode, inventory, evidence, deploy, captureAfter) {
  if (!["preflight", "apply"].includes(mode)) throw Error("Unknown migration mode");
  const before = validateEvidence(inventory, evidence);
  if (mode === "preflight" || before.targetApplied) return before;
  deploy();
  return validateEvidence(inventory, captureAfter(), { requireApplied: true });
}

export const evidenceSql = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
 'ledger', (SELECT coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum,
   'finished',finished_at IS NOT NULL,'rolled_back',rolled_back_at IS NOT NULL)), '[]'::json) FROM public._prisma_migrations),
 'columns', (SELECT coalesce(json_agg(json_build_object('name',column_name,'type',data_type,
   'nullable',is_nullable='YES','default',column_default)), '[]'::json) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='jobs' AND column_name IN ('source_proposal_id','accepted_baseline_json')),
 'indexes', (SELECT coalesce(json_agg(json_build_object('unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,
   'keys',pg_get_indexdef(i.indexrelid,1,true),'predicate',pg_get_expr(i.indpred,i.indrelid),
   'expressions',pg_get_expr(i.indexprs,i.indrelid),'keyCount',i.indnkeyatts,'totalCount',i.indnatts)), '[]'::json)
   FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
   WHERE i.indrelid='public.jobs'::regclass AND c.relname='jobs_source_proposal_id_key'),
 'rls', (SELECT relrowsecurity FROM pg_class WHERE oid='public.jobs'::regclass),
 'forced', (SELECT relforcerowsecurity FROM pg_class WHERE oid='public.jobs'::regclass)
);
COMMIT;`;

function run(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024, ...options });
  // Do not echo child output: errors may contain credential-bearing URLs.
  if (result.error || result.status !== 0) throw Error(`Migration tool failed: ${path.basename(program)}; inspect protected runtime safely`);
  return result.stdout;
}

export function main(env = process.env) {
  validateRequest({ sourceSha: env.SOURCE_SHA, approvedSha: env.APPROVED_SOURCE_SHA,
    mode: env.MIGRATION_MODE, confirmation: env.CONFIRMATION, ref: env.GITHUB_REF });
  const url = stagingConnection(env.STAGING_DATABASE_ADMIN_URL);
  const root = fileURLToPath(new URL("../", import.meta.url));
  const trustedEnv = { PATH: env.PATH, HOME: env.HOME, CI: "true" };
  const sourceSql = run("git", ["show", `${env.SOURCE_SHA}:${migrationPath}`], { cwd: root, env: trustedEnv });
  verifySourceSql(sourceSql);
  const migrationRoot = path.join(root, "app/prisma/migrations");
  const inventory = {};
  for (const entry of readdirSync(migrationRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) inventory[entry.name] = hash(readFileSync(path.join(migrationRoot, entry.name, "migration.sql")));
  }
  if (inventory[migrationName] && inventory[migrationName] !== migrationHash) throw Error("Trusted migration differs from reviewed SQL");
  inventory[migrationName] = migrationHash;
  const pgEnv = { ...trustedEnv, PGHOST: url.hostname, PGPORT: url.port, PGDATABASE: "postgres",
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: "require", PGCONNECT_TIMEOUT: "15" };
  const capture = () => JSON.parse(run("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { env: pgEnv, input: evidenceSql }));
  const evidence = capture();
  const before = validateEvidence(inventory, evidence);
  console.log(JSON.stringify({ mode: env.MIGRATION_MODE, sourceSha: env.SOURCE_SHA,
    projectRef, migrationName, migrationHash, ...before }));
  const after = performMigration(env.MIGRATION_MODE, inventory, evidence, () => {
    // Only reviewed SQL bytes are materialized. No feature package/script/schema
    // is checked out or executed under the protected database credential.
    const targetDir = path.join(migrationRoot, migrationName);
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(path.join(targetDir, "migration.sql"), sourceSql);
    run(path.join(root, "app/node_modules/.bin/prisma"), ["migrate", "deploy", "--schema", "app/prisma/schema.prisma"],
      { cwd: root, env: { ...trustedEnv, DATABASE_URL: url.toString(), DATABASE_ADMIN_URL: url.toString() } });
  }, capture);
  console.log(JSON.stringify({ projectRef, migrationName, migrationHash, ...after }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
