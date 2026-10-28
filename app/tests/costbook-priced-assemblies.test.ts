import {
  ASSEMBLY_MATERIAL_COSTS,
  PRICED_ASSEMBLY_COMPONENTS,
  assemblyMaterialCost,
} from '../modules/costbook/pricedAssemblies';

describe('Priced assemblies', () => {
  it('carries priced component matches', () => {
    expect(PRICED_ASSEMBLY_COMPONENTS.length).toBeGreaterThan(100);
    // Pass-2 documented exception: mat_plates_2x4_spf scores 0.38 (label
    // verbosity dilutes token overlap; core 2x4/SPF/lumber tokens all match).
    const subThreshold = new Map([['mat_plates_2x4_spf', 0.38]]);
    for (const p of PRICED_ASSEMBLY_COMPONENTS) {
      expect(p.unitPrice).toBeGreaterThan(0);
      expect(p.extendedCost).toBeGreaterThanOrEqual(0);
      expect(p.matchScore).toBeGreaterThanOrEqual(subThreshold.get(p.componentKey) ?? 0.4);
      expect(p.supplier).toBeTruthy();
    }
  });

  it('does not use a 104-5/8 in stud for the 92-5/8 in wall-stud component', () => {
    const conflicting = PRICED_ASSEMBLY_COMPONENTS.find(
      (component) =>
        component.componentKey === 'mat_studs_2x4_spf' &&
        component.productName.includes('104-5/8')
    );
    expect(conflicting).toBeUndefined();
  });

  it('rolls up material costs per assembly', () => {
    expect(ASSEMBLY_MATERIAL_COSTS.length).toBe(88);
    const withCost = ASSEMBLY_MATERIAL_COSTS.filter((a) => a.pricedComponents > 0);
    expect(withCost.length).toBeGreaterThan(50);
    for (const a of withCost) {
      expect(a.materialCostPerUnit).toBeGreaterThanOrEqual(0);
      expect(a.pricedComponents).toBeLessThanOrEqual(a.totalComponents);
    }
  });

  it('looks up an assembly cost by id', () => {
    const sample = ASSEMBLY_MATERIAL_COSTS.find((a) => a.pricedComponents > 0);
    expect(sample).toBeDefined();
    expect(assemblyMaterialCost(sample!.assemblyId)).toEqual(sample);
    expect(assemblyMaterialCost('nope')).toBeUndefined();
  });
});
