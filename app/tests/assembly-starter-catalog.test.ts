import { ASSEMBLY_CATALOG, CSI_DIVISIONS, NAHB_GROUPS } from "../modules/assemblies-database/catalog";

describe("assembly starter catalog", () => {
  it("has unique ids and CSI-coded assembly codes", () => {
    expect(new Set(ASSEMBLY_CATALOG.map((item) => item.id)).size).toBe(ASSEMBLY_CATALOG.length);
    expect(new Set(ASSEMBLY_CATALOG.map((item) => item.code)).size).toBe(ASSEMBLY_CATALOG.length);
    for (const item of ASSEMBLY_CATALOG) {
      expect(item.code).toMatch(/^\d{2} \d{2} \d{2}-TOS-\d{3}$/);
      expect(CSI_DIVISIONS.some((division) => division.code === item.csiDivision)).toBe(true);
      expect(NAHB_GROUPS).toContain(item.nahbGroup);
    }
  });

  it("requires distinct component keys and positive quantities", () => {
    for (const item of ASSEMBLY_CATALOG) {
      expect(item.components.length).toBeGreaterThanOrEqual(2);
      expect(new Set(item.components.map((component) => component.key)).size).toBe(item.components.length);
      for (const component of item.components) {
        expect(component.quantityPerUnit).toBeGreaterThan(0);
        expect(component.help.length).toBeGreaterThan(10);
      }
    }
  });
});
