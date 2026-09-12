import fs from "fs";
import path from "path";
import {
  buildCompositeBenchmarkSourceIdentifier,
  compositePriceBenchmarkInputSchema,
} from "../modules/costbook/compositePriceBenchmarkService";

describe("Costbook composite price benchmark ingestion", () => {
  const validRow = {
    sourceName: "Indiana Department of Transportation (INDOT)",
    sourceYear: 2025,
    sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/files/CY2025-Unit-Price-Summary.xlsx",
    sourceFile: "CY2025-Unit-Price-Summary.xlsx",
    sourceRow: 42,
    section: "301",
    itemCode: "301-12234",
    description: "COMPACTED AGGREGATE, NO. 53",
    unitOfMeasure: "CYS",
    lowPrice: 50,
    weightedAvgPrice: 100,
    highPrice: 600,
    sourceQuantity: 8000,
    geography: "Indiana statewide awarded contracts",
    priceBasis: "Installed/composite awarded-bid pay-item price; not raw material-only price",
    catalogStatus: "current",
    reviewStatus: "reference" as const,
  };

  it("accepts a documented installed-price benchmark without material/labor fields", () => {
    const parsed = compositePriceBenchmarkInputSchema.parse(validRow);
    expect(parsed.itemCode).toBe("301-12234");
    expect(parsed).not.toHaveProperty("materialCostTypical");
    expect(parsed).not.toHaveProperty("laborRateAssumption");
    expect(parsed).not.toHaveProperty("billRate");
  });

  it("rejects weighted averages outside the stated low/high range", () => {
    expect(() => compositePriceBenchmarkInputSchema.parse({ ...validRow, weightedAvgPrice: 700 })).toThrow();
    expect(() => compositePriceBenchmarkInputSchema.parse({ ...validRow, weightedAvgPrice: 40 })).toThrow();
  });

  it("builds a deterministic source/year/item idempotency identifier", () => {
    expect(buildCompositeBenchmarkSourceIdentifier(validRow)).toBe(
      "INDIANA-DEPARTMENT-OF-TRANSPORTATION-INDOT-2025-301-12234"
    );
  });

  it("does not accept caller-supplied org scope", () => {
    expect(() => compositePriceBenchmarkInputSchema.parse({ ...validRow, orgId: "00000000-0000-0000-0000-000000000000" })).toThrow();
  });

  it("locks the database/RLS boundary and deterministic uniqueness", () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, "../prisma/migrations/20260912223000_add_costbook_composite_price_benchmarks/migration.sql"),
      "utf8"
    );

    expect(migration).toContain("force row level security");
    expect(migration).toContain("current_app_org_id()");
    expect(migration).toContain("current_app_can_manage_costbook()");
    expect(migration).toContain("unique (org_id, source_name, source_year, item_code)");
    expect(migration).not.toContain("material_cost_typical");
    expect(migration).not.toContain("labor_rate_assumption");
    expect(migration).not.toContain("bill_rate");
  });
});
