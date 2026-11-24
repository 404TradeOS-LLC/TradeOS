import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";

export type AssemblyCatalogUnit = "CY" | "EA" | "GAL" | "HR" | "LF" | "LS" | "SF" | "SQ" | "TON" | "BAG" | "BF" | "BD" | "BOX" | "BTL" | "CAN" | "DAY" | "KIT" | "LB" | "PAIR" | "ROLL" | "SET" | "SHT" | "SY" | "TUB" | "TUBE";
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
  nahbPhase?: string;
  blockingReasons?: string[];
  evidenceRefs?: string[];
  trade: string;
  measurementBasis: string;
  wasteGuidance: string;
  version: number;
  review: {
    status: "reviewed" | "research";
    source: string;
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
    BAG: "BAG", BAGS: "BAG", BF: "BF", "BOARD FOOT": "BF", "BOARD FEET": "BF",
    BD: "BD", BOARD: "BD", BOARDS: "BD", BOX: "BOX", BOXES: "BOX", BTL: "BTL", BOTTLE: "BTL", BOTTLES: "BTL",
    CAN: "CAN", CANS: "CAN", DAY: "DAY", DAYS: "DAY", KIT: "KIT", KITS: "KIT",
    LB: "LB", LBS: "LB", POUND: "LB", POUNDS: "LB", PAIR: "PAIR", PAIRS: "PAIR",
    ROLL: "ROLL", ROLLS: "ROLL", SET: "SET", SETS: "SET", SHT: "SHT", SHEET: "SHT", SHEETS: "SHT",
    SY: "SY", "SQUARE YARD": "SY", "SQUARE YARDS": "SY", TUB: "TUB", TUBS: "TUB",
    TUBE: "TUBE", TUBES: "TUBE",
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


/**
 * Read-only browse facets over server-returned, price-neutral starter recipes.
 * Installation is derived from the tenant's active Assembly codes, not
 * template metadata. These helpers never grant write access or change recipes.
 */
export type StarterCatalogInstallation = "all" | "installed" | "available";

export type StarterCatalogFilters = {
  query: string;
  nahbGroup: string;
  nahbPhase: string;
  csiDivision: string;
  trade: string;
  unit: string;
  installation: StarterCatalogInstallation;
};

export const DEFAULT_STARTER_CATALOG_FILTERS: StarterCatalogFilters = {
  query: "",
  nahbGroup: "all",
  nahbPhase: "all",
  csiDivision: "all",
  trade: "all",
  unit: "all",
  installation: "all",
};

export function buildStarterCatalogFacets(templates: readonly StarterCatalogTemplate[]) {
  const unique = (values: string[]) =>
    [...new Set(values.filter((value) => value.trim()))]
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return {
    nahbGroups: unique(templates.map((template) => template.nahbGroup)),
    nahbPhases: unique(templates.map((template) => template.nahbPhase ?? "")),
    csiDivisions: unique(templates.map((template) => template.csiDivision)),
    trades: unique(templates.map((template) => template.trade)),
    units: unique(templates.map((template) => template.unitOfMeasure)),
  };
}

export function isStarterCatalogInstalled(template: Pick<StarterCatalogTemplate, "code">, installedCodes: ReadonlySet<string>) {
  return installedCodes.has(template.code.trim().toUpperCase());
}

export function filterStarterCatalogTemplates(
  templates: readonly StarterCatalogTemplate[],
  filters: StarterCatalogFilters,
  installedCodes: ReadonlySet<string>,
): StarterCatalogTemplate[] {
  const text = filters.query.trim().toLocaleLowerCase();
  return templates.filter((template) => {
    if (filters.nahbGroup !== "all" && template.nahbGroup !== filters.nahbGroup) return false;
    if (filters.nahbPhase !== "all" && template.nahbPhase !== filters.nahbPhase) return false;
    if (filters.csiDivision !== "all" && template.csiDivision !== filters.csiDivision) return false;
    if (filters.trade !== "all" && template.trade !== filters.trade) return false;
    if (filters.unit !== "all" && template.unitOfMeasure !== filters.unit) return false;
    const installed = isStarterCatalogInstalled(template, installedCodes);
    if (filters.installation === "installed" && !installed) return false;
    if (filters.installation === "available" && installed) return false;
    if (!text) return true;
    return [
      template.name, template.code, template.description, template.trade,
      template.csiTitle, template.csiDivision, template.nahbGroup, template.nahbPhase ?? "",
      template.measurementBasis, template.unitOfMeasure,
    ].some((value) => value.toLocaleLowerCase().includes(text));
  });
}

/**
 * DEV-17 S9 (issue #518): bulk mapping reuse.
 *
 * A reuse suggestion carries the full Cost Item record fields the install UI
 * needs to build a CostItemCatalogRecord for the install compatibility
 * re-check. These shapes mirror the backend MappingReuseSuggestion /
 * MappingReuseResult contracts; the component maps the API payload onto
 * them unchanged.
 */
export type MappingReuseSuggestion = {
  componentKey: string;
  componentLabel: string;
  costItemId: string | null;
  costItemCode: string | null;
  costItemName: string | null;
  costItemUnitOfMeasure: string | null;
  costItemSubcategoryId: string | null;
  costItemProductionRate: number | null;
  costItemIsActive: boolean;
  orgId: string | null;
  laborRateId: string | null;
  materialId: string | null;
  equipmentId: string | null;
  subcontractorId: string | null;
  compatible: boolean;
  reasons: string[];
};

export type MappingReuseResult = {
  templateId: string;
  sourceAssemblyId: string;
  sourceAssemblyName: string;
  suggestions: MappingReuseSuggestion[];
  mappedCount: number;
  unmappedComponentKeys: string[];
};

/**
 * Merge reuse suggestions into the CURRENT mapping state (DEV-17 S9
 * CodeRabbit repair). Callers must pass the mappings as they stand when
 * the response is applied — not the copies captured when the request
 * started — so a slot the estimator mapped by hand while the request was
 * in flight is never overwritten.
 *
 * - Slots already mapped by hand are left alone.
 * - A suggestion whose Cost Item is already held by a retained manual
 *   mapping is skipped (and reported as still missing) instead of
 *   assigning the same item twice, which the install distinct-item check
 *   would reject.
 * - Slots with no suggested item are reported as still missing.
 */
export function mergeReuseMappingSuggestions(
  currentMappings: Readonly<Record<string, string>>,
  currentItems: Readonly<Record<string, CostItemCatalogRecord>>,
  suggestions: readonly MappingReuseSuggestion[],
): {
  mappings: Record<string, string>;
  items: Record<string, CostItemCatalogRecord>;
  applied: number;
  stillMissing: string[];
} {
  const usedIds = new Set(Object.values(currentMappings).filter(Boolean));
  const mappings: Record<string, string> = { ...currentMappings };
  const items: Record<string, CostItemCatalogRecord> = { ...currentItems };
  const stillMissing: string[] = [];
  let applied = 0;
  for (const suggestion of suggestions) {
    if (currentMappings[suggestion.componentKey]) continue;
    if (!suggestion.costItemId) {
      stillMissing.push(suggestion.componentLabel);
      continue;
    }
    if (usedIds.has(suggestion.costItemId)) {
      stillMissing.push(suggestion.componentLabel);
      continue;
    }
    usedIds.add(suggestion.costItemId);
    mappings[suggestion.componentKey] = suggestion.costItemId;
    items[suggestion.componentKey] = {
      id: suggestion.costItemId,
      orgId: suggestion.orgId,
      subcategoryId: suggestion.costItemSubcategoryId ?? "",
      code: suggestion.costItemCode ?? "",
      name: suggestion.costItemName ?? "",
      unitOfMeasure: suggestion.costItemUnitOfMeasure ?? "",
      productionRate: suggestion.costItemProductionRate,
      laborRateId: suggestion.laborRateId,
      materialId: suggestion.materialId,
      equipmentId: suggestion.equipmentId,
      subcontractorId: suggestion.subcontractorId,
      isActive: suggestion.costItemIsActive,
    };
    applied += 1;
  }
  return { mappings, items, applied, stillMissing };
}

export const REUSE_SOURCE_PAGE_LIMIT = 100;
export const MAX_CATALOG_PAGES = 50;

/**
 * Follow a cursor-paginated catalog listing until `nextCursor` is null
 * (DEV-17 S9 CodeRabbit repair: the reuse-source selector must see every
 * active template assembly, not just the first page). Items are deduped by
 * id, and the page count is capped so a misbehaving cursor cannot loop
 * forever.
 */
export async function collectPagedCatalogItems<T extends { id: string }>(
  fetchPage: (cursor: string | null) => Promise<{ items: readonly T[]; nextCursor: string | null }>,
  maxPages: number = MAX_CATALOG_PAGES,
): Promise<T[]> {
  const byId = new Map<string, T>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await fetchPage(cursor);
    for (const item of page.items) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
    cursor = page.nextCursor;
    pages += 1;
  } while (cursor !== null && pages < maxPages);
  return [...byId.values()];
}
