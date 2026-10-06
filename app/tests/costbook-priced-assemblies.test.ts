import {
  ASSEMBLY_MATERIAL_COSTS,
  PRICED_ASSEMBLY_COMPONENTS,
  assemblyMaterialCost,
} from '../modules/costbook/pricedAssemblies';

describe('Priced assemblies', () => {
  it('carries priced component matches', () => {
    expect(PRICED_ASSEMBLY_COMPONENTS.length).toBeGreaterThan(100);
    for (const p of PRICED_ASSEMBLY_COMPONENTS) {
      expect(p.unitPrice).toBeGreaterThan(0);
      expect(p.extendedCost).toBeGreaterThanOrEqual(0);
      expect(p.matchScore).toBeGreaterThanOrEqual(0.4);
      expect(p.supplier).toBeTruthy();
    }
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
