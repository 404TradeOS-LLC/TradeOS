export type BlsPpiCategory =
  | 'wood'
  | 'plastics-rubber'
  | 'nonmetallic-mineral'
  | 'primary-metal'
  | 'electrical-machinery'
  | 'utilities';

export interface BlsPpiSeriesDefinition {
  category: BlsPpiCategory;
  seriesId: string;
  label: string;
  sourceUrl: string;
  costbookTags: string[];
}

export interface BlsPpiObservation {
  seriesId: string;
  year: number;
  month: number;
  value: number;
  sourceUrl: string;
  category: BlsPpiCategory;
}

const ROOT = 'https://download.bls.gov/pub/time.series/pc';

export const BLS_PPI_COSTBOOK_SERIES: readonly BlsPpiSeriesDefinition[] = [
  {
    category: 'wood',
    seriesId: 'PCU321---321---',
    label: 'Wood product manufacturing',
    sourceUrl: `${ROOT}/pc.data.10.Wood`,
    costbookTags: ['lumber', 'wood', 'framing', 'millwork'],
  },
  {
    category: 'plastics-rubber',
    seriesId: 'PCU326---326---',
    label: 'Plastics and rubber products manufacturing',
    sourceUrl: `${ROOT}/pc.data.15.PlasticsRubberProducts`,
    costbookTags: ['pvc', 'plastic', 'rubber', 'pipe', 'insulation'],
  },
  {
    category: 'nonmetallic-mineral',
    seriesId: 'PCU327---327---',
    label: 'Nonmetallic mineral product manufacturing',
    sourceUrl: `${ROOT}/pc.data.16.NonmetallicMineral`,
    costbookTags: ['concrete', 'cement', 'brick', 'block', 'gypsum', 'glass'],
  },
  {
    category: 'primary-metal',
    seriesId: 'PCU331---331---',
    label: 'Primary metal manufacturing',
    sourceUrl: `${ROOT}/pc.data.17.PrimaryMetal`,
    costbookTags: ['steel', 'aluminum', 'copper', 'metal'],
  },
  {
    category: 'electrical-machinery',
    seriesId: 'PCU335---335---',
    label: 'Electrical equipment, appliance, and component manufacturing',
    sourceUrl: `${ROOT}/pc.data.21.ElectricalMachinery`,
    costbookTags: ['electrical', 'panel', 'transformer', 'wire-equipment', 'hvac-equipment'],
  },
  {
    category: 'utilities',
    seriesId: 'PCU221---221---',
    label: 'Utilities',
    sourceUrl: `${ROOT}/pc.data.46.Utilities`,
    costbookTags: ['electricity', 'gas', 'energy', 'operating-cost'],
  },
] as const;

export function parseBlsPpiTsv(
  tsv: string,
  definition: BlsPpiSeriesDefinition,
): BlsPpiObservation[] {
  const rows = tsv.trim().split(/\r?\n/);
  if (rows.length === 0) return [];

  const observations: BlsPpiObservation[] = [];
  for (const row of rows.slice(1)) {
    if (!row.trim()) continue;
    const [seriesRaw, yearRaw, periodRaw, valueRaw] = row.split('\t').map((value) => value.trim());
    if (seriesRaw !== definition.seriesId) continue;
    if (!/^M(0[1-9]|1[0-2])$/.test(periodRaw)) continue; // M13 is annual average, not a month.

    const year = Number(yearRaw);
    const month = Number(periodRaw.slice(1));
    const value = Number(valueRaw);
    if (!Number.isInteger(year) || !Number.isFinite(value)) continue;

    observations.push({
      seriesId: definition.seriesId,
      year,
      month,
      value,
      sourceUrl: definition.sourceUrl,
      category: definition.category,
    });
  }

  return observations.sort((a, b) => a.year - b.year || a.month - b.month);
}

export function percentChange(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) {
    throw new Error('BLS PPI change requires finite, non-zero baseline values');
  }
  return ((to / from) - 1) * 100;
}

export function escalationFactor(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) {
    throw new Error('BLS PPI escalation requires finite, non-zero baseline values');
  }
  return to / from;
}
