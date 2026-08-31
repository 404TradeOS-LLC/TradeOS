import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260831214500_add_costbook_code_trgm_indexes",
  "migration.sql"
);

const migrationSql = readFileSync(migrationPath, "utf8");

describe("Costbook code substring-search indexes", () => {
  it("adds a GIN trigram index for CostItem.code", () => {
    expect(migrationSql).toMatch(
      /create index if not exists idx_cost_items_code_trgm\s+on cost_items using gin \(code gin_trgm_ops\);/i
    );
  });

  it("adds a GIN trigram index for Assembly.code", () => {
    expect(migrationSql).toMatch(
      /create index if not exists idx_assemblies_code_trgm\s+on assemblies using gin \(code gin_trgm_ops\);/i
    );
  });
});
