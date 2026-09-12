import {
  INDOT_2025_REGIONAL_BASIS,
  INDOT_2025_UNIT_PRICE_BENCHMARKS,
  INDOT_2025_UNIT_PRICE_SOURCE_URL,
  getIndot2025UnitPriceBenchmark,
} from "../modules/costbook/indotUnitPrice2025";

describe("INDOT 2025 unit-price benchmarks", () => {
  it("locks the source-verified statewide regression sample", () => {
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS).toEqual([
      { payItemNumber: "201-01015", description: "CLEARING AND GRUBBING", unit: "LS", lowPrice: 5000, averagePrice: 33043.33, highPrice: 120000, totalQuantity: 10 },
      { payItemNumber: "203-02000", description: "EXCAVATION, COMMON", unit: "CYS", lowPrice: 1, averagePrice: 27.29, highPrice: 505, totalQuantity: 1304735 },
      { payItemNumber: "211-09194", description: "B BORROW", unit: "TON", lowPrice: 125, averagePrice: 125, highPrice: 125, totalQuantity: 10 },
      { payItemNumber: "301-12231", description: "COMPACTED AGGREGATE, NO. 2", unit: "CYS", lowPrice: 47, averagePrice: 86.71, highPrice: 1200, totalQuantity: 5909 },
      { payItemNumber: "301-12232", description: "COMPACTED AGGREGATE, NO. 5", unit: "CYS", lowPrice: 45, averagePrice: 91.9, highPrice: 490, totalQuantity: 7362 },
      { payItemNumber: "301-12234", description: "COMPACTED AGGREGATE, NO. 53", unit: "CYS", lowPrice: 50, averagePrice: 100, highPrice: 600, totalQuantity: 8000 },
    ]);
  });

  it("preserves source and regional provenance", () => {
    expect(INDOT_2025_UNIT_PRICE_SOURCE_URL).toBe(
      "https://www.in.gov/indot/doing-business-with-indot/files/CY2025-Unit-Price-Summary.xlsx"
    );
    expect(INDOT_2025_REGIONAL_BASIS).toBe("Indiana statewide awarded INDOT contracts");
  });

  it("preserves workbook quantity semantics instead of calling quantity an observation count", () => {
    expect(getIndot2025UnitPriceBenchmark("203-02000")?.totalQuantity).toBe(1304735);
  });

  it("supports deterministic pay-item lookup", () => {
    expect(getIndot2025UnitPriceBenchmark("203-02000")?.averagePrice).toBe(27.29);
    expect(getIndot2025UnitPriceBenchmark("missing")).toBeUndefined();
  });

  it("keeps installed unit-price evidence separate from raw Costbook material pricing", () => {
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS[0]).not.toHaveProperty("materialCostTypical");
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS[0]).not.toHaveProperty("laborRateAssumption");
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS[0]).not.toHaveProperty("equipmentCost");
  });
});
