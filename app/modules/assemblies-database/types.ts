export interface CreateAssemblyInput {
  orgId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  description?: string | null;
  isTemplate?: boolean;
}

export type UpdateAssemblyInput = Partial<Omit<CreateAssemblyInput, "orgId">> & {
  isActive?: boolean;
} & AssemblyInstallOverrides;

export interface AssemblyInstallOverrides {
  wasteOverridePct?: number | null;
  productionRateFactor?: number | null;
}

export interface AddAssemblyItemInput {
  assemblyId: string;
  orgId: string;
  costItemId?: string;
  childAssemblyId?: string;
  quantityPerUnit: number;
  sortOrder?: number;
}

export interface AssemblyDTO {
  id: string;
  orgId: string | null;
  code: string;
  name: string;
  unitOfMeasure: string;
  description: string | null;
  isTemplate: boolean;
  isActive: boolean;
  installedRecipeId: string | null;
  installedRecipeVersion: number | null;
  installedAt: Date | null;
  currentRecipeVersion: number | null;
  updateAvailable: boolean;
  /** Absolute waste % override for this install (NULL = recipe/mapped-item defaults). */
  wasteOverridePct: number | null;
  /** Production-rate factor override for this install (NULL = recipe default, 1.0). */
  productionRateFactor: number | null;
}

export interface AssemblyItemDTO {
  id: string;
  assemblyId: string;
  costItemId: string | null;
  childAssemblyId: string | null;
  quantityPerUnit: number;
  sortOrder: number;
  componentType: "cost_item" | "assembly";
  componentCode: string;
  componentName: string;
  componentUnitOfMeasure: string;
}

export interface AssemblyUnitCostResult {
  unitCost: number;
  componentCount: number;
}

export interface InstallCatalogAssemblyInput {
  orgId: string;
  templateId: string;
  expectedRecipeVersion?: number;
  componentMappings: Array<{ componentKey: string; costItemId: string }>;
  /**
   * Optional install-time overrides (DEV-17 S10, issue #518). wasteOverridePct
   * is an absolute waste percentage (0-100) replacing each mapped Material's
   * own wasteFactorPct for this assembly's material legs. productionRateFactor
   * is a dimensionless multiplier on each mapped CostItem's productionRate for
   * this assembly's labor/equipment legs (1.0 = recipe default). Either may be
   * omitted (NULL = no override). No price is embedded: these are assumptions
   * applied at pricing time, and the stored item quantities stay the recipe's.
   */
  wasteOverridePct?: number;
  productionRateFactor?: number;
}

export interface SuggestCatalogMappingReuseInput {
  orgId: string;
  templateId: string;
  sourceAssemblyId: string;
}

export interface MappingReuseSuggestionDTO {
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
}

export interface MappingReuseResultDTO {
  templateId: string;
  sourceAssemblyId: string;
  sourceAssemblyName: string;
  suggestions: MappingReuseSuggestionDTO[];
  mappedCount: number;
  unmappedComponentKeys: string[];
}

export interface ConfirmRecipeUpgradeInput {
  reviewToken: string;
  componentMappings: InstallCatalogAssemblyInput["componentMappings"];
}
