import fs from "node:fs";
import path from "node:path";

describe("proposal delivery tracking migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260714143000_add_proposal_delivery_tracking/migration.sql"),
    "utf8"
  );

  it("creates the proposal_deliveries table with RLS", () => {
    expect(migration).toContain("create table proposal_deliveries");
    expect(migration).toContain("alter table proposal_deliveries enable row level security");
    expect(migration).toContain("alter table proposal_deliveries force row level security");
  });

  it("scopes delivery rows by organization for select and write", () => {
    expect(migration).toContain("create policy proposal_deliveries_select_policy on proposal_deliveries");
    expect(migration).toContain("org_id = (select current_app_org_id())");
    expect(migration).toContain("create policy proposal_deliveries_write_policy on proposal_deliveries");
    expect(migration).toContain("(select current_app_can_write())");
  });
});
