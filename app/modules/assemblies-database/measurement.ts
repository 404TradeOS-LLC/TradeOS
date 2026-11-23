/**
 * Formal measurement contracts for the Assembly Catalog (issue #518, slice S8).
 *
 * Before this module, measurement lived only as free-text `measurementBasis`
 * strings, the five template output units (CY/EA/LF/SF/SQ), and the
 * `AssemblyCatalogCostItemKind` enum (which includes `allowance`). Nothing
 * stated which kind of quantity a unit measures, which conversions are exact,
 * or what "verified takeoff quantity" means when it is applied to an assembly.
 * This module is that contract. It is a pure library: no database, no HTTP,
 * no pricing engine. Pricing still resolves only through the canonical
 * Costbook service; nothing here embeds a price.
 *
 * Families
 * --------
 * The triage defines five takeoff families — area, linear, count, volume,
 * allowance. The catalog data proves two more families exist as component
 * rates and must be named rather than forced into the five:
 * - `mass` (TON, LB): bulk quantities priced by weight (disposal tonnage,
 *   aggregate, fasteners by weight). A takeoff never measures mass directly;
 *   mass appears only as a derived component quantity.
 * - `time` (HR, DAY): labor/equipment rates (95 research components are
 *   HR-denominated hours-per-output-unit, e.g. 0.024 HR/SF). A takeoff never
 *   measures time; time components are production rates, not measured work.
 * `TAKEOFF_FAMILIES` is the five-family subset a takeoff quantity may carry.
 * `familyForUnit` is total over the `AssemblyCatalogUnit` enum: every catalog
 * unit classifies into exactly one family, so an unclassifiable unit is a
 * data defect, not a silent default.
 *
 * Conversions
 * -----------
 * Exactly one conversion family is defined: area (SF/SQ/SY), because its
 * factors are exact and standard in residential estimating (1 SQ = 100 SF,
 * 1 SY = 9 SF). Volume, count, linear, mass, and time have NO cross-unit
 * conversion in this contract: converting CY to GAL, EA to BOX, or LF to BF
 * requires an explicit estimator-supplied factor, and a silent 1:1 substitute
 * is exactly what the adapter already forbids for alternate package units.
 * `deriveAssemblyQuantity` therefore returns a conversion only inside area;
 * every other unit must match the assembly output unit exactly.
 *
 * Takeoff derivation
 * ------------------
 * `deriveAssemblyQuantity` is the pure half of the S8 takeoff connection:
 * given an installed assembly's output unit and a takeoff quantity, it either
 * derives the assembly quantity or rejects with reasons. It enforces the
 * "verified" in "verified takeoff quantities": an unverified takeoff is
 * rejected, never applied. It does NOT persist anything and does NOT write
 * estimate lines — there is no takeoff record to read from yet (S065, the
 * quantity-takeoff MVP, is still PLANNED) and `EstimateLineItem` has no
 * takeoff fields (S4). The follow-up slice (S8b, gated on S065 + S4) wires
 * this derivation to persisted, versioned takeoff records and estimate lines;
 * this module gives that slice the contract to call.
 */
import {
  normalizeAssemblyCatalogUnit,
  type AssemblyCatalogUnit,
} from "./catalog";

export type MeasurementFamily =
  | "area"
  | "linear"
  | "count"
  | "volume"
  | "allowance"
  | "mass"
  | "time";

/** The five families a takeoff quantity may measure (issue #518 S8). */
export const TAKEOFF_FAMILIES: readonly MeasurementFamily[] = [
  "area",
  "linear",
  "count",
  "volume",
  "allowance",
];

/** The five units a catalog template may output. */
export type AssemblyOutputUnit = "CY" | "EA" | "LF" | "SF" | "SQ";

export const ASSEMBLY_OUTPUT_UNITS: readonly AssemblyOutputUnit[] = [
  "CY",
  "EA",
  "LF",
  "SF",
  "SQ",
];

/**
 * Classify a normalized catalog unit into its measurement family. Total over
 * the `AssemblyCatalogUnit` enum: every unit has exactly one family.
 * - area: square foot / roofing square / square yard (plan-measured surfaces)
 * - linear: linear foot (runs, lengths)
 * - count: discrete items (each, sets, kits, boxes, rolls, sheets, ...)
 * - volume: cubic yards, gallons, board feet (bulk volume)
 * - allowance: lump sum (a priced allowance, never a measured quantity)
 * - mass: tons / pounds (bulk quantities priced by weight, component-only)
 * - time: hours / days (labor and equipment production rates, component-only)
 */
export function familyForUnit(unit: AssemblyCatalogUnit): MeasurementFamily {
  switch (unit) {
    case "SF":
    case "SQ":
    case "SY":
      return "area";
    case "LF":
      return "linear";
    case "EA":
    case "SET":
    case "KIT":
    case "PAIR":
    case "BOX":
    case "BTL":
    case "CAN":
    case "ROLL":
    case "SHT":
    case "TUB":
    case "TUBE":
    case "BD":
    case "BAG":
      return "count";
    case "CY":
    case "GAL":
    case "BF":
      return "volume";
    case "TON":
    case "LB":
      return "mass";
    case "HR":
    case "DAY":
      return "time";
    case "LS":
      return "allowance";
  }
}

/** The measurement family a template output unit measures. Total over the five output units. */
export function familyForTemplateOutput(unit: AssemblyOutputUnit): MeasurementFamily {
  switch (unit) {
    case "CY":
      return "volume";
    case "EA":
      return "count";
    case "LF":
      return "linear";
    case "SF":
    case "SQ":
      return "area";
  }
}

/** Square feet in one unit of each area unit. The only conversion factors this contract defines. */
const SQUARE_FEET_PER_AREA_UNIT: Record<"SF" | "SQ" | "SY", number> = {
  SF: 1,
  SQ: 100,
  SY: 9,
};

export type AreaUnit = keyof typeof SQUARE_FEET_PER_AREA_UNIT;

export function isAreaUnit(unit: AssemblyCatalogUnit): unit is AreaUnit {
  return unit === "SF" || unit === "SQ" || unit === "SY";
}

/**
 * Convert a value between area units. Returns null for any pair outside
 * area — no other cross-unit conversion is defined by this contract.
 */
export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return (value * SQUARE_FEET_PER_AREA_UNIT[from]) / SQUARE_FEET_PER_AREA_UNIT[to];
}

/** Structural input for template assessment: any catalog template shape qualifies. */
export interface MeasurableComponent {
  key: string;
  quantityPerUnit: number;
  compatibleUnits: readonly string[];
  allowedCostItemKinds: readonly string[];
}

export interface MeasurableTemplate {
  id: string;
  unitOfMeasure: string;
  measurementBasis: string;
  components: readonly MeasurableComponent[];
}

export interface MeasurementContractAssessment {
  valid: boolean;
  /** The family the template output measures, or null when the output unit is not one of the five. */
  family: MeasurementFamily | null;
  /** Families present across the template's components, in first-seen order. */
  componentFamilies: MeasurementFamily[];
  reasons: string[];
}

/**
 * Validate a catalog template against the measurement contract. Rules:
 * 1. `measurementBasis` is a non-empty human-readable basis.
 * 2. The output unit is one of the five catalog output units.
 * 3. An SQ (roofing square) output states the 100-SF definition in its basis.
 * 4. At least one component, each with a finite positive quantity, a
 *    non-empty compatible-unit list whose first unit normalizes to a known
 *    catalog unit, and a non-empty allowed-kind list.
 * 5. An allowance component (kind `allowance`) is LS-denominated and exactly
 *    1 per assembly unit: a lump sum for one assembly unit, never a rate.
 * Time and mass components are valid — they are production rates and bulk
 * quantities — but they are never takeoff inputs (see `deriveAssemblyQuantity`).
 */
export function assessTemplateMeasurement(template: MeasurableTemplate): MeasurementContractAssessment {
  const reasons: string[] = [];
  const isOutputUnit = (ASSEMBLY_OUTPUT_UNITS as readonly string[]).includes(template.unitOfMeasure);
  const family: MeasurementFamily | null = isOutputUnit
    ? familyForTemplateOutput(template.unitOfMeasure as AssemblyOutputUnit)
    : null;

  if (!template.measurementBasis.trim()) {
    reasons.push("measurementBasis is empty; a template must state what its output unit measures");
  }
  if (!isOutputUnit) {
    reasons.push(`output unit "${template.unitOfMeasure}" is not a catalog measurement unit (CY, EA, LF, SF, SQ)`);
  }
  if (template.unitOfMeasure === "SQ" && !template.measurementBasis.includes("100")) {
    reasons.push("roofing-square (SQ) output must state the 100-SF definition in its measurementBasis");
  }
  if (template.components.length === 0) {
    reasons.push("template has no components; a measurable assembly needs at least one component");
  }

  const componentFamilies: MeasurementFamily[] = [];
  for (const component of template.components) {
    if (!Number.isFinite(component.quantityPerUnit) || component.quantityPerUnit <= 0) {
      reasons.push(`component "${component.key}" quantityPerUnit must be a finite positive number`);
    }
    if (component.compatibleUnits.length === 0) {
      reasons.push(`component "${component.key}" declares no compatible units`);
      continue;
    }
    const normalized = normalizeAssemblyCatalogUnit(component.compatibleUnits[0] ?? "");
    if (!normalized) {
      reasons.push(`component "${component.key}" first compatible unit "${component.compatibleUnits[0]}" is not a recognized catalog unit`);
      continue;
    }
    const componentFamily = familyForUnit(normalized);
    if (!componentFamilies.includes(componentFamily)) componentFamilies.push(componentFamily);
    if (component.allowedCostItemKinds.length === 0) {
      reasons.push(`component "${component.key}" declares no allowed Cost Item kinds`);
    }
    if (component.allowedCostItemKinds.includes("allowance")) {
      const normalizedUnits = component.compatibleUnits
        .map((unit) => normalizeAssemblyCatalogUnit(unit))
        .filter((unit): unit is AssemblyCatalogUnit => unit !== null);
      if (!normalizedUnits.includes("LS")) {
        reasons.push(`allowance component "${component.key}" must be lump-sum (LS) denominated`);
      }
      if (component.quantityPerUnit !== 1) {
        reasons.push(`allowance component "${component.key}" must be exactly 1 per assembly unit (lump sum), not ${component.quantityPerUnit}`);
      }
    }
  }

  return { valid: reasons.length === 0, family, componentFamilies, reasons };
}

export interface TakeoffQuantityInput {
  /** Measured value in `unit`. Must be finite and positive. */
  value: number;
  /** Raw unit string; normalized through the catalog alias table. */
  unit: string;
  /** Only estimator-verified takeoff quantities may be applied. */
  verified: boolean;
  verifiedBy?: string;
  /** Where the measurement came from (plan sheet, field measure, ...). Recorded by the caller, not validated here. */
  source?: string;
}

export interface TakeoffDerivation {
  /** Assembly quantity in the template's output unit, rounded to 4 decimals (Decimal(12,4)). */
  assemblyQuantity: number;
  assemblyUnit: AssemblyOutputUnit;
  takeoffFamily: MeasurementFamily;
  conversionApplied: { from: AssemblyCatalogUnit; to: AssemblyCatalogUnit; factor: number } | null;
}

export type TakeoffDerivationResult =
  | { ok: true; derivation: TakeoffDerivation }
  | { ok: false; reasons: string[] };

/**
 * Derive an installed assembly's quantity from a verified takeoff quantity.
 * Pure function: no persistence, no estimate write. The caller (S8b, once
 * S065 provides versioned takeoff records and S4 provides estimate-line
 * snapshot fields) is responsible for recording the derivation.
 *
 * Rejects, fail-closed:
 * - unverified takeoff quantities (verification is what makes a takeoff
 *   "verified"; an unverified measurement never becomes an assembly quantity);
 * - non-positive or non-finite values;
 * - units outside the catalog alias table;
 * - time and mass units: a takeoff measures area, linear, count, volume, or
 *   allowance — never hours, days, tons, or pounds;
 * - family mismatch: a takeoff may only be applied to an assembly whose
 *   output measures the same kind of quantity (area to area, linear to
 *   linear, ...). The only cross-unit application is inside area
 *   (SF/SQ/SY), where the conversion is exact; every other unit must match
 *   the assembly output unit exactly.
 */
export function deriveAssemblyQuantity(
  template: Pick<MeasurableTemplate, "id" | "unitOfMeasure">,
  takeoff: TakeoffQuantityInput,
): TakeoffDerivationResult {
  const reasons: string[] = [];
  if (!takeoff.verified) {
    reasons.push(`takeoff quantity for template "${template.id}" is not verified; only estimator-verified takeoff quantities may be applied to an installed assembly`);
  }
  if (!Number.isFinite(takeoff.value) || takeoff.value <= 0) {
    reasons.push("takeoff value must be a finite positive number");
  }
  const normalizedUnit = normalizeAssemblyCatalogUnit(takeoff.unit);
  if (!normalizedUnit) {
    reasons.push(`takeoff unit "${takeoff.unit}" is not a recognized catalog unit`);
  }
  if (reasons.length) return { ok: false, reasons };

  const takeoffFamily = familyForUnit(normalizedUnit as AssemblyCatalogUnit);
  if (!TAKEOFF_FAMILIES.includes(takeoffFamily)) {
    reasons.push(
      `takeoff unit "${takeoff.unit}" measures ${takeoffFamily}; takeoff quantities are area, linear, count, volume, or allowance only — time and mass are component rates, not takeoff inputs`,
    );
    return { ok: false, reasons };
  }

  const isOutputUnit = (ASSEMBLY_OUTPUT_UNITS as readonly string[]).includes(template.unitOfMeasure);
  if (!isOutputUnit) {
    reasons.push(`template "${template.id}" output unit "${template.unitOfMeasure}" is not a catalog measurement unit (CY, EA, LF, SF, SQ)`);
    return { ok: false, reasons };
  }
  const assemblyUnit = template.unitOfMeasure as AssemblyOutputUnit;
  const assemblyFamily = familyForTemplateOutput(assemblyUnit);
  if (takeoffFamily !== assemblyFamily) {
    reasons.push(
      `takeoff measures ${takeoffFamily} (${takeoff.unit}) but template "${template.id}" outputs ${assemblyUnit} (${assemblyFamily}); a takeoff may only be applied to an assembly whose output measures the same kind of quantity`,
    );
    return { ok: false, reasons };
  }

  let assemblyQuantity = takeoff.value;
  let conversionApplied: TakeoffDerivation["conversionApplied"] = null;
  if (normalizedUnit !== assemblyUnit) {
    // Family equality plus a unit difference is only possible inside area.
    if (isAreaUnit(normalizedUnit as AssemblyCatalogUnit) && isAreaUnit(assemblyUnit)) {
      const factor = SQUARE_FEET_PER_AREA_UNIT[normalizedUnit as AreaUnit] / SQUARE_FEET_PER_AREA_UNIT[assemblyUnit];
      assemblyQuantity = takeoff.value * factor;
      conversionApplied = { from: normalizedUnit as AssemblyCatalogUnit, to: assemblyUnit, factor };
    } else {
      reasons.push(
        `takeoff unit "${takeoff.unit}" and assembly output unit "${assemblyUnit}" measure the same family (${takeoffFamily}) but no conversion is defined between them; convert explicitly before applying`,
      );
      return { ok: false, reasons };
    }
  }

  // Quantities persist as Decimal(12,4) on AssemblyItem and EstimateLineItem.
  const rounded = Math.round(assemblyQuantity * 10000) / 10000;
  return {
    ok: true,
    derivation: { assemblyQuantity: rounded, assemblyUnit, takeoffFamily, conversionApplied },
  };
}
