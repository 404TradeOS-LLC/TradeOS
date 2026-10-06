import {
  INDOT_2025_REGIONAL_BASIS,
  INDOT_2025_UNIT_PRICE_BENCHMARKS,
  INDOT_2025_UNIT_PRICE_INDEX_URL,
  INDOT_2025_UNIT_PRICE_SOURCE_URL,
  getIndot2025UnitPriceBenchmark,
  searchIndot2025UnitPrices,
} from "../modules/costbook/indotUnitPrice2025";

describe("INDOT 2025 unit-price benchmarks", () => {
  it("carries the full CY2025 pay-item dataset", () => {
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS.length).toBeGreaterThan(2000);
    // Spot-check source-verified values from the official workbook
    expect(getIndot2025UnitPriceBenchmark("201-01015")).toMatchObject({
      description: "CLEARING AND GRUBBING",
      unit: "LS",
      lowPrice: 5000,
      averagePrice: 33043.33,
      highPrice: 120000,
      totalQuantity: 10,
    });
    expect(getIndot2025UnitPriceBenchmark("203-02000")).toMatchObject({
      description: "EXCAVATION, COMMON",
      unit: "CYS",
      averagePrice: 27.29,
      totalQuantity: 1304735,
    });
  });

  it("preserves source and regional provenance", () => {
    expect(INDOT_2025_UNIT_PRICE_SOURCE_URL).toBe(
      "https://www.in.gov/indot/doing-business-with-indot/files/CY2025-Unit-Price-Summary.xlsx"
    );
    expect(INDOT_2025_UNIT_PRICE_INDEX_URL).toBe(
      "https://www.in.gov/indot/doing-business-with-indot/home/contracts/standards/indot-pay-items-listunit-price-summaries/"
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

  it("supports keyword search over descriptions", () => {
    const hits = searchIndot2025UnitPrices("excavation");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.description.toLowerCase().includes("excavation"))).toBe(true);
  });

  it("keeps installed unit-price evidence separate from raw Costbook material pricing", () => {
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS[0]).not.toHaveProperty("materialCostTypical");
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS[0]).not.toHaveProperty("laborRateAssumption");
    expect(INDOT_2025_UNIT_PRICE_BENCHMARKS[0]).not.toHaveProperty("equipmentCost");
  });
});
