import { ASSEMBLY_MATERIAL_COSTS, PRICED_ASSEMBLY_COMPONENTS, assemblyMaterialCost } from '../modules/costbook/pricedAssemblies';
import { TRADEOS_ASSEMBLIES } from '../modules/costbook/tradeosAssemblies';
import { SUPPLIER_PRICES_47802 } from '../modules/costbook/supplierPrices47802';

const pass2 = () => PRICED_ASSEMBLY_COMPONENTS.slice(135);
const row = (key: string) => pass2().find(p => p.componentKey === key)!;
const pass2MaterialCost = (id: string) =>
  TRADEOS_ASSEMBLIES.find(a => a.id === id)?.components.reduce(
    (sum, component) =>
      sum + (pass2().find(p => p.componentKey === component.key)?.extendedCost ?? 0),
    0,
  ) ?? 0;

describe('Pass-2 historical price evidence', () => {
  it('preserves canonical recipe quantities instead of silently scaling them', () => {
    for (const p of pass2()) {
      const slots = TRADEOS_ASSEMBLIES.flatMap(a => a.components.filter(c => c.key === p.componentKey));
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.some(c => c.quantityPerUnit === p.quantityPerUnit)).toBe(true);
    }
    expect(row('mat_plates_2x4_spf').quantityPerUnit).toBe(0.413);
    expect(row('mat_sill_flashing_flexible').quantityPerUnit).toBe(1);
  });

  it('converts source price to the quantity basis using actual package dimensions', () => {
    const deck = row('mat_underlayment_synthetic_roll');
    expect(deck.priceUnit).toBe('ROLL');
    expect(deck.unitPrice).toBe(13.5 * 10); // ten squares per roll
    expect(deck.extendedCost).toBeCloseTo(0.11 * 13.5 * 10, 4);
    const wrap = row('mat_housewrap_roll_tyvek');
    expect(wrap.priceUnit).toBe('ROLL');
    expect(wrap.unitPrice).toBe(0.13 * 9 * 100); // 9 ft x 100 ft
    expect(wrap.extendedCost).toBeCloseTo(0.12 * 0.13 * 900, 4);
    const sill = row('mat_sill_flashing_flexible');
    expect(sill.priceUnit).toBe('EA'); // one derived ten-LF sill allocation, not a purchased roll
    expect(sill.unitPrice).toBeCloseTo(1.31 * 10, 4);
  });

  it('rejects incompatible fasteners, unproven chemistry/standards and attachment methods', () => {
    for (const key of [
      'fast_nails_16d_framing', 'fast_nails_10d_16d_ijoist',
      'fast_plastic_cap_nails_1in', 'fast_cap_staples_stinger',
      'mat_adhesive_foam_panel_poly', 'mat_underlayment_felt_15lb',
      'mat_sealant_polyurethane_exterior', 'mat_sbs_base_sheet_selfadhered',
    ]) expect(pass2().some(p => p.componentKey === key)).toBe(false);
  });

  it('does not count metal-roof Master Flash as an approved shingle-roof pipe boot', () => {
    expect(pass2().some(p => p.componentKey === 'mat_pipe_boot_elastomeric_unit')).toBe(false);
    expect(pass2().some(p => /Master Flash/i.test(p.productName))).toBe(false);
    expect(assemblyMaterialCost('roofing-flashing-pipe-boot')?.materialCostPerUnit).toBe(0.06);
  });

  it('uses the specified XPS thickness, R-value and tongue-and-groove edge', () => {
    const source = SUPPLIER_PRICES_47802.find(p => p.productKey === 'ABC-INSU-OC-F250-TG-2IN')!;
    const xps = row('mat_xps_board_2in_4x8');
    expect(xps.productName).toBe(source.productName);
    expect(xps.unitPrice).toBe(source.price);
    expect(xps.priceUnit).toBe('SF');
    expect(xps.extendedCost).toBeCloseTo(1.08 * source.price, 4);
  });

  it('retains the correct stud length and independently calculated rollups', () => {
    expect(row('mat_studs_2x4_spf').productName).toContain('92-5/8');
    const expected: Record<string, [number, number]> = {
      'framing-wall-int-2x4-16oc': [2, 0.65],
      'roofing-underlayment-synthetic': [1, 14.85],
      'siding-fibercement-lap-hardie': [1, 228.48],
      'moisture-barrier-wrb-housewrap': [2, 16.70],
      'door-exterior-prehung-fiberglass': [2, 498.10],
      'insul-batt-fiberglass-r13-2x4': [1, 0.83],
      'paint-trim-interior-enamel-2coat': [2, 0.13],
      'flooring-hardwood-solid-oak-3-4': [0, 0],
      'framing-floor-ijoist-19-2oc': [0, 0],
      'roofing-sbs-roll-selfadhered-cap': [2, 146.13],
      'roofing-membrane-epdm-60mil': [1, 9.79],
      'roofing-flashing-pipe-boot': [1, 0.06],
      'roofing-gutters-seamless-aluminum-5in': [2, 1.38],
      'insul-rigidfoam-xps-2in-foundation': [1, 1.57],
    };
    for (const [id, [count, cost]] of Object.entries(expected)) {
      expect(assemblyMaterialCost(id)?.pricedComponents).toBe(count);
      expect(assemblyMaterialCost(id)?.materialCostPerUnit).toBe(cost);
      expect(assemblyMaterialCost(id)?.materialCostPerUnit).toBe(
        Number(pass2MaterialCost(id).toFixed(2)),
      );
    }
    expect(pass2()).toHaveLength(18);
    expect(ASSEMBLY_MATERIAL_COSTS.filter(a => a.pricedComponents > 0)).toHaveLength(75);
  });
});
