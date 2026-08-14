import fs from "node:fs";
import path from "node:path";

describe("costbook equipment catalog migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260811150000_restrict_costbook_equipment_writes/migration.sql"),
    "utf8"
  );

  it("keeps equipment writes aligned to the Costbook owner/admin boundary", () => {
    expect(migration).toContain("drop policy if exists equipment_write_policy on equipment");
    expect(migration).toContain("create policy equipment_write_policy on equipment");
    expect(migration).toContain("org_id = (select public.current_app_org_id())");
    expect(migration).toContain("public.current_app_can_manage_costbook()");
    expect(migration).not.toContain("current_app_can_write()");
  });
});
