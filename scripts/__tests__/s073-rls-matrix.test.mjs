import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMatrix } from "../validate-s073-rls-matrix.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const matrix = JSON.parse(fs.readFileSync(path.join(root, "docs/testing/S073_RLS_COVERAGE_MATRIX.json"), "utf8"));

test("S073 matrix matches current Prisma, forced-RLS migrations, source owners, and live test names", () => {
  assert.deepEqual(validateMatrix({ rootDir: root, matrix }), []);
});

test("S073 matrix rejects an unowned gap and an absent forced-RLS source", () => {
  const changed = structuredClone(matrix);
  changed.resources[0].status = "GAP";
  changed.resources[0].blockingOwner = "";
  changed.resources[0].migration = "does-not-exist/migration.sql";
  const errors = validateMatrix({ rootDir: root, matrix: changed });
  assert.ok(errors.some((error) => error.includes("GAP requires blockingOwner and blockingTest")));
  assert.ok(errors.some((error) => error.includes("migration directory is missing")));
});

test("S073 matrix rejects missing required inventory rows and missing scope evidence", () => {
  const missingResource = structuredClone(matrix);
  missingResource.resources = missingResource.resources.filter((resource) => resource.table !== "jobs");
  assert.ok(validateMatrix({ rootDir: root, matrix: missingResource }).some((error) => error.includes("required S051/S052-S060 resource jobs is missing")));

  const missingScopeTest = structuredClone(matrix);
  missingScopeTest.resources[0].scopeTest = "not a real integration test";
  assert.ok(validateMatrix({ rootDir: root, matrix: missingScopeTest }).some((error) => error.includes("missing named live PostgreSQL scopeTest evidence")));
});

test("dynamic tenant policy evidence must be inside the loop that contains the table", () => {
  const changed = structuredClone(matrix);
  const costItem = changed.resources.find((resource) => resource.table === "cost_items");
  costItem.migration = "20260623180000_enable_org_rls/migration.sql";
  const migration = fs.readFileSync(path.join(root, "app/prisma/migrations", costItem.migration), "utf8");
  const decoy = migration.replace(/loop\s+execute format\('alter table %I enable row level security', tenant_table\);/i, "loop null;")
    .replace(/loop\s+execute format\('alter table %I force row level security', tenant_table\);/i, "loop null;");
  const tempRoot = fs.mkdtempSync(path.join(root, ".s073-validator-"));
  try {
    fs.cpSync(path.join(root, "app"), path.join(tempRoot, "app"), { recursive: true });
    fs.cpSync(path.join(root, "docs"), path.join(tempRoot, "docs"), { recursive: true });
    fs.cpSync(path.join(root, "scripts"), path.join(tempRoot, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "app/prisma/migrations", costItem.migration), decoy);
    assert.ok(validateMatrix({ rootDir: tempRoot, matrix: changed }).some((error) => error.includes("cost_items: migration lacks explicit or enumerated ENABLE")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
