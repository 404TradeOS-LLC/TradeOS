import { PRICED_ASSEMBLY_COMPONENTS } from "../modules/costbook/pricedAssemblies";
import {
  HIGH_CONFIDENCE_LEGACY_ASSEMBLY_MATCH_REJECTIONS,
  AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS,
  auditLegacyAssemblyPriceMatches,
} from "../modules/costbook/legacyAssemblyMatchAudit";
import { TRADEOS_ASSEMBLIES } from "../modules/costbook/tradeosAssemblies";

describe("Costbook legacy assembly price-match audit", () => {
  it("pins every high-confidence rejection to an existing generated row and assembly slot", () => {
    const findings = auditLegacyAssemblyPriceMatches();

    expect(findings).toHaveLength(
      HIGH_CONFIDENCE_LEGACY_ASSEMBLY_MATCH_REJECTIONS.length
    );
    expect(findings.length).toBeGreaterThanOrEqual(20);

    for (const finding of findings) {
      const assembly = TRADEOS_ASSEMBLIES.find(
        (candidate) => candidate.id === finding.assemblyId
      );
      expect(assembly).toBeDefined();
      expect(
        assembly!.components.some(
          (component) =>
            component.key === finding.componentKey &&
            (component.label === finding.component.label ||
              component.label.startsWith(finding.component.label) ||
              finding.component.label.startsWith(component.label))
        )
      ).toBe(true);
      expect(finding.component.productName).toContain(
        finding.productNameIncludes
      );
    }
  });

  it("excludes deterministic false positives without inventing replacements", () => {
    const trusted = AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS;

    expect(trusted.length).toBe(
      PRICED_ASSEMBLY_COMPONENTS.length -
        HIGH_CONFIDENCE_LEGACY_ASSEMBLY_MATCH_REJECTIONS.length
    );

    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_joists_2x10_spf" &&
          component.productName.includes("2 in. x 4 in. x 8 ft.")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_helical_pile_extension" &&
          component.productName.includes("Concrete Brick")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_paint_interior_latex_gal" &&
          component.productName.includes("Exterior Paint & Primer")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "equip_breaker_20a_single_pole" &&
          component.productName.includes("15 Amp Single-Pole Circuit Breaker")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_brick_modular_clay_facing" &&
          component.productName.includes("Concrete Brick")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_concrete_3500_pier" &&
          component.productName.includes("Quikrete 80 lb. Concrete Mix")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_flex_connectors_34_stainless" &&
          component.productName.includes("Push-to-Connect Coupling")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_vent_pipe_pvc_sch40_kit" &&
          component.productName.includes("Schedule 40 PVC Socket Tee")
      )
    ).toBe(false);
    expect(
      trusted.some(
        (component) =>
          component.componentKey === "mat_aggregate_subbase_crushed_stone" &&
          component.productName.includes("#73 Limestone")
      )
    ).toBe(false);
  });

  it("retains compatible evidence next to rejected rows", () => {
    expect(
      AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS.some(
        (component) =>
          component.componentKey === "mat_deck_posts_6x6_pt" &&
          component.productName.includes("6 in. x 6 in. x 8 ft.")
      )
    ).toBe(true);

    expect(
      AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS.some(
        (component) =>
          component.componentKey === "mat_paint_interior_latex_gal" &&
          component.productName.includes("Interior Eggshell")
      )
    ).toBe(true);
  });

  it("classifies the audited conflicts so future cleanup can stay bounded", () => {
    const findings = auditLegacyAssemblyPriceMatches();
    expect(findings.some((finding) => finding.conflict === "NOMINAL_DIMENSION")).toBe(true);
    expect(findings.some((finding) => finding.conflict === "PRODUCT_TYPE")).toBe(true);
    expect(findings.some((finding) => finding.conflict === "MATERIAL_SPEC")).toBe(true);
  });
});
