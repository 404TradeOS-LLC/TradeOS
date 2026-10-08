/**
 * Canonical material classification codes — universal product codes
 * (OmniClass Table 23, UNSPSC) keyed by the static corpus `canonicalKey`.
 *
 * Purpose: give every canonical material a durable, supplier-independent
 * identity so supplier SKUs can be matched by code instead of fuzzy product
 * names. Codes NARROW candidates; they never alone establish identity —
 * canonical identity, supplier SKU, unit compatibility, and relevant specs
 * must still verify, and ambiguous matches go to human review.
 *
 * Backfill policy (Billy, 2026-10-08):
 * - Populate verified codes family by family, highest-value first.
 * - NEVER invent a code to improve coverage.
 * - Track mapped / unmapped / ambiguous explicitly.
 * - Preserve source provenance; keep backfills deterministic.
 */
export type CanonicalClassificationStatus = "mapped" | "unmapped" | "ambiguous";

export interface CanonicalMaterialCodes {
  /** OmniClass Table 23 product code — construction-native canonical key. */
  omniclass23?: string;
  /** Human-readable OmniClass Table 23 title, for review surfaces. */
  omniclass23Title?: string;
  /** 8-digit UNSPSC commodity code — procurement-interop crosswalk. */
  unspsc?: string;
  /** Human-readable UNSPSC commodity title, for review surfaces. */
  unspscTitle?: string;
  status: CanonicalClassificationStatus;
  /** Where the code came from and when it was verified. */
  provenance?: string;
  /** Why this entry is ambiguous/unmapped, or what the code covers. */
  note?: string;
}

const UNSPSC_V8_PROVENANCE =
  "UNSPSC Codeset v8.1201 (GS1 US), verified 2026-10-08 against the published " +
  "codeset; re-verify against the current codeset on the next backfill pass.";

/**
 * Verified classifications, keyed by static-corpus canonicalKey.
 * Sparse by design: keys absent here are UNMAPPED (see
 * canonicalMaterialCodeCoverage). Only verified codes are recorded.
 */
export const CANONICAL_MATERIAL_CODES: Readonly<Record<string, CanonicalMaterialCodes>> = {
  // ---- Roofing: asphalt shingles → UNSPSC 30151508 "Shingles" ----
  "ROOFING-SHINGLE-ARCHITECTURAL": {
    unspsc: "30151508", unspscTitle: "Shingles", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151500 Roofing materials.",
  },
  "ROOFING-SHINGLE-3TAB": {
    unspsc: "30151508", unspscTitle: "Shingles", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151500 Roofing materials.",
  },
  "ROOFING-SHINGLE-CLASS4-IMPACT": {
    unspsc: "30151508", unspscTitle: "Shingles", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Impact-resistant architectural shingles are still shingles; Class 30151500.",
  },
  "ROOFING-SHINGLE-ARCHITECTURAL-UPGRADED": {
    unspsc: "30151508", unspscTitle: "Shingles", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151500 Roofing materials.",
  },
  "ROOFING-SHINGLE-DESIGNER-HEAVYWEIGHT": {
    unspsc: "30151508", unspscTitle: "Shingles", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151500 Roofing materials.",
  },
  "ROOFING-STARTER-SHINGLE": {
    unspsc: "30151508", unspscTitle: "Shingles", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Starter strips are shingle products; Class 30151500.",
  },
  // ---- Roofing: membranes → UNSPSC 30151505 "Roofing membranes" ----
  "ROOFING-ICE-WATER-MEMBRANE-HIGH-TEMP": {
    unspsc: "30151505", unspscTitle: "Roofing membranes", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Self-adhering ice & water shield is a roofing membrane; Class 30151500.",
  },
  "ROOFING-ICE-WATER-MEMBRANE-GRANULAR": {
    unspsc: "30151505", unspscTitle: "Roofing membranes", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Self-adhering ice & water shield is a roofing membrane; Class 30151500.",
  },
  // ---- Siding → UNSPSC 30151802 "Siding" ----
  "SIDING-VINYL-LAP-D4-TRADITIONAL": {
    unspsc: "30151802", unspscTitle: "Siding", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151800 Siding and exterior wall materials.",
  },
  "SIDING-VINYL-LAP-D45-DUTCHLAP": {
    unspsc: "30151802", unspscTitle: "Siding", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151800 Siding and exterior wall materials.",
  },
  "SIDING-FIBERCEMENT-LAP-8.25-CEDARMILL": {
    unspsc: "30151802", unspscTitle: "Siding", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fiber-cement lap siding; Class 30151800.",
  },
  // ---- Gutters / downspouts ----
  "GUTTER-KSTYLE-5IN-ALUM": {
    unspsc: "30151703", unspscTitle: "Gutters", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151700 Rain gutters and accessories.",
  },
  "GUTTER-KSTYLE-6IN-ALUM": {
    unspsc: "30151703", unspscTitle: "Gutters", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151700 Rain gutters and accessories.",
  },
  "DOWNSPOUT-2X3-ALUM": {
    unspsc: "30151701", unspscTitle: "Downspouts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151700 Rain gutters and accessories.",
  },
  "DOWNSPOUT-3X4-ALUM": {
    unspsc: "30151701", unspscTitle: "Downspouts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151700 Rain gutters and accessories.",
  },
  // ---- Roofing accessories ----
  "ROOF-VENT-SLANTED-BOX-LOUVER": {
    unspsc: "30151607", unspscTitle: "Roofing vents", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151600 Roofing accessories.",
  },
  "FASCIA-ALUM-6IN-RIBBED": {
    unspsc: "30151601", unspscTitle: "Roof fascias", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Class 30151600 Roofing accessories.",
  },
  // ---- Ambiguous: recorded, never silently merged ----
  "ROOFING-RIDGE-CAP": {
    status: "ambiguous",
    note: "Ridge cap straddles 30151508 (Shingles) and the 30151600 Roofing accessories class; needs spec review before a code is assigned.",
  },
  "ROOFING-RIDGE-CAP-HIGH-PROFILE": {
    status: "ambiguous",
    note: "Ridge cap straddles 30151508 (Shingles) and the 30151600 Roofing accessories class; needs spec review before a code is assigned.",
  },
  "ROOFING-UNDERLAYMENT-SYNTHETIC-PREMIUM": {
    status: "ambiguous",
    note: "Synthetic underlayment is neither felt (30151504 Roofing felts) nor clearly fabric (30151503 Roofing fabrics); needs current-codeset review.",
  },
  "ROOFING-UNDERLAYMENT-SYNTHETIC-STANDARD": {
    status: "ambiguous",
    note: "Synthetic underlayment is neither felt (30151504 Roofing felts) nor clearly fabric (30151503 Roofing fabrics); needs current-codeset review.",
  },
  "TRIM-COIL-ALUM-24INX50FT-PVC": {
    status: "ambiguous",
    note: "Trim coil straddles 30151902 (Exterior trim materials) and 30151602 (Flashings); needs spec review.",
  },
  "GUTTER-COIL-11.875IN-ALUM": {
    status: "ambiguous",
    note: "Coil stock for forming seamless gutters vs finished gutter 30151703; needs spec review.",
  },
  "SIDING-VINYL-JCHANNEL-0.75IN": {
    status: "ambiguous",
    note: "J-channel straddles 30151802 (Siding) and 30151902 (Exterior trim materials); needs spec review.",
  },
  "METAL-ROOF-PANEL-EXPOSED-29GA-36IN": {
    status: "unmapped",
    note: "No metal-panel commodity in the verified codeset extract (class 30151500 lists tiles/shakes/shingles/slate); needs current-codeset review.",
  },
};

export function codesForCanonicalKey(canonicalKey: string): CanonicalMaterialCodes | undefined {
  return CANONICAL_MATERIAL_CODES[canonicalKey];
}

export interface CanonicalCodeCoverage {
  mapped: number;
  ambiguous: number;
  unmapped: number;
  total: number;
}

/**
 * Coverage of the classification map against the full canonical-key list
 * (e.g. derived from the static corpus). Keys absent from the map — or
 * explicitly marked unmapped — count as unmapped.
 */
export function canonicalMaterialCodeCoverage(allCanonicalKeys: readonly string[]): CanonicalCodeCoverage {
  let mapped = 0;
  let ambiguous = 0;
  let unmapped = 0;
  for (const key of allCanonicalKeys) {
    const entry = CANONICAL_MATERIAL_CODES[key];
    if (!entry || entry.status === "unmapped") unmapped += 1;
    else if (entry.status === "ambiguous") ambiguous += 1;
    else mapped += 1;
  }
  return { mapped, ambiguous, unmapped, total: allCanonicalKeys.length };
}

/**
 * Deterministic backfill queue: canonical keys with no verified
 * classification yet, sorted for stable review order.
 */
export function unmappedCanonicalKeysForBackfill(allCanonicalKeys: readonly string[]): string[] {
  return [...new Set(allCanonicalKeys)]
    .filter((key) => {
      const entry = CANONICAL_MATERIAL_CODES[key];
      return !entry || entry.status === "unmapped";
    })
    .sort();
}

// ---------------------------------------------------------------------------
// Classification-assisted matching verdicts.
// ---------------------------------------------------------------------------

export type ClassificationMatchVerdict =
  | { kind: "code-confirmed"; canonicalKey: string }
  | { kind: "code-conflict"; canonicalKey: string; conflictingKey: string }
  | { kind: "code-ambiguous"; canonicalKey: string; note: string }
  | { kind: "code-unmapped"; canonicalKey: string };

function codesEqual(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a === b;
}

/**
 * Compare supplier-provided classification codes against the verified codes
 * for a candidate canonical material.
 *
 * - code-confirmed: supplier code equals the canonical material's verified code.
 * - code-conflict: supplier code equals a DIFFERENT canonical material's
 *   verified code — the listing is misattributed; must go to human review.
 * - code-ambiguous: the canonical material itself is ambiguously classified.
 * - code-unmapped: no verified codes on either side to compare — existing
 *   text-based behavior applies unchanged.
 */
export function classifySupplierCodes(
  supplierUnspsc: string | null | undefined,
  supplierOmniclass23: string | null | undefined,
  candidateCanonicalKey: string,
): ClassificationMatchVerdict {
  const entry = codesForCanonicalKey(candidateCanonicalKey);
  if (!entry || entry.status === "unmapped") {
    return { kind: "code-unmapped", canonicalKey: candidateCanonicalKey };
  }
  if (entry.status === "ambiguous") {
    return { kind: "code-ambiguous", canonicalKey: candidateCanonicalKey, note: entry.note ?? "Ambiguous classification." };
  }
  if (!entry.unspsc && !entry.omniclass23) {
    return { kind: "code-unmapped", canonicalKey: candidateCanonicalKey };
  }
  const supplied = [supplierUnspsc, supplierOmniclass23].filter(Boolean) as string[];
  if (supplied.length === 0) {
    return { kind: "code-unmapped", canonicalKey: candidateCanonicalKey };
  }
  const canonicalCodes = [entry.unspsc, entry.omniclass23].filter(Boolean) as string[];
  if (supplied.some((code) => canonicalCodes.some((c) => codesEqual(code, c)))) {
    return { kind: "code-confirmed", canonicalKey: candidateCanonicalKey };
  }
  // Supplier code matches a different canonical material's verified code.
  const conflicting = Object.entries(CANONICAL_MATERIAL_CODES).find(
    ([key, other]) =>
      key !== candidateCanonicalKey &&
      other.status === "mapped" &&
      supplied.some((code) => codesEqual(code, other.unspsc) || codesEqual(code, other.omniclass23)),
  );
  if (conflicting) {
    return { kind: "code-conflict", canonicalKey: candidateCanonicalKey, conflictingKey: conflicting[0] };
  }
  return { kind: "code-unmapped", canonicalKey: candidateCanonicalKey };
}
