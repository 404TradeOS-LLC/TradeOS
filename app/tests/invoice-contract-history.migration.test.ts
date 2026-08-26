import fs from "node:fs";
import path from "node:path";

describe("invoice and contract history migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260714162000_add_invoice_and_contract_history/migration.sql"),
    "utf8"
  );

  it("creates the invoice_deliveries and contract_events tables with RLS", () => {
    expect(migration).toContain("create table invoice_deliveries");
    expect(migration).toContain("alter table invoice_deliveries enable row level security");
    expect(migration).toContain("alter table invoice_deliveries force row level security");
    expect(migration).toContain("create table contract_events");
    expect(migration).toContain("alter table contract_events enable row level security");
    expect(migration).toContain("alter table contract_events force row level security");
  });

  it("scopes invoice and contract history rows by organization for select and write", () => {
    expect(migration).toContain("create policy invoice_deliveries_select_policy on invoice_deliveries");
    expect(migration).toContain("create policy invoice_deliveries_write_policy on invoice_deliveries");
    expect(migration).toContain("create policy contract_events_select_policy on contract_events");
    expect(migration).toContain("create policy contract_events_write_policy on contract_events");
    expect(migration).toContain("org_id = (select current_app_org_id())");
    expect(migration).toContain("(select current_app_can_write())");
  });
});
