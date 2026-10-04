import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Costbook data foundation tenant contract", () => {
  it("keeps supplier products and observations behind forced organization RLS", () => {
    const sql = readFileSync(
      join(__dirname, "../prisma/migrations/20260919090000_add_regional_supplier_costbook_evidence/migration.sql"),
      "utf8"
    );

    expect(sql).toMatch(/alter table supplier_products enable row level security/i);
    expect(sql).toMatch(/alter table supplier_products force row level security/i);
    expect(sql).toMatch(/alter table supplier_price_observations enable row level security/i);
    expect(sql).toMatch(/alter table supplier_price_observations force row level security/i);
    expect(sql).toMatch(/org_id\s*=\s*\(select public\.current_app_org_id\(\)\)/i);
  });

  it("keeps the canonical-price read explicitly organization-scoped in addition to RLS", () => {
    const source = readFileSync(join(__dirname, "../modules/costbook/pricing.ts"), "utf8");

    expect(source).toContain("async resolveCanonicalPrice(orgId: string");
    expect(source).toContain("orgId,");
    expect(source).toContain('priceStatus: "priced"');
    expect(source).toContain("supplierProduct: { canonicalMaterialKey: input.canonicalMaterialKey }");
    expect(source).not.toContain("tenantId: null,");
  });
});
