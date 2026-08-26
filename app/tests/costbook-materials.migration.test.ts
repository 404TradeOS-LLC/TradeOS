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
