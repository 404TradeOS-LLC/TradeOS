import {
  ASSEMBLY_MATERIAL_COSTS,
  PRICED_ASSEMBLY_COMPONENTS,
  assemblyMaterialCost,
} from '../modules/costbook/pricedAssemblies';

/**
 * Pass-2 rematch tests (2026-10-18).
 * 29 new name-matched components across 14 assemblies; 11 assemblies remain
 * unpriced (honest gaps). All pass-2 rows carry the same "name-matched,
 * estimator review required before bids" flagging as pass 1.
 */

// Documented sub-0.4 exception: mat_plates_2x4_spf scores 0.38 because the
// component label's parenthetical "(1 Sole Plate, 2 Top Plates)" dilutes the
// token-overlap heuristic. Core identifying tokens (2x4, SPF, lumber) all
// match the verified HomeDepot 2x4x8ft #2 SPF row; confirmed by hand.
const SUB_THRESHOLD_EXCEPTIONS = new Map<string, number>([
  ['mat_plates_2x4_spf', 0.38],
]);

describe('Priced assemblies pass-2 rematch', () => {
  it('contains 29 new pass-2 rows without altering the 135 pass-1 rows', () => {
    // Total grows by exactly 29; all rows (pass-1 and pass-2) must be valid.
    // Pass-2 rows are marked with "// pass2:" inline comments in pricedAssemblies.ts.
    expect(PRICED_ASSEMBLY_COMPONENTS.length).toBe(135 + 29);
    for (const p of PRICED_ASSEMBLY_COMPONENTS) {
      const floor = SUB_THRESHOLD_EXCEPTIONS.get(p.componentKey) ?? 0.4;
      expect(p.matchScore).toBeGreaterThanOrEqual(floor);
      expect(p.unitPrice).toBeGreaterThan(0);
      expect(p.extendedCost).toBeGreaterThanOrEqual(0);
    }
  });

  it('prices the 92-5/8 in stud from the 92-5/8 in row (not 104-5/8)', () => {
    const stud = PRICED_ASSEMBLY_COMPONENTS.find(
      (p) => p.componentKey === 'mat_studs_2x4_spf'
    );
    expect(stud).toBeDefined();
    expect(stud!.productName).toContain('92-5/8');
    expect(stud!.productName).not.toContain('104-5/8');
    // $0.50/LF x 7.71875 LF = $3.86/EA
    expect(stud!.unitPrice).toBeCloseTo(3.86, 2);
    expect(stud!.priceUnit).toBe('EA');
  });

  it('rolls up the 14 newly-priced assemblies', () => {
    const expected: Record<string, { priced: number; cost: number }> = {
      'framing-wall-int-2x4-16oc': { priced: 3, cost: 1.8 },
      'roofing-underlayment-synthetic': { priced: 2, cost: 1.81 },
      'siding-fibercement-lap-hardie': { priced: 2, cost: 231.45 },
      'moisture-barrier-wrb-housewrap': { priced: 3, cost: 4.62 },
      'insul-batt-fiberglass-r13-2x4': { priced: 1, cost: 0.83 },
      'door-exterior-prehung-fiberglass': { priced: 3, cost: 515.06 },
      'paint-trim-interior-enamel-2coat': { priced: 2, cost: 0.13 },
      'flooring-hardwood-solid-oak-3-4': { priced: 1, cost: 0.07 },
      'framing-floor-ijoist-19-2oc': { priced: 1, cost: 0.02 },
      'roofing-sbs-roll-selfadhered-cap': { priced: 3, cost: 177.18 },
      'roofing-flashing-pipe-boot': { priced: 2, cost: 16.56 },
      'roofing-gutters-seamless-aluminum-5in': { priced: 3, cost: 1.73 },
      'insul-rigidfoam-xps-2in-foundation': { priced: 2, cost: 1.67 },
      'roofing-membrane-epdm-60mil': { priced: 1, cost: 9.79 },
    };
    for (const [id, { priced, cost }] of Object.entries(expected)) {
      const rollup = assemblyMaterialCost(id);
      expect(rollup).toBeDefined();
      expect(rollup!.pricedComponents).toBe(priced);
      expect(rollup!.materialCostPerUnit).toBeCloseTo(cost, 2);
    }
    // 63 pass-1 + 14 pass-2 = 77 assemblies with costs
    const withCost = ASSEMBLY_MATERIAL_COSTS.filter((a) => a.pricedComponents > 0);
    expect(withCost.length).toBe(77);
  });

  it('leaves the 11 honest-gap assemblies at zero', () => {
    const gaps = [
      'demo-flooring-carpet-pad',
      'demo-roofing-shingle-tearoff',
      'demo-roofing-shingle-tearoff-2layers',
      'demo-siding-exterior-lap',
      'demo-deck-wood-framing-surface',
      'demo-concrete-slab-4in',
      'earthwork-trench-excavation-mini',
      'hvac-minisplit-singlezone-12k',
      'roofing-metal-standing-seam-24ga',
      'insul-sprayfoam-closedcell-2in',
      'waterproofing-foundation-spray-bituminous',
    ];
    for (const id of gaps) {
      const rollup = assemblyMaterialCost(id);
      expect(rollup).toBeDefined();
      expect(rollup!.pricedComponents).toBe(0);
      expect(rollup!.materialCostPerUnit).toBe(0);
    }
  });

  it('does not invent supplier prices (all rows resolve to the verified corpus)', () => {
    // Spot-check: every pass-2 row's (supplier, productName, unitPrice, priceUnit)
    // must correspond to a real supplierPrices47802 row. Full cross-check lives
    // in the generator script; here we pin the highest-risk conversions.
    const byKey = new Map(
      PRICED_ASSEMBLY_COMPONENTS.map((p) => [p.componentKey + '|' + p.priceUnit, p])
    );
    // 92-5/8" stud: LF->EA length conversion
    expect(byKey.get('mat_studs_2x4_spf|EA')!.unitPrice).toBeCloseTo(3.86, 2);
    // HardiePlank: SF->SQ area conversion
    expect(byKey.get('mat_hardieplank_lap_boards|SQ')!.unitPrice).toBe(204);
    // Tyvek seam tape: LF->ROLL length conversion (164 LF/roll)
    expect(byKey.get('mat_seam_tape_tyvek_2in|ROLL')!.unitPrice).toBeCloseTo(14.76, 2);
    // #15 felt: SF->SQ (432 SF roll)
    expect(byKey.get('mat_underlayment_felt_15lb|SQ')!.unitPrice).toBe(6.62);
  });

  it('pins rejection reasons (no weak matches forced)', () => {
    // Components deliberately left unmatched; each has a documented reason.
    // This test guards against future passes silently "filling" these gaps
    // with below-bar matches.
    const rejectedKeys = [
      'mat_duct_tape_rolls', // no candidate: corpus has only foil HVAC tape
      'mat_tarps_magnetic_sweep', // consumable allocation, not a stocked product
      'mat_joint_flashing_aluminum', // product mismatch (drip edge != joint tabs)
      'fast_siding_nails_hdg_6d', // below threshold, no 6d HDG ring-shank
      'fast_insulation_staples_t50', // no candidate in corpus
      'mat_hardwood_oak_34x325', // no candidate: no solid hardwood flooring
      'fast_flooring_cleats_16ga_2in', // no candidate
      'mat_ijoist_series_1178', // product mismatch (hanger != joist)
      'mat_metal_panels_standing_seam_24ga', // specialty, not in corpus
      'mat_epdm_membrane_60mil_sheet', // product mismatch
      'mat_sprayfoam_closedcell_boardfoot', // specialty chemical system
      'mat_asphalt_waterproofing_coating', // no candidate
    ];
    for (const key of rejectedKeys) {
      const found = PRICED_ASSEMBLY_COMPONENTS.filter((p) => p.componentKey === key);
      expect(found.length).toBe(0);
    }
  });
});
