import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";

export type AssemblyCatalogUnit = "CY" | "EA" | "GAL" | "HR" | "LF" | "LS" | "SF" | "SQ" | "TON";
export type AssemblyCatalogCostItemKind = "allowance" | "composite" | "equipment" | "labor" | "material" | "subcontractor";

export type StarterCatalogComponent = {
  key: string;
  label: string;
  quantityPerUnit: number;
  help: string;
  compatibleUnits: AssemblyCatalogUnit[];
  allowedCostItemKinds: AssemblyCatalogCostItemKind[];
};

export type StarterCatalogTemplate = {
  id: string;
  code: string;
  name: string;
  description: string;
  unitOfMeasure: string;
  csiDivision: string;
  csiTitle: string;
  nahbGroup: string;
  trade: string;
  measurementBasis: string;
  wasteGuidance: string;
  version: number;
  review: {
    status: "reviewed";
    source: "TradeOS-authored";
    reviewedOn: string;
    regionalBasis: string;
  };
  components: StarterCatalogComponent[];
};

export type StarterCatalogCoverage = {
  nahbGroup: string;
  templateCount: number;
  csiDivisions: string[];
  measurementUnits: string[];
  trades: string[];
};

export function assessCostItemMapping(component: StarterCatalogComponent, item: CostItemCatalogRecord) {
  const normalizedUnit = normalizeUnit(item.unitOfMeasure);
  const kind = getCostItemKind(item);
  const unitCompatible = normalizedUnit !== null && component.compatibleUnits.includes(normalizedUnit);
  const kindCompatible = component.allowedCostItemKinds.includes(kind);
  return {
    compatible: unitCompatible && kindCompatible,
    normalizedUnit,
    kind,
    reasons: [
      ...(!unitCompatible ? [`Expected ${formatList(component.compatibleUnits)}; found ${item.unitOfMeasure}`] : []),
      ...(!kindCompatible ? [`Expected ${formatList(component.allowedCostItemKinds)}; found ${kind}`] : []),
    ],
  };
}

export function normalizeUnit(value: string): AssemblyCatalogUnit | null {
  const normalized = value.trim().toUpperCase().replace(/[._-]/g, " ").replace(/\s+/g, " ");
  const aliases: Record<string, AssemblyCatalogUnit> = {
    CY: "CY", CYS: "CY", "CU YD": "CY", "CU YDS": "CY", "CUBIC YARD": "CY", "CUBIC YARDS": "CY", YD3: "CY",
    EA: "EA", EACH: "EA", UNIT: "EA", UNITS: "EA",
    GAL: "GAL", GALLON: "GAL", GALLONS: "GAL",
    HR: "HR", HRS: "HR", HOUR: "HR", HOURS: "HR",
    LF: "LF", "LIN FT": "LF", "LINEAR FOOT": "LF", "LINEAR FEET": "LF",
    LS: "LS", "LUMP SUM": "LS", ALLOWANCE: "LS",
    SF: "SF", SQFT: "SF", "SQ FT": "SF", "SQUARE FOOT": "SF", "SQUARE FEET": "SF", FT2: "SF",
    SQ: "SQ", SQUARE: "SQ", SQUARES: "SQ", "ROOFING SQUARE": "SQ", "ROOFING SQUARES": "SQ",
    TON: "TON", TONS: "TON",
  };
  return aliases[normalized] ?? null;
}

function getCostItemKind(item: CostItemCatalogRecord): AssemblyCatalogCostItemKind {
  const count = [item.laborRateId, item.materialId, item.equipmentId, item.subcontractorId].filter(Boolean).length;
  if (count > 1) return "composite";
  if (item.laborRateId) return "labor";
  if (item.materialId) return "material";
  if (item.equipmentId) return "equipment";
  if (item.subcontractorId) return "subcontractor";
  return "allowance";
}

function formatList(values: readonly string[]) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}
