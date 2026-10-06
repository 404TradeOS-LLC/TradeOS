import {
  BLS_PPI_COMMODITY_OBSERVATIONS,
  BLS_PPI_COMMODITY_SERIES,
  escalateByPpi,
  latestPpiObservation,
  ppiObservationAt,
  ppiPercentChange,
  ppiSeriesForMaterialFamily,
  ppiYearOverYear,
} from '../modules/costbook/blsPpiCommodities';

describe('BLS PPI commodity series (WPU)', () => {
  it('defines the ten verified construction commodity series', () => {
    expect(BLS_PPI_COMMODITY_SERIES.map((s) => s.seriesId)).toEqual([
      'WPU0811',
      'WPU13220161',
      'WPU1333',
      'WPU062101',
      'WPU101704',
      'WPU102502',
      'WPU07210603',
      'WPU105402',
      'WPU1148',
      'WPU117',
    ]);
  });

  it('maps material families to their index series', () => {
    expect(ppiSeriesForMaterialFamily('LUMBER')?.seriesId).toBe('WPU0811');
    expect(ppiSeriesForMaterialFamily('concrete')?.seriesId).toBe('WPU13220161');
    expect(ppiSeriesForMaterialFamily('READY_MIX_CONCRETE')?.seriesId).toBe('WPU1333');
    expect(ppiSeriesForMaterialFamily('ELECTRICAL')?.seriesId).toBe('WPU117');
    expect(ppiSeriesForMaterialFamily('UNOBTAINIUM')).toBeUndefined();
  });

  it('carries monthly observations for every series', () => {
    for (const s of BLS_PPI_COMMODITY_SERIES) {
      const obs = BLS_PPI_COMMODITY_OBSERVATIONS.filter((o) => o.seriesId === s.seriesId);
      expect(obs.length).toBeGreaterThan(60); // 2021-2026 monthly
      for (const o of obs) {
        expect(o.month).toBeGreaterThanOrEqual(1);
        expect(o.month).toBeLessThanOrEqual(12);
        expect(o.value).toBeGreaterThan(0);
      }
    }
  });

  it('finds the latest observation per series', () => {
    const latest = latestPpiObservation('WPU1333');
    expect(latest).toBeDefined();
    expect(latest!.year).toBe(2026);
    expect(latest!.month).toBe(8);
    expect(latest!.value).toBeCloseTo(395.186, 3);
  });

  it('computes year-over-year change from real data', () => {
    // Lumber Aug 2025 -> Aug 2026: pulled live 2026-10-06
    const yoy = ppiYearOverYear('WPU0811');
    expect(yoy).toBeDefined();
    expect(yoy!).toBeCloseTo(11.8, 0);
  });

  it('escalates an observed price by index movement', () => {
    // $100 observed when index was 100, index now 112 -> $112 estimate
    expect(escalateByPpi(100, 100, 112)).toBeCloseTo(112, 6);
    expect(() => escalateByPpi(100, 0, 112)).toThrow();
  });

  it('rejects bad inputs for percent change', () => {
    expect(ppiPercentChange(100, 110)).toBeCloseTo(10, 6);
    expect(() => ppiPercentChange(0, 110)).toThrow();
    expect(ppiObservationAt('WPU0811', 1999, 1)).toBeUndefined();
  });
});
