/**
 * Bridge the researched 88 TradeOS recipes into the existing tenant-scoped
 * starter-catalog installer. No prices or supplier identities are embedded.
 * The immutable research corpus remains the source of recipe quantities.
 */
import { NAHB_PHASE_TITLES, TRADEOS_ASSEMBLIES } from "../costbook/tradeosAssemblies";
import { TRADEOS_ASSEMBLY_SOURCES } from "../costbook/tradeosAssemblySources";
import {
  ASSEMBLY_CATALOG,
  NAHB_GROUPS,
  normalizeAssemblyCatalogUnit,
  type AssemblyCatalogCostItemKind,
  type AssemblyCatalogTemplate,
  type AssemblyCatalogUnit,
} from "./catalog";

const registeredSources = new Set(TRADEOS_ASSEMBLY_SOURCES.map((source) => source.sourceId));

export interface ResearchAssemblyCatalogTemplate extends Omit<AssemblyCatalogTemplate, "nahbGroup" | "review"> {
  nahbGroup: string;
  nahbPhase: string;
  blockingReasons: string[];
  evidenceRefs: string[];
  review: {
    status: "research";
    source: string;
    reviewedOn: string;
    regionalBasis: string;
  };
}

export const TRADEOS_RESEARCH_CATALOG: readonly ResearchAssemblyCatalogTemplate[] = TRADEOS_ASSEMBLIES.map((assembly) => {
  const evidenceRefs = [...new Set([
    ...assembly.evidenceRefs,
    ...assembly.components.flatMap((component) => component.evidenceRefs),
  ])];
  const missingSources = evidenceRefs.filter((ref) => !registeredSources.has(ref));
  const invalidUnits = assembly.components
    .filter((component) => !normalizeAssemblyCatalogUnit(component.compatibleUnits[0] ?? ""))
    .map((component) => component.key);

  return {
    id: `tradeos:${assembly.id}`,
    code: assembly.code,
    name: assembly.name,
    description: assembly.description,
    unitOfMeasure: assembly.unitOfMeasure as AssemblyCatalogTemplate["unitOfMeasure"],
    csiDivision: assembly.csiDivision,
    csiTitle: assembly.csiTitle,
    nahbGroup: NAHB_PHASE_TITLES[assembly.nahbPhase],
    nahbPhase: assembly.nahbPhase,
    trade: assembly.trade,
    measurementBasis: assembly.measurementBasis,
    wasteGuidance: [
      assembly.requiresLocalCalibration ? "Local production-rate calibration required." : "Verify production assumptions locally.",
      assembly.scopeExclusions.length ? `Excluded: ${assembly.scopeExclusions.join("; ")}.` : "",
    ].filter(Boolean).join(" "),
    version: 1,
    review: {
      status: "research",
      source: "TradeOS research assembly corpus",
      reviewedOn: "",
      regionalBasis: "Research recipe only. Estimator must verify scope, quantities, units, local labor and materials before install.",
    },
    evidenceRefs,
    blockingReasons: [
      ...(missingSources.length ? [`Missing research source references: ${missingSources.join(", ")}`] : []),
      ...(invalidUnits.length ? [`Unrecognized component units: ${invalidUnits.join(", ")}`] : []),
    ],
    // Recipe quantities are denominated in the first stated unit. Alternate
    // package units (EA vs BOX, SF vs ROLL, etc.) require explicit conversion,
    // never a silent 1:1 substitute.
    components: assembly.components.map((component) => ({
      key: component.key,
      label: component.label,
      quantityPerUnit: component.quantityPerUnit,
      help: [
        component.help || component.calculationBasis || component.label,
        component.assumption ? `Assumption: ${component.assumption}` : "",
        component.compatibleUnits.length > 1
          ? `Recipe quantity uses ${component.compatibleUnits[0]}; alternate packaging requires explicit Cost Item unit conversion.`
          : "",
      ].filter(Boolean).join(" "),
      compatibleUnits: [normalizeAssemblyCatalogUnit(component.compatibleUnits[0] ?? "") ??
        component.compatibleUnits[0] as AssemblyCatalogUnit],
      allowedCostItemKinds: [...component.allowedCostItemKinds] as AssemblyCatalogCostItemKind[],
    })),
  };
});

/** Keep the 14 reviewed starters unchanged, and expose research recipes separately. */
export const EXPANDED_ASSEMBLY_CATALOG = [...ASSEMBLY_CATALOG, ...TRADEOS_RESEARCH_CATALOG];

export function getExpandedCatalogTemplate(id: string) {
  return EXPANDED_ASSEMBLY_CATALOG.find((template) => template.id === id);
}

export const EXPANDED_ASSEMBLY_CATALOG_COVERAGE = [
  ...NAHB_GROUPS,
  ...Object.values(NAHB_PHASE_TITLES),
].map((nahbGroup) => {
  const recipes = EXPANDED_ASSEMBLY_CATALOG.filter((template) => template.nahbGroup === nahbGroup);
  return {
    nahbGroup,
    templateCount: recipes.length,
    csiDivisions: [...new Set(recipes.map((recipe) => recipe.csiDivision))].sort(),
    measurementUnits: [...new Set(recipes.map((recipe) => recipe.unitOfMeasure))].sort(),
    trades: [...new Set(recipes.map((recipe) => recipe.trade))].sort(),
  };
}).filter((group) => group.templateCount > 0);
