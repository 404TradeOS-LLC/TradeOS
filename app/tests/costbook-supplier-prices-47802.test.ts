import {
  SUPPLIER_PRICES_47802,
  SUPPLIER_PRICES_47802_REGION,
  SUPPLIER_PRICES_47802_SOURCE,
  cheapestSupplierPrice,
  searchSupplierPrices,
  supplierPricesBySupplier,
  supplierPricesForCanonicalIdentity,
  tradeOsCanonicalKeyForSupplierPrice,
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

  it('crosswalks supplier-specific 92-5/8 stud keys before comparing prices', () => {
    const matches = supplierPricesForCanonicalIdentity('LUMBER.SPF.STUD.2X4.92_5_8IN');
    const suppliers = new Set(matches.map((p) => p.supplier));
    expect(suppliers.has('Lowes')).toBe(true);
    expect(suppliers.has('Menards')).toBe(true);
    expect(suppliers.has('HomeDepot')).toBe(true);
    expect(matches.some((p) => p.canonicalKey === 'LUMBER-SPF-2X4-92_5_8-STUD')).toBe(true);
    expect(matches.some((p) => p.canonicalKey === 'LUMBER-SPF-2X4-92-5_8IN-STUD')).toBe(true);
    expect(matches.some((p) => p.canonicalKey === 'LUMBER-SPF-STUD-2X4-92_58')).toBe(true);
    expect(matches.every((p) => !p.productName.includes('104-5/8'))).toBe(true);

    const cheapest = cheapestSupplierPrice('LUMBER-SPF-2X4-92_5_8-STUD');
    expect(cheapest).toBeDefined();
    expect(tradeOsCanonicalKeyForSupplierPrice(cheapest!))
      .toBe('LUMBER.SPF.STUD.2X4.92_5_8IN');
    expect(cheapest!.price).toBe(Math.min(...matches.map((p) => p.price)));
  });

  it('fails closed when governed supplier rows use incompatible comparison units', () => {
    const matches = supplierPricesForCanonicalIdentity('LUMBER.SPF.STUD.2X4.104_5_8IN');
    expect(new Set(matches.map((p) => p.unit)).size).toBeGreaterThan(1);
    expect(cheapestSupplierPrice('LUMBER.SPF.STUD.2X4.104_5_8IN')).toBeUndefined();
  });

  it('fails closed instead of blindly joining an unmapped source canonical key across suppliers', () => {
    const unresolved = SUPPLIER_PRICES_47802.filter(
      (p) => p.canonicalKey === 'LUMBER-SPF-2X4-8FT'
    );
    expect(new Set(unresolved.map((p) => p.supplier)).size).toBeGreaterThan(1);
    expect(cheapestSupplierPrice('LUMBER-SPF-2X4-8FT')).toBeUndefined();
    expect(cheapestSupplierPrice('NOPE')).toBeUndefined();
  });
});
