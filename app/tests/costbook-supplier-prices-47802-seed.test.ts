import {
  buildSupplierPrices47802SeedBatches,
  normalizeSourceUnit,
  SUPPLIER_PRICES_47802_ELIGIBILITY_REASON,
  SUPPLIER_PRICES_47802_EXPECTED_ROWS,
  SUPPLIER_PRICES_47802_SOURCE_FILE,
} from "../modules/costbook/supplierPrices47802Seed";

describe("Costbook 47802 supplier evidence seed plan", () => {
  it("builds the complete verified corpus in bounded supplier batches", () => {
    const batches = buildSupplierPrices47802SeedBatches(50);
    const products = batches.flatMap((batch) => batch.products);
    const observations = batches.flatMap((batch) => batch.observations);

    expect(products).toHaveLength(SUPPLIER_PRICES_47802_EXPECTED_ROWS);
    expect(observations).toHaveLength(SUPPLIER_PRICES_47802_EXPECTED_ROWS);
    expect(Math.max(...batches.map((batch) => batch.products.length))).toBeLessThanOrEqual(50);

    const counts = new Map<string, number>();
    for (const batch of batches) {
      counts.set(
        batch.supplier.displayName,
        (counts.get(batch.supplier.displayName) ?? 0) + batch.products.length
      );
    }

    expect(Object.fromEntries(counts)).toEqual({
      "ABC Supply": 584,
      "Home Depot": 683,
      "Jones & Sons": 347,
      "Lowe's": 701,
      "Menards": 792,
      "Niehaus": 81,
    });
  });

  it("preserves source evidence without trusting workbook canonical keys", () => {
    const batches = buildSupplierPrices47802SeedBatches(50);
    const firstAbc = batches.find((batch) => batch.supplier.displayName === "ABC Supply");
    expect(firstAbc).toBeDefined();

    const product = firstAbc!.products[0];
    const observation = firstAbc!.observations[0];

    expect(product).toMatchObject({
      supplierProductKey: "ABC-100012",
      sku: "100012",
      name: "Owens Corning TruDefinition Duration Architectural Shingles - Driftwood",
      purchaseUnit: "SQ",
      availabilityStatus: "available",
      sourceFile: SUPPLIER_PRICES_47802_SOURCE_FILE,
    });
    expect(product).not.toHaveProperty("canonicalMaterialKey");

    expect(observation).toMatchObject({
      observationKey: "ABC_SUPPLY:ABC-100012:2026-09-14",
      supplierProductKey: "ABC-100012",
      marketCode: "47802",
      storeName: "ABC Supply",
      city: "Terre Haute",
      state: "IN",
      postalCode: "47802",
      sourceFile: SUPPLIER_PRICES_47802_SOURCE_FILE,
      sourceRow: 1,
      currency: "USD",
      priceStatus: "priced",
      regularPrice: 127.5,
      effectivePrice: 127.5,
      purchaseUnit: "SQ",
      normalizedUnitPrice: 127.5,
      normalizedUnit: "SQ",
      eligibilityReason: SUPPLIER_PRICES_47802_ELIGIBILITY_REASON,
      sourceConfidence: "high",
    });
    expect(observation.observedAt.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("uses deterministic unique observation keys and source rows", () => {
    const observations = buildSupplierPrices47802SeedBatches(100)
      .flatMap((batch) => batch.observations);
    const keys = observations.map((row) => row.observationKey);
    const sourceRows = observations.map((row) => row.sourceRow);

    expect(new Set(keys).size).toBe(SUPPLIER_PRICES_47802_EXPECTED_ROWS);
    expect(new Set(sourceRows).size).toBe(SUPPLIER_PRICES_47802_EXPECTED_ROWS);
    expect(Math.min(...sourceRows.map((row) => row ?? 0))).toBe(1);
    expect(Math.max(...sourceRows.map((row) => row ?? 0))).toBe(
      SUPPLIER_PRICES_47802_EXPECTED_ROWS
    );
  });

  it("normalizes only the dataset's price-unit prefix and invents no conversion", () => {
    expect(normalizeSourceUnit("$/SQ")).toBe("SQ");
    expect(normalizeSourceUnit("EA")).toBe("EA");
    expect(normalizeSourceUnit("LF")).toBe("LF");
  });

  it("rejects unsafe batch sizes before any database work exists", () => {
    expect(() => buildSupplierPrices47802SeedBatches(0)).toThrow();
    expect(() => buildSupplierPrices47802SeedBatches(251)).toThrow();
  });
});
