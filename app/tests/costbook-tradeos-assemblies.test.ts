import {
  TRADEOS_ASSEMBLIES,
  getTradeosAssembly,
  searchTradeosAssemblies,
  tradeosAssembliesByTrade,
} from '../modules/costbook/tradeosAssemblies';
import {
  TRADEOS_ASSEMBLY_SOURCES,
  getTradeosAssemblySource,
} from '../modules/costbook/tradeosAssemblySources';

describe('TradeOS assembly library', () => {
  it('carries 88 assemblies across three batches', () => {
    expect(TRADEOS_ASSEMBLIES).toHaveLength(88);
    const batches = new Set(TRADEOS_ASSEMBLIES.map((a) => a.batch));
    expect(batches).toEqual(new Set(['pass1', 'pass2', 'batch2']));
  });

  it('has unique IDs and valid components throughout', () => {
    const ids = TRADEOS_ASSEMBLIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of TRADEOS_ASSEMBLIES) {
      expect(a.components.length).toBeGreaterThan(0);
      for (const c of a.components) {
        expect(c.quantityPerUnit).toBeGreaterThan(0);
        expect(c.key).toBeTruthy();
      }
      expect(a.productionHoursPerUnit).toBeGreaterThan(0);
    }
  });

  it('supports lookup by ID', () => {
    const a = getTradeosAssembly('framing-roof-truss-erection-24oc');
    expect(a?.name).toMatch(/truss/i);
    expect(a?.unitOfMeasure).toBe('SF');
    expect(getTradeosAssembly('nope')).toBeUndefined();
  });

  it('supports keyword search', () => {
    const hits = searchTradeosAssemblies('drywall');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) =>
      h.name.toLowerCase().includes('drywall') ||
      h.description.toLowerCase().includes('drywall') ||
      h.searchTerms.some((t) => t.toLowerCase().includes('drywall'))
    )).toBe(true);
  });

  it('filters by trade', () => {
    const roofing = tradeosAssembliesByTrade('Roofing');
    expect(roofing.length).toBeGreaterThan(0);
    expect(roofing.every((a) => a.trade === 'Roofing')).toBe(true);
  });

  it('carries 58 sources with resolvable references', () => {
    expect(TRADEOS_ASSEMBLY_SOURCES).toHaveLength(58);
    expect(getTradeosAssemblySource('SRC-0001')?.sourceName).toMatch(/OSHA/i);
    expect(getTradeosAssemblySource('SRC-9999')).toBeUndefined();
  });

  it('embeds no hardcoded selling prices', () => {
    const text = JSON.stringify(TRADEOS_ASSEMBLIES);
    // Dollar amounts like $12.99 would indicate embedded pricing
    expect(text).not.toMatch(/\$\d+\.\d{2}/);
  });
});
