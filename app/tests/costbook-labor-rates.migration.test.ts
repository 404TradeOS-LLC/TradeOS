import fs from "node:fs";
import path from "node:path";

describe("costbook labor-rates foundation migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260811140000_add_costbook_labor_rates_foundation/migration.sql"),
    "utf8"
  );

  it("adds the foundational labor-rate columns and enforces organization scope", () => {
    expect(migration).toContain("add column if not exists role text");
    expect(migration).toContain("add column if not exists hourly_cost numeric(10,2)");
    expect(migration).toContain("add column if not exists bill_rate numeric(10,2)");
    expect(migration).toContain("add column if not exists active boolean not null default true");
    expect(migration).toContain("delete from labor_rates\n where org_id is null");
    expect(migration).toContain("alter column org_id set not null");
  });

  it("aligns labor-rate writes with the Costbook manage boundary", () => {
    expect(migration).toContain("drop policy if exists labor_rates_write_policy on labor_rates");
    expect(migration).toContain("create policy labor_rates_write_policy on labor_rates");
    expect(migration).toContain("public.current_app_can_manage_costbook()");
    expect(migration).not.toContain("current_app_can_write()");
  });
});
