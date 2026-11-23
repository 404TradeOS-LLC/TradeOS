import {
  assessCatalogComponentMapping,
  type AssemblyCatalogComponent,
  type CatalogMappingCandidate,
} from "./catalog";

/**
 * DEV-17 S9 (issue #518): bulk mapping/reuse for the starter catalog.
 *
 * An estimator who has already installed a related recipe can reuse that
 * install's mapping for another template instead of mapping every slot by
 * hand: the source assembly's Cost Items are bulk-applied to the target
 * template's slots, with the SAME per-slot compatibility check the install
 * path enforces (`assessCatalogComponentMapping` — unit + cost-item kind).
 *
 * This module is pure (no DB, no I/O) so the reuse rule is unit-testable
 * without a database. Deterministic: candidates are tried in source-item
 * order and the first compatible, not-yet-used candidate wins a slot.
 * Distinctness mirrors the install rule ("Each Cost Item may be mapped to
 * only one recipe slot"): a Cost Item reused for one slot is never
 * suggested for a second slot of the same target recipe.
 *
 * Suggestions never install anything. The estimator reviews them and
 * installs through the unchanged `installStarterCatalogAssembly` path,
 * which re-validates every mapping — a stale or edited suggestion cannot
 * bypass the install checks.
 */
export interface MappingReuseCandidate extends CatalogMappingCandidate {
  id: string;
  code: string;
  name: string;
  subcategoryId: string;
  productionRate: number | null;
  isActive: boolean;
}

export interface MappingReuseSuggestion {
  componentKey: string;
  componentLabel: string;
  costItemId: string | null;
  costItemCode: string | null;
  costItemName: string | null;
  costItemUnitOfMeasure: string | null;
  costItemSubcategoryId: string | null;
  costItemProductionRate: number | null;
  costItemIsActive: boolean;
  // The org is filled in by the service (the caller’s org) so the UI can
  // build a full CostItemCatalogRecord for the install compatibility
  // re-check; this pure suggester is org-agnostic.
  orgId: string | null;
  laborRateId: string | null;
  materialId: string | null;
  equipmentId: string | null;
  subcontractorId: string | null;
  compatible: boolean;
  reasons: string[];
}

export interface MappingReuseResult {
  templateId: string;
  sourceAssemblyId: string;
  sourceAssemblyName: string;
  suggestions: MappingReuseSuggestion[];
  mappedCount: number;
  unmappedComponentKeys: string[];
}

export function suggestBulkMapping(
  template: { id: string; components: readonly AssemblyCatalogComponent[] },
  sourceAssembly: { id: string; name: string },
  candidates: readonly MappingReuseCandidate[],
): MappingReuseResult {
  const usedBy = new Map<string, string>();
  const suggestions: MappingReuseSuggestion[] = template.components.map((component) => {
    let alreadyUsed: MappingReuseCandidate | null = null;
    for (const candidate of candidates) {
      // Compatibility first: a candidate already used for an earlier slot
      // only counts as a duplicate conflict when it could fill THIS slot.
      // Otherwise an incompatible used item (e.g. a CY material against an
      // HR labor slot) would misreport a duplicate conflict for a slot it
      // can never fill.
      const assessment = assessCatalogComponentMapping(component, candidate);
      if (!assessment.compatible) continue;
      if (usedBy.has(candidate.id)) {
        alreadyUsed ??= candidate;
        continue;
      }
      usedBy.set(candidate.id, component.label);
      return {
        componentKey: component.key,
        componentLabel: component.label,
        costItemId: candidate.id,
        costItemCode: candidate.code,
        costItemName: candidate.name,
        costItemUnitOfMeasure: candidate.unitOfMeasure,
        costItemSubcategoryId: candidate.subcategoryId,
        costItemProductionRate: candidate.productionRate,
        costItemIsActive: candidate.isActive,
        orgId: null,
        laborRateId: candidate.laborRateId,
        materialId: candidate.materialId,
        equipmentId: candidate.equipmentId,
        subcontractorId: candidate.subcontractorId,
        compatible: true,
        reasons: [],
      };
    }
    return {
      componentKey: component.key,
      componentLabel: component.label,
      costItemId: null,
      costItemCode: null,
      costItemName: null,
      costItemUnitOfMeasure: null,
      costItemSubcategoryId: null,
      costItemProductionRate: null,
      costItemIsActive: false,
      orgId: null,
      laborRateId: null,
      materialId: null,
      equipmentId: null,
      subcontractorId: null,
      compatible: false,
      reasons: alreadyUsed
        ? [`${alreadyUsed.code} is already mapped to ${usedBy.get(alreadyUsed.id)} in this recipe`]
        : ["No compatible Cost Item in the reused mapping for this slot"],
    };
  });

  return {
    templateId: template.id,
    sourceAssemblyId: sourceAssembly.id,
    sourceAssemblyName: sourceAssembly.name,
    suggestions,
    mappedCount: suggestions.filter((suggestion) => suggestion.costItemId !== null).length,
    unmappedComponentKeys: suggestions.filter((suggestion) => suggestion.costItemId === null).map((suggestion) => suggestion.componentKey),
  };
}
