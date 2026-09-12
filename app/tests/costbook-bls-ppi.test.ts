import { describe, expect, it } from 'vitest';
import {
  BLS_PPI_COSTBOOK_SERIES,
  escalationFactor,
  parseBlsPpiTsv,
  percentChange,
} from '../modules/costbook/blsPpi';

describe('BLS PPI Costbook ingestion', () => {
  it('maps the vetted construction-relevant aggregate series', () => {
    expect(BLS_PPI_COSTBOOK_SERIES.map((series) => series.seriesId)).toEqual([
      'PCU321---321---',
      'PCU326---326---',
      'PCU327---327---',
      'PCU331---331---',
      'PCU335---335---',
      'PCU221---221---',
    ]);
  });

  it('parses monthly rows and deliberately excludes M13 annual averages', () => {
    const definition = BLS_PPI_COSTBOOK_SERIES[0];
    const tsv = [
      'series_id\tyear\tperiod\tvalue\tfootnote_codes',
      `${definition.seriesId}\t2025\tM01\t183.149\t`,
      `${definition.seriesId}\t2025\tM02\t183.808\t`,
      `${definition.seriesId}\t2025\tM13\t182.000\t`,
      'PCU999---999---\t2025\tM01\t999.0\t',
    ].join('\n');

    expect(parseBlsPpiTsv(tsv, definition)).toEqual([
      {
        seriesId: definition.seriesId,
        year: 2025,
        month: 1,
        value: 183.149,
        sourceUrl: definition.sourceUrl,
        category: 'wood',
      },
      {
        seriesId: definition.seriesId,
        year: 2025,
        month: 2,
        value: 183.808,
        sourceUrl: definition.sourceUrl,
        category: 'wood',
      },
    ]);
  });

  it('calculates index change and escalation without interpreting PPI as dollars', () => {
    expect(percentChange(100, 125)).toBeCloseTo(25);
    expect(escalationFactor(100, 125)).toBeCloseTo(1.25);
  });

  it('rejects zero baselines', () => {
    expect(() => percentChange(0, 100)).toThrow();
    expect(() => escalationFactor(0, 100)).toThrow();
  });
});
