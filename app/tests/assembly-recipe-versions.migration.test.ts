import fs from "node:fs";
import path from "node:path";

describe("installed assembly recipe versions migration (issue #518)", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20261125150000_version_installed_assembly_recipes/migration.sql"),
    "utf8"
  );

  it("versions a legacy install with the catalog marker at version 1 and records installedAt", () => {
    expect(migration).toContain("installed_recipe_version = 1, installed_at = assembly.created_at");
    expect(migration).toContain("Catalog 2026.09.1; recipe v1; CSI");
  });

  it("leaves rows without markers unlinked and unverified slots unkeyed for estimator review", () => {
    // Only the frozen v1 codes with the legacy marker are backfilled.
    expect(migration).toContain("assembly.code = recipe.code");
    // Keys are recovered only when the complete set of positions and
    // quantities matches v1; edited or incomplete layouts stay unkeyed.
    expect(migration).toContain("Keep edited or incomplete legacy layouts unkeyed for estimator review");
    expect(migration).toContain("verified_layouts");
    expect(migration).toContain("count(DISTINCT matched.position) = cardinality(recipe.slot_keys)");
    expect(migration).toContain("item.sort_order = expected.position");
    expect(migration).toContain("item.quantity_per_unit = round(expected.quantity, 4)");
    expect(migration).toContain("item.cost_item_id IS NOT NULL");
  });

  it("guards the installed-recipe columns and the upgrade history with check constraints and a unique index", () => {
    expect(migration).toContain("assemblies_installed_recipe_check");
    expect(migration).toContain("installed_recipe_version > 0");
    expect(migration).toContain("from_version > 0");
    expect(migration).toContain("to_version > from_version");
    expect(migration).toContain("UNIQUE (assembly_id, to_version)");
  });

  it("forces row-level security on the upgrade history table", () => {
    expect(migration).toContain("CREATE TABLE public.assembly_recipe_upgrades");
    expect(migration).toContain("ALTER TABLE public.assembly_recipe_upgrades FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("assembly_recipe_upgrades_insert");
    expect(migration).toContain("parent.installed_recipe_version = to_version");
  });
});
