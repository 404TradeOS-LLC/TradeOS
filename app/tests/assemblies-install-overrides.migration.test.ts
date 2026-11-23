import fs from "node:fs";
import path from "node:path";

describe("assembly install overrides migration (DEV-17 S10, issue #518)", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20261123050000_add_assembly_install_overrides/migration.sql"),
    "utf8"
  );

  it("adds two nullable override columns to the tenant assemblies table, with no backfill", () => {
    expect(migration).toContain("alter table assemblies");
    expect(migration).toContain("add column if not exists waste_override_pct numeric(5, 2)");
    expect(migration).toContain("add column if not exists production_rate_factor numeric(6, 4)");
    // NULL means "recipe defaults" — no invented value may be backfilled.
    expect(migration).not.toMatch(/update\s+assemblies\s+set/i);
    expect(migration).not.toContain("not null");
  });

  it("bounds both overrides at the database layer, mirroring the API validation", () => {
    expect(migration).toContain("assemblies_waste_override_pct_check");
    expect(migration).toContain("waste_override_pct >= 0 and waste_override_pct <= 100");
    expect(migration).toContain("assemblies_production_rate_factor_check");
    expect(migration).toContain("production_rate_factor > 0 and production_rate_factor <= 10");
  });

  it("does not change row-level security: the columns ride the existing assembly row", () => {
    expect(migration).not.toMatch(/create policy|enable row level security|force row level security/i);
  });
});
