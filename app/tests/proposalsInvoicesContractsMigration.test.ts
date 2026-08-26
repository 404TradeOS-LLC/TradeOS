import fs from "node:fs";
import path from "node:path";

describe("proposals/invoices/contracts migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql"),
    "utf8"
  );

  it("forces RLS on every new table", () => {
    for (const table of ["proposals", "invoices", "invoice_line_items", "contracts"]) {
      expect(migration).toContain(`alter table ${table} force row level security`);
    }
  });

  it("scopes select/write policies through the projects join, matching the change_orders pattern", () => {
    expect(migration).toContain("exists (select 1 from projects where projects.id = proposals.project_id)");
    expect(migration).toContain("exists (select 1 from projects where projects.id = invoices.project_id)");
    expect(migration).toContain("exists (select 1 from projects where projects.id = contracts.project_id)");
    expect(migration).toContain("current_app_can_write()");
  });
});
