import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_TABLES = [
  "customers", "service_addresses", "projects", "estimates", "estimate_line_items",
  "athena_generation_runs", "athena_generation_reviews", "proposals", "proposal_deliveries",
  "contracts", "contract_events", "jobs", "job_assignments", "job_expenses", "job_expense_events",
  "project_tasks", "activity_events", "invoices", "invoice_line_items", "payments",
  "customer_portal_access_tokens", "customer_portal_sessions", "cost_items", "assemblies",
  "assembly_items", "materials", "labor_rates", "equipment", "invoice_deliveries",
];

export function validateMatrix({ rootDir = root, matrix = JSON.parse(fs.readFileSync(path.join(rootDir, "docs/testing/S073_RLS_COVERAGE_MATRIX.json"), "utf8")) } = {}) {
  const errors = [];
  const schema = read(rootDir, "app/prisma/schema.prisma", errors);
  const schemaTables = new Map([...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map((match) => [
    (match[2].match(/@@map\("([^"]+)"\)/) || [])[1] || match[1], match[1],
  ]));
  const migrationsDir = path.join(rootDir, "app/prisma/migrations");
  const migrationNames = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir) : [];
  const integrationDir = path.join(rootDir, "app/tests");
  const integration = listIntegrationTests(integrationDir).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  if (!integration) errors.push("no live PostgreSQL integration tests were found");
  const declaredTables = new Set();

  if (matrix.schemaVersion !== 1 || matrix.sprint !== "S073") errors.push("matrix must declare schemaVersion 1 and sprint S073");
  for (const resource of matrix.resources ?? []) {
    const label = `${resource.model ?? "<missing model>"}/${resource.table ?? "<missing table>"}`;
    if (declaredTables.has(resource.table)) errors.push(`${label}: duplicate table row`);
    declaredTables.add(resource.table);
    if (schemaTables.get(resource.table) !== resource.model) errors.push(`${label}: table/model does not match current Prisma schema`);
    if (!resource.journeys?.length || !resource.routeServiceOwner || !resource.tenantSource || !resource.role) errors.push(`${label}: missing journey, route/service owner, tenant source, or persistence role`);
    if (!resource.migration || !resource.policy) errors.push(`${label}: missing migration or policy evidence`);
    const migrationPath = `app/prisma/migrations/${resource.migration}`;
    if (!migrationNames.includes(resource.migration?.split("/")[0])) errors.push(`${label}: migration directory is missing`);
    const migration = read(rootDir, migrationPath, errors);
    const directEnable = new RegExp(`alter\\s+table\\s+(?:public\\.)?"?${escapeRegex(resource.table)}"?\\s+enable\\s+row\\s+level\\s+security`, "i").test(migration);
    const directForce = new RegExp(`alter\\s+table\\s+(?:public\\.)?"?${escapeRegex(resource.table)}"?\\s+force\\s+row\\s+level\\s+security`, "i").test(migration);
    const dynamicFamily = hasDynamicTenantPolicy(migration, resource.table);
    if (!directEnable && !dynamicFamily) errors.push(`${label}: migration lacks explicit or enumerated ENABLE ROW LEVEL SECURITY evidence`);
    if (!directForce && !dynamicFamily) errors.push(`${label}: migration lacks explicit or enumerated FORCE ROW LEVEL SECURITY evidence`);
    if (!migration.toLowerCase().includes(resource.table.toLowerCase()) || (!/create\s+policy/i.test(migration) && !dynamicFamily)) errors.push(`${label}: mapped migration lacks policy/table evidence`);
    const namedPolicies = resource.policy.match(/[a-z][a-z0-9_]*_policy/g) ?? [];
    for (const policyName of namedPolicies) {
      if (!new RegExp(`create\\s+policy\\s+(?:if\\s+not\\s+exists\\s+)?${escapeRegex(policyName)}\\s+on\\s+(?:public\\.)?"?${escapeRegex(resource.table)}"?\\b`, "i").test(migration)) errors.push(`${label}: named policy ${policyName} is absent from mapped migration or is not on ${resource.table}`);
    }
    if (!fs.existsSync(path.join(rootDir, resource.routeServiceOwner))) errors.push(`${label}: route/service owner source is missing (${resource.routeServiceOwner})`);
    for (const key of ["sameOrg", "crossOrg", "scopeTest"]) {
      const testName = resource[key];
      if (!testName || !integration.includes(`"${testName}"`)) errors.push(`${label}: missing named live PostgreSQL ${key} evidence`);
    }
    if (resource.status === "GAP" && (!resource.blockingOwner || !resource.blockingTest)) errors.push(`${label}: GAP requires blockingOwner and blockingTest`);
    if (resource.status === "GAP" && resource.blockingTest && !integration.includes(`"${resource.blockingTest}"`)) errors.push(`${label}: GAP blockingTest must name a live integration test`);
    if (!["COVERED", "GAP"].includes(resource.status)) errors.push(`${label}: persisted resource status must be COVERED or GAP`);
  }
  for (const table of REQUIRED_TABLES) {
    if (!declaredTables.has(table)) errors.push(`required S051/S052-S060 resource ${table} is missing from the matrix`);
  }
  for (const exclusion of matrix.exclusions ?? []) {
    if (exclusion.status !== "NOT_PERSISTED" || !exclusion.resource || !exclusion.reason) errors.push("each exclusion must explain a NOT_PERSISTED resource");
  }
  if (!matrix.resources?.length) errors.push("matrix has no persisted resources");
  return errors;
}

function read(rootDir, relative, errors) {
  const target = path.join(rootDir, relative);
  if (!fs.existsSync(target)) {
    errors.push(`required evidence file is missing: ${relative}`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function hasDynamicTenantPolicy(sql, table) {
  const loops = [...sql.matchAll(/foreach\s+tenant_table\s+in\s+array\s+array\s*\[([\s\S]*?)\]\s*loop([\s\S]*?)end\s+loop/gi)];
  return loops.some((loop) => loop[1].toLowerCase().includes(`'${table.toLowerCase()}'`)
    && /execute\s+format\('alter table %i enable row level security',\s*tenant_table\)/i.test(loop[2])
    && /execute\s+format\('alter table %i force row level security',\s*tenant_table\)/i.test(loop[2])
    && /create policy %i on %i for select/i.test(loop[2])
    && /create policy %i on %i for all/i.test(loop[2]));
}

function listIntegrationTests(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listIntegrationTests(target);
    return entry.isFile() && entry.name.endsWith(".integration.ts") ? [target] : [];
  });
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateMatrix();
  if (errors.length) {
    console.error(`S073 RLS matrix validation failed:\n- ${errors.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log("S073 RLS coverage matrix is internally consistent with the current schema, migrations, test names, and source files.");
  }
}
