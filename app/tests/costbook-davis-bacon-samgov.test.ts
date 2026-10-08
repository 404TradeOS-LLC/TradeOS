import * as fs from 'fs';
import * as path from 'path';
import {
  DavisBaconApiError,
  determinationDownloadUrl,
  fetchDeterminationText,
  getCountyRates,
  parseDeterminationText,
  searchDeterminations,
} from '../modules/costbook/davisBaconSamGov';

const fixturePath = path.join(__dirname, 'fixtures', 'davis-bacon', 'IN20260050.txt');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');

describe('Davis-Bacon SAM.gov determination text parser', () => {
  const parsed = parseDeterminationText(fixtureText, 1);

  it('parses the header block from the real IN20260050 document', () => {
    expect(parsed.determination.wdNumber).toBe('IN20260050');
    expect(parsed.determination.revisionNumber).toBe(1);
    expect(parsed.determination.stateName).toBe('Indiana');
    expect(parsed.determination.constructionTypes).toEqual(['Residential']);
    expect(parsed.determination.counties).toEqual([
      'Clay',
      'Sullivan',
      'Vermillion',
      'Vigo',
    ]);
  });

  it('extracts every rate row across all union/survey blocks', () => {
    // 7 blocks: ELEC0153-006 (1), ENGI0150-034 (4), ENGI0150-052 (2),
    // LABO0081-006 (1), PLUM0136-013 (1), SUIN2023-010 (4), UAVGIN0010 (1)
    expect(parsed.rates).toHaveLength(14);
  });

  it('parses base rate and fringe separately', () => {
    const electrician = parsed.rates.find((rate) => rate.occupation === 'ELECTRICIAN');
    expect(electrician).toMatchObject({
      wdNumber: 'IN20260050',
      revisionNumber: 1,
      rateIdentifier: 'ELEC0153-006',
      identifierDate: '06/08/2023',
      baseRate: 27.0,
      fringe: 18.29,
    });
  });

  it('joins occupation names wrapped across lines', () => {
    const loader = parsed.rates.find((rate) =>
      rate.occupation.includes('BOBCAT/SKID STEER/SKID LOADER'),
    );
    expect(loader).toMatchObject({
      occupation: 'POWER EQUIPMENT OPERATOR: BOBCAT/SKID STEER/SKID LOADER',
      baseRate: 49.05,
      fringe: 43.4,
    });
  });

  it('handles survey-rate blocks without union identifiers', () => {
    const roofer = parsed.rates.find((rate) => rate.occupation === 'ROOFER');
    expect(roofer).toMatchObject({
      rateIdentifier: 'SUIN2023-010',
      baseRate: 27.22,
      fringe: 14.47,
    });
    const sheetMetal = parsed.rates.find((rate) => rate.occupation === 'SHEET METAL WORKER');
    expect(sheetMetal).toMatchObject({
      rateIdentifier: 'UAVGIN0010',
      baseRate: 41.86,
      fringe: 28.82,
    });
  });
});

describe('Davis-Bacon SAM.gov published-rate variants', () => {
  const sample = [
    '"General Decision Number: CA20260022 01/01/2026',
    'State: California',
    'Construction Types: Building, Heavy, Highway and Residential',
    '',
    '* ELEC0011-007 01/01/2024',
    'Rates Fringes',
    'ELECTRICIAN................$ 17.68 **  3%+29.77',
    'HELPER.....................$ 20.00  38.435+a+b',
    'DIVER (PER DAY)............$ 418.96  22.00',
  ].join('\n');

  const parsed = parseDeterminationText(sample, 1);

  it('preserves all construction types from compound conjunction headings', () => {
    expect(parsed.determination.constructionTypes).toEqual([
      'Building', 'Heavy', 'Highway', 'Residential',
    ]);
  });

  it('accepts a starred identifier and base-rate footnote without dropping classes', () => {
    expect(parsed.rates).toHaveLength(3);
    expect(parsed.rates.every((rate) => rate.rateIdentifier === 'ELEC0011-007')).toBe(true);
    expect(parsed.rates[0]).toMatchObject({ baseRate: 17.68, rateUnit: 'hour' });
  });

  it('retains formula fringe text for manual interpretation, rather than treating it as numeric', () => {
    expect(parsed.rates[0]).toMatchObject({ fringe: null, fringeExpression: '3%+29.77' });
    expect(parsed.rates[1]).toMatchObject({ fringe: null, fringeExpression: '38.435+a+b' });
  });

  it('marks published daily base rates with the correct unit', () => {
    expect(parsed.rates[2]).toMatchObject({
      occupation: 'DIVER (PER DAY)',
      baseRate: 418.96,
      rateUnit: 'day',
      fringe: 22,
    });
  });
});

describe('Davis-Bacon SAM.gov search client', () => {
  const searchBody = {
    _embedded: {
      results: [
        {
          fullReferenceNumber: 'IN20260050',
          revisionNumber: 1,
          isActive: true,
          modifiedDate: '2026-05-18T00:00:00-04:00',
          constructionTypes: ['Residential'],
          location: {
            state: { code: 'IN', name: 'Indiana' },
            counties: [{ code: 15077, value: 'Vigo' }],
          },
        },
        {
          fullReferenceNumber: 'IN20250050',
          revisionNumber: 0,
          isActive: false,
          constructionTypes: ['Residential'],
          location: { state: { code: 'IN', name: 'Indiana' }, counties: [] },
        },
      ],
    },
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(searchBody),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('queries the dbra index with the mandatory hal+json accept header', async () => {
    await searchDeterminations({ state: 'IN', county: 'Vigo' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('index=dbra'),
      expect.objectContaining({
        headers: { Accept: 'application/hal+json' },
      }),
    );
  });

  it('returns only active determinations with parsed metadata', async () => {
    const determinations = await searchDeterminations({ county: 'Vigo' });
    expect(determinations).toHaveLength(1);
    expect(determinations[0]).toMatchObject({
      wdNumber: 'IN20260050',
      revisionNumber: 1,
      state: 'IN',
      stateName: 'Indiana',
      counties: ['Vigo'],
      constructionTypes: ['Residential'],
      isActive: true,
    });
  });

  it('follows every SAM.gov search page instead of silently truncating results', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const page = new URL(url).searchParams.get('page');
      const result = page === '1'
        ? {
          fullReferenceNumber: 'IN20260003',
          revisionNumber: 2,
          isActive: true,
          constructionTypes: ['Building'],
          location: { state: { code: 'IN', name: 'Indiana' }, counties: [] },
        }
        : searchBody._embedded.results[0];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          _embedded: { results: [result] },
          page: { totalPages: 2 },
        }),
      });
    });

    const determinations = await searchDeterminations({ state: 'IN', county: 'Vigo' });

    expect(determinations.map((determination) => determination.wdNumber)).toEqual([
      'IN20260050',
      'IN20260003',
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('page=0'),
      expect.anything(),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('page=1'),
      expect.anything(),
    );
  });

  it('throws a typed error on non-2xx search responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(searchDeterminations()).rejects.toBeInstanceOf(DavisBaconApiError);
  });
});

describe('Davis-Bacon SAM.gov document download', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the key-free wdol download URL from WD number and revision', () => {
    expect(determinationDownloadUrl('IN20260050', 1)).toBe(
      'https://sam.gov/api/prod/wdol/v1/wd/IN20260050/1/download?api_key=null',
    );
  });

  it('returns the document text on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(fixtureText),
    } as Response);
    const text = await fetchDeterminationText('IN20260050', 1);
    expect(text).toContain('General Decision Number: IN20260050');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://sam.gov/api/prod/wdol/v1/wd/IN20260050/1/download?api_key=null',
      expect.anything(),
    );
  });

  it('throws a typed error on failed downloads', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(fetchDeterminationText('IN20260050', 9)).rejects.toBeInstanceOf(
      DavisBaconApiError,
    );
  });
});

describe('Davis-Bacon county rate service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('discovers, downloads, and parses every determination for a county', async () => {
    const searchBody = {
      _embedded: {
        results: [
          {
            fullReferenceNumber: 'IN20260050',
            revisionNumber: 1,
            isActive: true,
            modifiedDate: '2026-05-18T00:00:00-04:00',
            constructionTypes: ['Residential'],
            location: {
              state: { code: 'IN', name: 'Indiana' },
              counties: [{ code: 15077, value: 'Vigo' }],
            },
          },
        ],
      },
    };
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/search/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(searchBody) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(fixtureText) });
    });

    const documents = await getCountyRates('IN', 'Vigo');
    expect(documents).toHaveLength(1);
    expect(documents[0].determination.wdNumber).toBe('IN20260050');
    expect(documents[0].rates).toHaveLength(14);
    const electrician = documents[0].rates.find((rate) => rate.occupation === 'ELECTRICIAN');
    expect(electrician?.baseRate).toBe(27.0);
    expect(electrician?.fringe).toBe(18.29);
  });
});
