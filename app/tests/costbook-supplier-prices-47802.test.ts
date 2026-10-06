import {
  SUPPLIER_PRICES_47802,
  SUPPLIER_PRICES_47802_REGION,
  SUPPLIER_PRICES_47802_SOURCE,
  cheapestSupplierPrice,
  searchSupplierPrices,
  supplierPricesBySupplier,
} from '../modules/costbook/supplierPrices47802';

describe('Supplier prices 47802', () => {
  it('carries verified price observations', () => {
    expect(SUPPLIER_PRICES_47802.length).toBeGreaterThan(3000);
    for (const p of SUPPLIER_PRICES_47802) {
      expect(p.price).toBeGreaterThan(0);
      expect(p.supplier).toBeTruthy();
      expect(p.unit).toBeTruthy();
      expect(p.observedAt).toBeTruthy();
    }
  });

  it('preserves source and region provenance', () => {
    expect(SUPPLIER_PRICES_47802_REGION).toBe('Terre Haute, IN 47802');
    expect(SUPPLIER_PRICES_47802_SOURCE).toMatch(/2026-09-13/);
  });

  it('filters by supplier', () => {
    const menards = supplierPricesBySupplier('Menards');
    expect(menards.length).toBeGreaterThan(0);
    expect(menards.every((p) => p.supplier === 'Menards')).toBe(true);
    expect(supplierPricesBySupplier('nonexistent')).toHaveLength(0);
  });

  it('searches by keyword', () => {
    const hits = searchSupplierPrices('lumber');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('finds the cheapest price per canonical material', () => {
    const sample = SUPPLIER_PRICES_47802.find((p) => p.canonicalKey);
    expect(sample).toBeDefined();
    const cheapest = cheapestSupplierPrice(sample!.canonicalKey);
    expect(cheapest).toBeDefined();
    const all = SUPPLIER_PRICES_47802.filter((p) => p.canonicalKey === sample!.canonicalKey);
    expect(cheapest!.price).toBe(Math.min(...all.map((p) => p.price)));
    expect(cheapestSupplierPrice('NOPE')).toBeUndefined();
  });
});
