import {
  deriveSuppliers,
  resolveTargetOrgId,
} from '../scripts/import-suppliers-from-dataset';
import {
  SUPPLIER_PRICES_47802,
  type SupplierPriceObservation,
} from '../modules/costbook/supplierPrices47802';

describe('deriveSuppliers', () => {
  it('derives one supplier per distinct supplierCode from the live dataset', () => {
    const suppliers = deriveSuppliers(SUPPLIER_PRICES_47802);
    const codes = suppliers.map((s) => s.supplierCode);
    expect(codes).toEqual([
      'ABC_SUPPLY',
      'HOME_DEPOT',
      'JONES_AND_SONS',
      'LOWES',
      'MENARDS',
      'NIEHAUS',
    ]);
    // every dataset row's code is represented exactly once
    const datasetCodes = new Set(SUPPLIER_PRICES_47802.map((p) => p.supplierCode));
    expect(new Set(codes)).toEqual(datasetCodes);
  });

  it('maps ABC_SUPPLY to the ABC Supply identity used by the sandbox feed', () => {
    const abc = deriveSuppliers(SUPPLIER_PRICES_47802).find((s) => s.supplierCode === 'ABC_SUPPLY');
    expect(abc).toBeDefined();
    expect(abc?.name).toBe('ABC Supply');
    expect(abc?.website).toBe('https://www.abcsupply.com');
  });

  it('deduplicates repeated codes and falls back to a prettified name for unknown codes', () => {
    const rows = [
      { supplier: 'ABCSupply', supplierCode: 'ABC_SUPPLY' },
      { supplier: 'ABCSupply', supplierCode: 'ABC_SUPPLY' },
      { supplier: 'NewCo', supplierCode: 'NEW_CO' },
    ] as SupplierPriceObservation[];
    const suppliers = deriveSuppliers(rows);
    expect(suppliers).toHaveLength(2);
    expect(suppliers.find((s) => s.supplierCode === 'NEW_CO')?.name).toBe('New Co');
    expect(suppliers.find((s) => s.supplierCode === 'NEW_CO')?.website).toBeNull();
  });

  it('returns an empty list for an empty dataset', () => {
    expect(deriveSuppliers([])).toEqual([]);
  });
});

describe('resolveTargetOrgId', () => {
  const orgs = [
    { id: 'org-1', name: 'Primary' },
    { id: 'org-2', name: 'Secondary' },
  ];

  it('uses the single organization automatically', () => {
    expect(resolveTargetOrgId([orgs[0]], null)).toBe('org-1');
  });

  it('requires --org-id when several organizations exist', () => {
    expect(() => resolveTargetOrgId(orgs, null)).toThrow(/--org-id/);
  });

  it('honors an explicit --org-id that exists', () => {
    expect(resolveTargetOrgId(orgs, 'org-2')).toBe('org-2');
  });

  it('rejects an --org-id that matches nothing', () => {
    expect(() => resolveTargetOrgId(orgs, 'org-9')).toThrow(/matches no organization/);
  });

  it('rejects an empty organization list', () => {
    expect(() => resolveTargetOrgId([], null)).toThrow(/no organizations found/);
  });
});
