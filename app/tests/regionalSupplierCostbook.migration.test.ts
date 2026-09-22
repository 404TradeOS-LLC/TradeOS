import fs from "node:fs";
import path from "node:path";

describe("regional supplier costbook evidence migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260919090000_add_regional_supplier_costbook_evidence/migration.sql"),
    "utf8"
  );

  it("keeps supplier products and observations separate from current material prices", () => {
    expect(migration).toContain("create table supplier_products");
    expect(migration).toContain("create table supplier_price_observations");
    expect(migration).toContain("material_id              uuid");
    expect(migration).toContain("foreign key (org_id, material_id) references materials(org_id, id) on delete restrict");
    expect(migration).toContain("materials_org_id_id_unique unique (org_id, id)");
    expect(migration).toContain("effective_price");
    expect(migration).toContain("price_status");
  });

  it("preserves unavailable observations and source grain", () => {
    expect(migration).toContain("price_status in ('priced', 'unavailable', 'not-listed', 'needs-review')");
    expect(migration).toContain("observation_key          text not null");
    expect(migration).toContain("source_file              text");
    expect(migration).toContain("source_row               integer");
    expect(migration).toContain("unique (org_id, supplier_product_id, observation_key)");
  });

  it("forces tenant RLS and limits writes to Costbook managers", () => {
    for (const table of ["supplier_products", "supplier_price_observations"]) {
      expect(migration).toContain("alter table " + table + " enable row level security");
      expect(migration).toContain("alter table " + table + " force row level security");
      expect(migration).toContain("create policy " + table + "_select_policy");
      expect(migration).toContain("create policy " + table + "_write_policy");
    }

    expect(migration).toContain("public.current_app_org_id()");
    expect(migration).toContain("public.current_app_can_manage_costbook()");
  });
});
