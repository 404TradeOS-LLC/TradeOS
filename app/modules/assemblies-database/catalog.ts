export const CSI_DIVISIONS = [
  { code: "02", name: "Existing Conditions" },
  { code: "03", name: "Concrete" },
  { code: "06", name: "Wood, Plastics, and Composites" },
  { code: "07", name: "Thermal and Moisture Protection" },
  { code: "08", name: "Openings" },
  { code: "09", name: "Finishes" },
  { code: "12", name: "Furnishings" },
  { code: "22", name: "Plumbing" },
  { code: "23", name: "HVAC" },
  { code: "26", name: "Electrical" },
  { code: "31", name: "Earthwork" },
  { code: "32", name: "Exterior Improvements" },
] as const;

export const NAHB_GROUPS = [
  "Site work",
  "Foundation",
  "Framing",
  "Exterior shell",
  "Interior finishes",
  "Cabinets and trim",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Outdoor living",
] as const;

export type NahbGroup = (typeof NAHB_GROUPS)[number];
export type AssemblyCatalogUnit = "CY" | "EA" | "GAL" | "HR" | "LF" | "LS" | "SF" | "SQ" | "TON";
export type AssemblyCatalogCostItemKind = "allowance" | "composite" | "equipment" | "labor" | "material" | "subcontractor";

export const ASSEMBLY_CATALOG_VERSION = "2026.09.1";

const MATERIAL_KINDS: readonly AssemblyCatalogCostItemKind[] = ["material", "composite"];
const LABOR_KINDS: readonly AssemblyCatalogCostItemKind[] = ["labor", "subcontractor", "composite"];
const EQUIPMENT_KINDS: readonly AssemblyCatalogCostItemKind[] = ["equipment", "subcontractor", "composite"];
const ALLOWANCE_KINDS: readonly AssemblyCatalogCostItemKind[] = ["allowance", "material", "subcontractor", "composite"];

export interface AssemblyCatalogComponent {
  key: string;
  label: string;
  quantityPerUnit: number;
  help: string;
  compatibleUnits: readonly AssemblyCatalogUnit[];
  allowedCostItemKinds: readonly AssemblyCatalogCostItemKind[];
}

export interface AssemblyCatalogTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  unitOfMeasure: "CY" | "EA" | "LF" | "SF" | "SQ";
  csiDivision: string;
  csiTitle: string;
  nahbGroup: NahbGroup;
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
  components: AssemblyCatalogComponent[];
}

export interface AssemblyCatalogCoverageRow {
  nahbGroup: NahbGroup;
  templateCount: number;
  csiDivisions: string[];
  measurementUnits: AssemblyCatalogTemplate["unitOfMeasure"][];
  trades: string[];
}

export interface CatalogMappingCandidate {
  unitOfMeasure: string;
  laborRateId: string | null;
  materialId: string | null;
  equipmentId: string | null;
  subcontractorId: string | null;
}

export interface CatalogMappingAssessment {
  compatible: boolean;
  normalizedUnit: AssemblyCatalogUnit | null;
  kind: AssemblyCatalogCostItemKind;
  reasons: string[];
}

/**
 * A review-first residential starter library. Quantities are transparent
 * estimating defaults per one assembly unit. Installation requires an
 * estimator to map every slot to an active Cost Item in their own tenant.
 * No price, supplier record, or authoritative code-compliance claim is
 * embedded in this catalog.
 */
export const ASSEMBLY_CATALOG: readonly AssemblyCatalogTemplate[] = [
  template("site-excavation", "31 23 16-TOS-001", "General excavation", "CY", "31", "Earthwork", "Site work", "Sitework", "Cubic yard of in-place soil", "Confirm swell, haul distance, disposal, and access.", [
    component("excavation", "Excavation labor and equipment", 1, "Combined excavation Cost Item per CY", ["CY"], EQUIPMENT_KINDS),
    component("haul", "Haul and disposal allowance", 1, "Cost Item per CY; use a zero-cost reviewed item when excluded", ["CY", "LS"], ALLOWANCE_KINDS),
  ]),
  template("slab-four-inch", "03 30 00-TOS-001", "4 in. concrete slab", "SF", "03", "Concrete", "Foundation", "Concrete", "Square foot of slab", "Default recipe includes 5% concrete overage; revise for site and supplier conditions.", [
    component("base", "Compacted granular base", 0.0417, "4 in. base expressed as CY per SF", ["CY"], MATERIAL_KINDS),
    component("concrete", "Ready-mix concrete", 0.01296, "4 in. slab plus 5% overage, CY per SF", ["CY"], MATERIAL_KINDS),
    component("reinforcing", "Slab reinforcing", 1.05, "SF per SF including 5% overlap/waste", ["SF"], MATERIAL_KINDS),
    component("place-finish", "Place and finish labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
  ]),
  template("wall-2x4-16oc", "06 11 00-TOS-001", "2x4 interior wall framing, 16 in. O.C.", "SF", "06", "Wood, Plastics, and Composites", "Framing", "Carpentry", "Square foot of framed wall face", "Default assumes 8 ft wall, three plates, 10% lumber waste, and no openings.", [
    component("studs", "2x4 wall studs", 0.1031, "EA per SF for 16 in. O.C., 8 ft height, plus 10%", ["EA"], MATERIAL_KINDS),
    component("plates", "2x4 plates", 0.0344, "EA of 8 ft stock per SF for three plates plus 10%", ["EA"], MATERIAL_KINDS),
    component("hardware", "Framing fasteners", 1, "Fastener allowance Cost Item per SF", ["SF", "LS"], ALLOWANCE_KINDS),
    component("labor", "Wall framing labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
  ]),
  template("roof-asphalt-shingle", "07 31 13-TOS-001", "Architectural asphalt shingle roofing", "SQ", "07", "Thermal and Moisture Protection", "Exterior shell", "Roofing", "Roofing square (100 SF)", "Set waste for roof shape and valleys; default component factors use 10% shingle waste.", [
    component("shingles", "Architectural shingles", 1.1, "Roofing squares per installed square", ["SQ"], MATERIAL_KINDS),
    component("underlayment", "Underlayment", 1.05, "Squares per installed square", ["SQ"], MATERIAL_KINDS),
    component("starter-ridge", "Starter and ridge allowance", 1, "Reviewed allowance per square", ["SQ", "LS"], ALLOWANCE_KINDS),
    component("flashing", "Flashing and drip edge allowance", 1, "Reviewed allowance per square", ["SQ", "LS"], ALLOWANCE_KINDS),
    component("labor", "Roofing installation labor", 1, "Labor Cost Item per square", ["SQ"], LABOR_KINDS),
  ]),
  template("vinyl-siding", "07 46 33-TOS-001", "Vinyl siding system", "SF", "07", "Thermal and Moisture Protection", "Exterior shell", "Siding", "Square foot of wall area", "Deduct large openings and revise waste for wall geometry; default siding factor is 8%.", [
    component("housewrap", "Weather-resistive barrier", 1.05, "SF per SF including laps", ["SF"], MATERIAL_KINDS),
    component("siding", "Vinyl siding", 1.08, "SF per SF including 8% waste", ["SF"], MATERIAL_KINDS),
    component("trim", "Starter, corners, and trim allowance", 1, "Reviewed allowance per SF", ["SF", "LS"], ALLOWANCE_KINDS),
    component("labor", "Siding installation labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
  ]),
  template("interior-door", "08 14 16-TOS-001", "Prehung interior door", "EA", "08", "Openings", "Interior finishes", "Carpentry", "Each complete door opening", "Confirm handing, jamb width, hardware grade, casing, and finish.", [
    component("door", "Prehung interior door", 1, "One door unit per completed opening", ["EA"], MATERIAL_KINDS),
    component("hardware", "Passage/privacy hardware", 1, "One hardware set per completed opening", ["EA"], MATERIAL_KINDS),
    component("casing", "Door casing allowance", 1, "Reviewed allowance per opening", ["EA", "LF", "LS"], ALLOWANCE_KINDS),
    component("labor", "Door set and trim labor", 1, "Labor Cost Item per opening", ["EA"], LABOR_KINDS),
  ]),
  template("drywall-half-inch", "09 29 00-TOS-001", "1/2 in. drywall, hang and finish", "SF", "09", "Finishes", "Interior finishes", "Drywall", "Square foot of finished wall or ceiling surface", "Default board factor is 10% waste. Select the required finish level and substrate conditions.", [
    component("board", "1/2 in. gypsum board", 1.1, "SF per installed SF including 10% waste", ["SF"], MATERIAL_KINDS),
    component("finish-materials", "Tape, compound, and fasteners", 1, "Consumables allowance per SF", ["SF", "LS"], ALLOWANCE_KINDS),
    component("hang-labor", "Drywall hanging labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
    component("finish-labor", "Drywall finishing labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
  ]),
  template("paint-interior-wall", "09 91 23-TOS-001", "Interior wall paint, two coats", "SF", "09", "Finishes", "Interior finishes", "Painting", "Square foot of paintable wall surface", "Confirm substrate condition, color change, primer need, masking, and occupied-space protection.", [
    component("paint", "Interior wall paint", 0.0067, "Gallons per SF for two coats at 350 SF/gal plus allowance", ["GAL"], MATERIAL_KINDS),
    component("sundries", "Masking and sundries", 1, "Reviewed allowance per SF", ["SF", "LS"], ALLOWANCE_KINDS),
    component("prep", "Surface preparation labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
    component("paint-labor", "Two-coat application labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
  ]),
  template("lvp-floor", "09 65 19-TOS-001", "Luxury vinyl plank flooring", "SF", "09", "Finishes", "Interior finishes", "Flooring", "Square foot of floor area", "Default plank factor is 10% waste; add subfloor repair or moisture mitigation separately.", [
    component("flooring", "LVP flooring", 1.1, "SF per installed SF including 10% waste", ["SF"], MATERIAL_KINDS),
    component("underlayment", "Underlayment or vapor layer", 1.05, "SF per SF including laps", ["SF"], MATERIAL_KINDS),
    component("transitions", "Transitions and accessories", 1, "Reviewed allowance per SF", ["SF", "LF", "LS"], ALLOWANCE_KINDS),
    component("labor", "Flooring installation labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
  ]),
  template("baseboard", "06 46 00-TOS-001", "Paint-grade baseboard", "LF", "06", "Wood, Plastics, and Composites", "Cabinets and trim", "Finish carpentry", "Linear foot of installed baseboard", "Default trim factor is 10% waste. Painting may be included here or kept as a separate assembly.", [
    component("trim", "Baseboard material", 1.1, "LF per installed LF including 10% waste", ["LF"], MATERIAL_KINDS),
    component("fasteners", "Fasteners and caulk", 1, "Consumables allowance per LF", ["LF", "LS"], ALLOWANCE_KINDS),
    component("labor", "Baseboard installation labor", 1, "Labor Cost Item per LF", ["LF"], LABOR_KINDS),
    component("finish", "Fill, caulk, and paint", 1, "Finish Cost Item per LF", ["LF"], LABOR_KINDS),
  ]),
  template("receptacle", "26 27 26-TOS-001", "Standard duplex receptacle", "EA", "26", "Electrical", "Electrical", "Electrical", "Each completed device", "Circuit capacity, AFCI/GFCI requirements, box condition, and permit/inspection remain project-specific.", [
    component("device", "Duplex receptacle and cover", 1, "One device and cover per completed location", ["EA"], MATERIAL_KINDS),
    component("box-wire", "Box, cable, and connectors allowance", 1, "Reviewed allowance per device", ["EA", "LS"], ALLOWANCE_KINDS),
    component("labor", "Electrician installation labor", 1, "Labor Cost Item per device", ["EA"], LABOR_KINDS),
  ]),
  template("toilet-replace", "22 42 13-TOS-001", "Residential toilet replacement", "EA", "22", "Plumbing", "Plumbing", "Plumbing", "Each fixture replacement", "Confirm shutoff, flange, disposal, access, code, and permit requirements.", [
    component("fixture", "Toilet fixture", 1, "One fixture per completed replacement", ["EA"], MATERIAL_KINDS),
    component("connection", "Wax ring, supply, and hardware", 1, "Connection kit per fixture", ["EA"], MATERIAL_KINDS),
    component("labor", "Remove and install labor", 1, "Labor Cost Item per fixture", ["EA"], LABOR_KINDS),
    component("disposal", "Fixture disposal", 1, "Disposal allowance per fixture", ["EA", "LS"], ALLOWANCE_KINDS),
  ]),
  template("mini-split-single-zone", "23 81 26-TOS-001", "Single-zone mini-split system", "EA", "23", "HVAC", "Mechanical", "HVAC", "Each complete indoor/outdoor system", "Capacity, line-set length, electrical, condensate, controls, commissioning, permits, and manufacturer requirements are project-specific.", [
    component("equipment", "Matched mini-split equipment", 1, "Indoor/outdoor equipment set", ["EA"], ["material", "equipment", "subcontractor", "composite"]),
    component("lineset", "Line set and accessories", 1, "Reviewed system allowance", ["EA", "LF", "LS"], ALLOWANCE_KINDS),
    component("install", "HVAC installation labor", 1, "Labor Cost Item per system", ["EA"], LABOR_KINDS),
    component("startup", "Evacuation and commissioning", 1, "Startup Cost Item per system", ["EA"], LABOR_KINDS),
  ]),
  template("deck-pressure-treated", "06 15 00-TOS-001", "Pressure-treated wood deck", "SF", "06", "Wood, Plastics, and Composites", "Outdoor living", "Decks", "Square foot of deck surface", "Footings, ledger conditions, height, stairs, guards, permits, and structural design must be confirmed separately.", [
    component("footings", "Footings and posts allowance", 1, "Reviewed allowance per SF", ["SF", "LS"], ALLOWANCE_KINDS),
    component("framing", "Pressure-treated framing", 1, "Reviewed joist/beam allowance per SF", ["SF", "LS"], ALLOWANCE_KINDS),
    component("decking", "Pressure-treated decking", 1.1, "SF per installed SF including 10% waste", ["SF"], MATERIAL_KINDS),
    component("hardware", "Connectors and fasteners", 1, "Reviewed allowance per SF", ["SF", "LS"], ALLOWANCE_KINDS),
    component("labor", "Deck construction labor", 1, "Labor Cost Item per SF", ["SF"], LABOR_KINDS),
  ]),
] as const;

function component(
  key: string,
  label: string,
  quantityPerUnit: number,
  help: string,
  compatibleUnits: readonly AssemblyCatalogUnit[],
  allowedCostItemKinds: readonly AssemblyCatalogCostItemKind[],
): AssemblyCatalogComponent {
  return { key, label, quantityPerUnit, help, compatibleUnits, allowedCostItemKinds };
}

function template(
  id: string,
  code: string,
  name: string,
  unitOfMeasure: AssemblyCatalogTemplate["unitOfMeasure"],
  csiDivision: string,
  csiTitle: string,
  nahbGroup: NahbGroup,
  trade: string,
  measurementBasis: string,
  wasteGuidance: string,
  components: AssemblyCatalogComponent[],
): AssemblyCatalogTemplate {
  return {
    id,
    code,
    name,
    description: `${name}. TradeOS residential starter recipe; review component mapping and production assumptions before estimating.`,
    unitOfMeasure,
    csiDivision,
    csiTitle,
    nahbGroup,
    trade,
    measurementBasis,
    wasteGuidance,
    version: 1,
    review: {
      status: "reviewed",
      source: "TradeOS-authored",
      reviewedOn: "2026-09-17",
      regionalBasis: "United States residential baseline; local estimator review required",
    },
    components,
  };
}

export const ASSEMBLY_CATALOG_COVERAGE: readonly AssemblyCatalogCoverageRow[] = NAHB_GROUPS.map((nahbGroup) => {
  const templates = ASSEMBLY_CATALOG.filter((template) => template.nahbGroup === nahbGroup);
  return {
    nahbGroup,
    templateCount: templates.length,
    csiDivisions: uniqueSorted(templates.map((template) => template.csiDivision)),
    measurementUnits: uniqueSorted(templates.map((template) => template.unitOfMeasure)),
    trades: uniqueSorted(templates.map((template) => template.trade)),
  };
});

export function assessCatalogComponentMapping(
  component: AssemblyCatalogComponent,
  candidate: CatalogMappingCandidate,
): CatalogMappingAssessment {
  const normalizedUnit = normalizeAssemblyCatalogUnit(candidate.unitOfMeasure);
  const kind = getCatalogCostItemKind(candidate);
  const reasons: string[] = [];
  if (!normalizedUnit || !component.compatibleUnits.includes(normalizedUnit)) {
    reasons.push(`expects ${formatList(component.compatibleUnits)} but Cost Item uses ${candidate.unitOfMeasure || "no unit"}`);
  }
  if (!component.allowedCostItemKinds.includes(kind)) {
    reasons.push(`expects ${formatList(component.allowedCostItemKinds)} but Cost Item is ${kind}`);
  }
  return { compatible: reasons.length === 0, normalizedUnit, kind, reasons };
}

export function normalizeAssemblyCatalogUnit(value: string): AssemblyCatalogUnit | null {
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

function getCatalogCostItemKind(candidate: CatalogMappingCandidate): AssemblyCatalogCostItemKind {
  const kinds = [candidate.laborRateId, candidate.materialId, candidate.equipmentId, candidate.subcontractorId].filter(Boolean).length;
  if (kinds > 1) return "composite";
  if (candidate.laborRateId) return "labor";
  if (candidate.materialId) return "material";
  if (candidate.equipmentId) return "equipment";
  if (candidate.subcontractorId) return "subcontractor";
  return "allowance";
}

function formatList(values: readonly string[]): string {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function getAssemblyCatalogTemplate(id: string): AssemblyCatalogTemplate | undefined {
  return ASSEMBLY_CATALOG.find((template) => template.id === id);
}
