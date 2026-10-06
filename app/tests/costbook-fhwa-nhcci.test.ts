import {
  NHCCI_OBSERVATIONS,
  latestNhcci,
  nhcciAt,
  nhcciPercentChange,
  nhcciYearOverYear,
} from '../modules/costbook/fhwaNhcci';

describe('FHWA NHCCI', () => {
  it('carries 93 quarterly observations from 2003 Q1 to 2026 Q1', () => {
    expect(NHCCI_OBSERVATIONS).toHaveLength(93);
    expect(NHCCI_OBSERVATIONS[0]).toMatchObject({ year: 2003, quarter: 1 });
    const last = NHCCI_OBSERVATIONS[NHCCI_OBSERVATIONS.length - 1];
    expect(last).toMatchObject({ year: 2026, quarter: 1 });
  });

  it('observations are chronological with positive index values', () => {
    for (let i = 1; i < NHCCI_OBSERVATIONS.length; i++) {
      const prev = NHCCI_OBSERVATIONS[i - 1];
      const cur = NHCCI_OBSERVATIONS[i];
      const prevKey = prev.year * 4 + prev.quarter;
      const curKey = cur.year * 4 + cur.quarter;
      expect(curKey).toBeGreaterThan(prevKey);
      expect(cur.index).toBeGreaterThan(0);
      expect(cur.indexSeasonallyAdjusted).toBeGreaterThan(0);
    }
  });

  it('finds the latest quarter', () => {
    expect(latestNhcci()).toMatchObject({ year: 2026, quarter: 1 });
  });

  it('looks up an exact quarter', () => {
    expect(nhcciAt(2020, 1)?.index).toBeCloseTo(1.968679539, 6);
    expect(nhcciAt(1999, 1)).toBeUndefined();
  });

  it('computes year-over-year change from real data', () => {
    // Q1 2025 -> Q1 2026: pulled live 2026-10-06
    const yoy = nhcciYearOverYear();
    expect(yoy).toBeDefined();
    expect(yoy!).toBeCloseTo(-0.9, 0);
  });

  it('rejects bad inputs for percent change', () => {
    expect(nhcciPercentChange(100, 110)).toBeCloseTo(10, 6);
    expect(() => nhcciPercentChange(0, 110)).toThrow();
  });
});
