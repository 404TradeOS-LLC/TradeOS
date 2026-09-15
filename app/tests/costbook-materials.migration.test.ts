import fs from "node:fs";
import path from "node:path";

describe("costbook materials catalog migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql"),
    "utf8"
  );

  it("keeps material writes aligned to the Costbook owner/admin boundary", () => {
    expect(migration).toContain("drop policy if exists materials_write_policy on materials");
    expect(migration).toContain("create policy materials_write_policy on materials");
    expect(migration).toContain("org_id = (select public.current_app_org_id())");
    expect(migration).toContain("public.current_app_can_manage_costbook()");
    expect(migration).not.toContain("current_app_can_write()");
  });

  it("keeps material price-audit inserts aligned with material writes", () => {
    expect(migration).toContain("drop policy if exists material_price_audits_insert_policy on material_price_audits");
    expect(migration).toContain("create policy material_price_audits_insert_policy on material_price_audits");
    expect(migration).toContain("public.current_app_can_manage_costbook()");
  });
});

describe("costbook materials active-state migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260912120000_add_material_active_state/migration.sql"),
    "utf8"
  );

  it("adds a non-null is_active column defaulting to true, matching the hierarchy/CostItem/LaborRate soft-delete pattern", () => {
    expect(migration).toContain("alter table materials");
    expect(migration).toContain("add column if not exists is_active boolean not null default true");
  });

  it("indexes materials by organization and active state", () => {
    expect(migration).toContain("create index if not exists idx_materials_org_active on materials(org_id, is_active)");
  });

  it("does not touch materials_write_policy, since it already gates every material write behind costbook.manage", () => {
    expect(migration).not.toContain("create policy");
    expect(migration).not.toContain("drop policy");
  });
});
