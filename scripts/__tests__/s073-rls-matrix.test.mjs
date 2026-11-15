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
