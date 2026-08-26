import fs from "node:fs";
import path from "node:path";

describe("costbook hierarchy foundation migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260812120000_add_costbook_hierarchy_foundation/migration.sql"),
    "utf8"
  );

  it("adds the is_active column to divisions, categories, and subcategories", () => {
    expect(migration).toContain("alter table divisions\n  add column if not exists is_active boolean not null default true");
    expect(migration).toContain("alter table categories\n  add column if not exists is_active boolean not null default true");
    expect(migration).toContain("alter table subcategories\n  add column if not exists is_active boolean not null default true");
  });

  it("aligns divisions writes with the Costbook manage boundary", () => {
    expect(migration).toContain("drop policy if exists divisions_write_policy on divisions");
    expect(migration).toContain("create policy divisions_write_policy on divisions");
  });

  it("aligns categories and subcategories writes with the Costbook manage boundary", () => {
    expect(migration).toContain("drop policy if exists categories_write_policy on categories");
    expect(migration).toContain("create policy categories_write_policy on categories");
    expect(migration).toContain("drop policy if exists subcategories_write_policy on subcategories");
    expect(migration).toContain("create policy subcategories_write_policy on subcategories");
  });

  it("uses the Costbook-specific manage boundary instead of the generic write boundary", () => {
    const writePolicySection = migration.slice(migration.indexOf("drop policy if exists divisions_write_policy"));
    expect(writePolicySection).toContain("public.current_app_can_manage_costbook()");
    expect(writePolicySection).not.toContain("current_app_can_write()");
  });
});
