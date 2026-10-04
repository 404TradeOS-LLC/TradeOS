export type CanonicalMatchAction = "AUTO_LINK" | "HUMAN_REVIEW" | "CREATE_NEW_CANDIDATE";

export interface CanonicalPilotItem {
  canonicalMaterialKey: string;
  displayName: string;
  normalizedUnit: string;
  materialFamily: string;
  requiredPatterns: readonly RegExp[];
  hardConflictPatterns?: readonly RegExp[];
}

export interface SupplierProductForMatching {
  name: string;
  description?: string | null;
  packageDescription?: string | null;
  purchaseUnit?: string | null;
  canonicalMaterialKey?: string | null;
  sku?: string | null;
  upcGtin?: string | null;
  manufacturer?: string | null;
  manufacturerPartNumber?: string | null;
}

export interface CanonicalMatchResult {
  action: CanonicalMatchAction;
  score: number;
  canonicalMaterialKey: string | null;
  displayName: string | null;
  rationale: string;
  normalizedText: string;
}

export const COSTBOOK_PILOT_CANONICAL_ITEMS: readonly CanonicalPilotItem[] = [
  {
    canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
    displayName: "2×4 × 8 ft SPF Stud",
    normalizedUnit: "EACH",
    materialFamily: "LUMBER",
    requiredPatterns: [/\b2x4\b/, /\b(8ft|96in)\b/, /\b(stud|lumber)\b/],
    hardConflictPatterns: [/\b2x6\b/, /\b10ft\b/, /\b12ft\b/],
  },
  {
    canonicalMaterialKey: "SHEATHING.OSB.7_16IN.4X8.SHEET",
    displayName: "7/16 in OSB 4×8 Sheet",
    normalizedUnit: "SHEET",
    materialFamily: "SHEATHING",
    requiredPatterns: [/\bosb\b/, /\b(7\/16|0\.4375)\b/, /\b4x8\b/],
  },
  {
    canonicalMaterialKey: "DRYWALL.REG.0_5IN.4X8.SHEET",
    displayName: "1/2 in Drywall 4×8 Sheet",
    normalizedUnit: "SHEET",
    materialFamily: "DRYWALL",
    requiredPatterns: [/\b(drywall|gypsum)\b/, /\b(1\/2|0\.5)\b/, /\b4x8\b/],
    hardConflictPatterns: [/\btypex\b/, /\b5\/8\b/, /\b0\.625\b/],
  },
  {
    canonicalMaterialKey: "DRYWALL.TYPE_X.0_625IN.4X8.SHEET",
    displayName: "5/8 in Type X Drywall 4×8 Sheet",
    normalizedUnit: "SHEET",
    materialFamily: "DRYWALL",
    requiredPatterns: [/\b(drywall|gypsum)\b/, /\b(5\/8|0\.625)\b/, /\btypex\b/],
  },
  {
    canonicalMaterialKey: "CONCRETE.MIX.80LB.BAG",
    displayName: "80 lb Concrete Mix",
    normalizedUnit: "BAG",
    materialFamily: "CONCRETE",
    requiredPatterns: [/\bconcrete\b/, /\b80lb\b/],
  },
  {
    canonicalMaterialKey: "ELECTRICAL.NMB.12_2.ROLL",
    displayName: "12/2 NM-B Cable",
    normalizedUnit: "ROLL",
    materialFamily: "ELECTRICAL",
    requiredPatterns: [/\b(12\/2|12-2)\b/, /\b(nmb|romex)\b/],
  },
  {
    canonicalMaterialKey: "PLUMBING.PEX.0_5IN.COIL",
    displayName: "1/2 in PEX",
    normalizedUnit: "COIL",
    materialFamily: "PLUMBING",
    requiredPatterns: [/\bpex\b/, /\b(1\/2|0\.5)\b/],
    hardConflictPatterns: [/\b(coupling|elbow|tee|fitting|valve)\b/],
  },
  {
    canonicalMaterialKey: "PLUMBING.PVC.DWV.3IN.STICK",
    displayName: "3 in PVC DWV",
    normalizedUnit: "STICK",
    materialFamily: "PLUMBING",
    requiredPatterns: [/\bpvc\b/, /\bdwv\b/, /\b3in\b/],
    hardConflictPatterns: [/\b(coupling|elbow|tee|fitting|wye|cap)\b/],
  },
  {
    canonicalMaterialKey: "INSULATION.FIBERGLASS.R13.BATT",
    displayName: "R-13 Fiberglass Insulation",
    normalizedUnit: "SQ_FT",
    materialFamily: "INSULATION",
    requiredPatterns: [/\binsulation\b/, /\br13\b/],
  },
  {
    canonicalMaterialKey: "ROOFING.SHINGLE.ARCHITECTURAL.BUNDLE",
    displayName: "Architectural Shingles",
    normalizedUnit: "BUNDLE",
    materialFamily: "ROOFING",
    requiredPatterns: [/\b(shingle|shingles)\b/, /\barchitectural\b/],
  },
  {
    canonicalMaterialKey: "PAINT.INTERIOR.WALL.GALLON",
    displayName: "Interior Wall Paint",
    normalizedUnit: "GALLON",
    materialFamily: "PAINT",
    requiredPatterns: [/\bpaint\b/, /\binterior\b/],
  },
  {
    canonicalMaterialKey: "ADHESIVE.CONSTRUCTION.TUBE",
    displayName: "Construction Adhesive",
    normalizedUnit: "TUBE",
    materialFamily: "ADHESIVE",
    requiredPatterns: [/\bconstruction\b/, /\badhesive\b/],
  },
] as const;

const unitAliases: Record<string, string> = {
  ea: "EACH",
  each: "EACH",
  sheet: "SHEET",
  bag: "BAG",
  box: "BOX",
  bundle: "BUNDLE",
  roll: "ROLL",
  gallon: "GALLON",
  gal: "GALLON",
  case: "CASE",
  pallet: "PALLET",
  tube: "TUBE",
  coil: "COIL",
  stick: "STICK",
  lf: "LINEAR_FT",
  "linear ft": "LINEAR_FT",
  sf: "SQ_FT",
  "sq ft": "SQ_FT",
  bf: "BOARD_FT",
};

export function normalizeCostbookUnit(value: string | null | undefined): string {
  if (!value?.trim()) return "UNKNOWN";
  const key = value.trim().toLowerCase().replace(/\./g, "");
  return unitAliases[key] ?? key.toUpperCase().replace(/[\s-]+/g, "_");
}

/**
 * Deterministic text normalization for the pilot matcher. It intentionally
 * favors false negatives over false positives: ambiguous listings go to human
 * review or become provisional candidates instead of being silently linked.
 */
export function normalizeSupplierProductText(input: SupplierProductForMatching): string {
  const raw = [
    input.name,
    input.description ?? "",
    input.packageDescription ?? "",
    input.purchaseUnit ?? "",
  ].join(" ").toLowerCase();

  return raw
    .replace(/type\s*[- ]?x/g, "typex")
    .replace(/nm\s*[- ]?b/g, "nmb")
    .replace(/r\s*[- ]?13/g, "r13")
    .replace(/(\d+)\s*(?:feet|foot|ft\.?|')\b/g, (_match, feet: string) => `${Number(feet)}ft`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")(?=\s|$)/g, (_match, inches: string) => `${Number(inches)}in`)
    .replace(/\b2\s*[x×]\s*4\b/g, "2x4")
    .replace(/\b2\s*[x×]\s*6\b/g, "2x6")
    .replace(/\b4\s*[x×]\s*8\b/g, "4x8")
    .replace(/\b80\s*[- ]?lb(?:s)?\b/g, "80lb")
    .replace(/\b3\s*[- ]?in\b/g, "3in")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchPilotCanonicalProduct(input: SupplierProductForMatching): CanonicalMatchResult {
  const normalizedText = normalizeSupplierProductText(input);
  const explicitKey = input.canonicalMaterialKey?.trim();

  if (explicitKey) {
    const exact = COSTBOOK_PILOT_CANONICAL_ITEMS.find((item) => item.canonicalMaterialKey === explicitKey);
    if (exact) {
      return {
        action: "AUTO_LINK",
        score: 1,
        canonicalMaterialKey: exact.canonicalMaterialKey,
        displayName: exact.displayName,
        rationale: "Existing canonical material key exactly matches the governed pilot catalog.",
        normalizedText,
      };
    }
  }

  const suppliedUnit = input.purchaseUnit?.trim()
    ? normalizeCostbookUnit(input.purchaseUnit)
    : null;

  const scored = COSTBOOK_PILOT_CANONICAL_ITEMS.map((item) => {
    if (item.hardConflictPatterns?.some((pattern) => pattern.test(normalizedText))) {
      return { item, score: 0, matched: 0, unitConflict: false };
    }
    const matched = item.requiredPatterns.filter((pattern) => pattern.test(normalizedText)).length;
    const unitConflict =
      suppliedUnit !== null &&
      suppliedUnit !== "UNKNOWN" &&
      suppliedUnit !== item.normalizedUnit;
    const baseScore = matched === item.requiredPatterns.length
      ? 1
      : matched >= 2 && matched === item.requiredPatterns.length - 1
        ? 0.90
        : matched / item.requiredPatterns.length * 0.80;
    const score = unitConflict ? Math.min(baseScore, 0.90) : baseScore;
    return { item, score, matched, unitConflict };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.88) {
    return {
      action: "CREATE_NEW_CANDIDATE",
      score: best?.score ?? 0,
      canonicalMaterialKey: null,
      displayName: null,
      rationale: "No pilot canonical item met the precision-first review threshold.",
      normalizedText,
    };
  }

  if (best.score >= 0.97) {
    return {
      action: "AUTO_LINK",
      score: best.score,
      canonicalMaterialKey: best.item.canonicalMaterialKey,
      displayName: best.item.displayName,
      rationale: "All governed identity attributes for the pilot item matched with no hard conflict.",
      normalizedText,
    };
  }

  return {
    action: "HUMAN_REVIEW",
    score: best.score,
    canonicalMaterialKey: best.item.canonicalMaterialKey,
    displayName: best.item.displayName,
    rationale: best.unitConflict
      ? `The listing matches identity text, but purchase unit ${suppliedUnit} conflicts with canonical unit ${best.item.normalizedUnit}; human review is required.`
      : "The listing is similar to a canonical pilot item but does not meet the auto-link precision gate.",
    normalizedText,
  };
}
