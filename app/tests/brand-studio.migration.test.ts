import fs from "node:fs";
import path from "node:path";

describe("brand studio migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260703173000_add_brand_studio/migration.sql"),
    "utf8"
  );

  it("creates the org-scoped brand studio tables", () => {
    expect(migration).toContain("create table if not exists brand_profiles");
    expect(migration).toContain("create table if not exists brand_assets");
    expect(migration).toContain("create table if not exists brand_document_settings");
    expect(migration).toContain("organization_id         uuid not null unique references organizations(id) on delete cascade");
  });

  it("enables forced RLS for each brand studio table", () => {
    for (const table of ["brand_profiles", "brand_assets", "brand_document_settings"]) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
      expect(migration).toContain(`alter table ${table} force row level security`);
    }

    expect(migration).toContain("current_app_can_administer()");
    expect(migration).toContain("organization_id = (select current_app_org_id())");
  });
});
