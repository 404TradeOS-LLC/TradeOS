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
  // ---- Framing lumber: SPF dimension studs → UNSPSC 30103605 "Wood planks" ----
  // Deliberately limited to the governed, untreated SPF stud identities. Pressure-treated,
  // engineered, and ambiguous lumber stays unmapped until separately verified.
  "LUMBER-SPF-2X4-92_5_8-STUD": {
    unspsc: "30103605", unspscTitle: "Wood planks", status: "mapped",
    provenance: "UNSPSC v17.1001, State of North Carolina published detailed codeset, verified 2026-10-08 (30103605: Wood planks); re-verify against the current licensed codeset before broad backfill.",
    note: "Untreated SPF 2×4 framing stud; structural-products class 30103600.",
  },
  "LUMBER-SPF-2X4-104_5_8-STUD": {
    unspsc: "30103605", unspscTitle: "Wood planks", status: "mapped",
    provenance: "UNSPSC v17.1001, State of North Carolina published detailed codeset, verified 2026-10-08 (30103605: Wood planks); re-verify against the current licensed codeset before broad backfill.",
    note: "Untreated SPF 2×4 framing stud; structural-products class 30103600.",
  },
  "LUMBER-SPF-2X4-116_5_8-STUD": {
    unspsc: "30103605", unspscTitle: "Wood planks", status: "mapped",
    provenance: "UNSPSC v17.1001, State of North Carolina published detailed codeset, verified 2026-10-08 (30103605: Wood planks); re-verify against the current licensed codeset before broad backfill.",
    note: "Untreated SPF 2×4 framing stud; structural-products class 30103600.",
  },
  // ---- Framing lumber: backfilled 2026-10-08 from the research package ----
  "STUD-SPF-2X4-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Retail precut stud; nominal 8 ft label, actual 92-5/8 in. Class 30103600 Structural products.",
  },
  "STUD-SPF-2X6-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Retail precut stud; nominal 8 ft label, actual 92-5/8 in. Class 30103600 Structural products.",
  },
  "STUD-SPF-2X4-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Retail precut stud; nominal 10 ft label, actual 116-5/8 in. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X4-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X4-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X4-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X4-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X6-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X6-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X6-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X6-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X8-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X8-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X8-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X8-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X10-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X10-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X10-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X10-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X12-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X12-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X12-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SPF-2X12-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X4-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X4-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X4-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X4-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X6-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X6-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X6-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X6-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X8-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X8-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X8-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X8-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X10-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X10-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X10-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X10-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X12-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X12-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X12-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-SYP-2X12-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X4-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X4-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X4-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X4-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X6-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X6-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X6-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X6-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X8-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X8-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X8-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X8-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X10-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X10-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X10-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X10-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X12-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X12-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X12-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-DF-2X12-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X4-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X4-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X4-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X4-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X6-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X6-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X6-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X6-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103603 'Framing lumber'. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X8-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X8-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X8-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X8-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X10-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X10-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X10-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X10-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X12-8FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X12-10FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X12-12FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  "LUMBER-PT-SYP-2X12-16FT": {
    unspsc: "30103603", unspscTitle: "Framing lumber", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity recorded: UNSPSC also defines 30103607 'Wood joists'. Retail 2x8+ sold as generic dimensional framing maps to 30103603; pieces specified/sold as floor joists are a human-review case, never auto-merged. Class 30103600 Structural products.",
  },
  // ---- Engineered lumber: backfilled 2026-10-08 from the research package ----
  "BEAM-LVL-1_3_4X7_1_4-12FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X7_1_4-16FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X7_1_4-20FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X9_1_2-12FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X9_1_2-16FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "EXISTS in static corpus (supplierPrices47802.ts). Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X9_1_2-20FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "EXISTS in static corpus (supplierPrices47802.ts). Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X11_7_8-12FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X11_7_8-16FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "EXISTS in static corpus (supplierPrices47802.ts). Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X11_7_8-20FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "EXISTS in static corpus (supplierPrices47802.ts). Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X14-12FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X14-16FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-1_3_4X14-20FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30103602 'Wood composite beams'. Class 30103600 Structural products.",
  },
  "BEAM-LVL-3_1_2X9_1_2-16FT": {
    unspsc: "30103602", unspscTitle: "Wood composite beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Two-ply; verify whether sold as factory-laminated unit or two singles. Class 30103600 Structural products.",
  },
  "JOIST-I-9_1_2-12FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "JOIST-I-9_1_2-16FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "JOIST-I-11_7_8-12FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "JOIST-I-11_7_8-16FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "JOIST-I-14-12FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "JOIST-I-14-16FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "JOIST-I-16-16FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "JOIST-I-16-20FT": {
    unspsc: "30103607", unspscTitle: "Wood joists", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Series (e.g. TJI 210 vs 360) is a manufacturer attribute, not a separate code; never merge across series on price alone. Class 30103600 Structural products.",
  },
  "BEAM-GLULAM-3_1_8X9-16FT": {
    unspsc: "30103601", unspscTitle: "Wood beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Retail glulam is often special-order; verify stock vs special-order before treating as a live price. Class 30103600 Structural products.",
  },
  "BEAM-GLULAM-3_1_8X9-20FT": {
    unspsc: "30103601", unspscTitle: "Wood beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Retail glulam is often special-order; verify stock vs special-order before treating as a live price. Class 30103600 Structural products.",
  },
  "BEAM-GLULAM-3_1_8X12-20FT": {
    unspsc: "30103601", unspscTitle: "Wood beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Retail glulam is often special-order; verify stock vs special-order before treating as a live price. Class 30103600 Structural products.",
  },
  "BEAM-GLULAM-5_1_8X12-20FT": {
    unspsc: "30103601", unspscTitle: "Wood beams", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Retail glulam is often special-order; verify stock vs special-order before treating as a live price. Class 30103600 Structural products.",
  },
  "RIMBOARD-LSL-1_1_4X9_1_2-12FT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity: rim board is a composite panel product but functions as framing; 30103602 vs 30103603 is a human-review case.",
  },
  "RIMBOARD-LSL-1_1_4X11_7_8-12FT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Ambiguity: rim board is a composite panel product but functions as framing; 30103602 vs 30103603 is a human-review case.",
  },
  // ---- Fasteners: backfilled 2026-10-08 from the research package ----
  "ANCHOR-BOLT-GALV-1-2X10": {
    unspsc: "31161601", unspscTitle: "Anchor bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161601 'Anchor bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-BOLT-HDG-1_2X10-EA": {
    unspsc: "31161601", unspscTitle: "Anchor bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161601 'Anchor bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-CONCRETE-HAMMERDRIVE-5_8X4": {
    unspsc: "31162101", unspscTitle: "Concrete anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162101 'Concrete anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-CONCRETE-WEDGE-1_2X5_1_2": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-CONCRETE-WEDGE-1_2X5_1_2-10PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-CONCRETE-WEDGE-1_2X7-10PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-DRYWALL-EZANCOR-50PK": {
    unspsc: "31162103", unspscTitle: "Wall anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162103 'Wall anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-WEDGE-1_2X4-25PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BOLT-ANCHOR-FOUNDATION-1_2X10-5PK": {
    unspsc: "31161601", unspscTitle: "Anchor bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161601 'Anchor bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BOLT-CARRIAGE-GALV-1_2X8-10PK": {
    unspsc: "31161603", unspscTitle: "Carriage bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161603 'Carriage bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CLIP-ANCHOR-A35": {
    unspsc: "31162502", unspscTitle: "Angle brackets", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Framing angles/clips are angle brackets. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CONNECTOR-ANGLE-ADJUSTABLE-18GA": {
    unspsc: "31162502", unspscTitle: "Angle brackets", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Framing angles/clips are angle brackets. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CONNECTOR-FRAMING-ANGLE-A35": {
    unspsc: "31162502", unspscTitle: "Angle brackets", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Framing angles/clips are angle brackets. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-ANCHOR-DRYWALL-TOGGLE-25PK": {
    unspsc: "31162103", unspscTitle: "Wall anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162103 'Wall anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-ANCHOR-DRYWALL-ZINC-50PK": {
    unspsc: "31162103", unspscTitle: "Wall anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162103 'Wall anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-ANCHOR-WEDGE-CONC-1_2X4_25-25PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-ANCHOR-WEDGE-CONC-1_2X5_5-25PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-ANCHOR-WEDGE-CONC-3_8X3-25PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-BOLT-CARRIAGE-GALV-1_2X10-10PK": {
    unspsc: "31161603", unspscTitle: "Carriage bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161603 'Carriage bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-BOLT-CARRIAGE-GALV-1_2X8-10PK": {
    unspsc: "31161603", unspscTitle: "Carriage bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161603 'Carriage bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-BOLT-LAG-GALV-1_2X6-25PK": {
    unspsc: "31161608", unspscTitle: "Lag bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161608 'Lag bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-BOLT-LAG-GALV-1_2X8-25PK": {
    unspsc: "31161608", unspscTitle: "Lag bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161608 'Lag bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-BOLT-LAG-GALV-3_8X4-50PK": {
    unspsc: "31161608", unspscTitle: "Lag bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161608 'Lag bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-COLLATED-FRAMING-21DEG-3IN-4M": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-COLLATED-FRAMING-21DEG-3_1-4-4M": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-COLLATED-FRAMING-30DEG-3IN-2M": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-COLLATED-FRAMING-30DEG-3_1-4-2M": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-COLLATED-SIDING-15DEG-1_7-8-3_6M": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Collated siding nails are wire nails; collation is packaging. UNSPSC 31162006 Wire nails verified in Codeset v8.1201.",
  },
  "FAST-NAIL-FINISH-15GA-DA-2_1-2-4M": {
    unspsc: "31162003", unspscTitle: "Finishing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162003 'Finishing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-FINISH-16GA-2IN-2_5M": {
    unspsc: "31162003", unspscTitle: "Finishing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162003 'Finishing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-FINISH-16GA-2_1-2-2_5M": {
    unspsc: "31162003", unspscTitle: "Finishing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162003 'Finishing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-FRAMING-SINKER-16D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-FRAMING-SINKER-16D-5LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-FRAMING-SINKER-8D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-PLASTIC-CAP-1_1-4-3M": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No dedicated siding/cap-nail commodity; wire nails is the verified fit. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-ROOFING-COIL-1_1-4-7_2M": {
    unspsc: "31162005", unspscTitle: "Roofing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162005 'Roofing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-NAIL-SIDING-ALUM-1_1-4-1LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No dedicated siding/cap-nail commodity; wire nails is the verified fit. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-CABINET-WASHER-2_1-2-100PK": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DECK-COMPOSITE-2_1-2-350CT": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DECK-TORX-2_1-2-25LB": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DECK-TORX-2_1-2-5LB": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DECK-TORX-3IN-25LB": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DECK-TORX-3IN-5LB": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DECK-TORX-3_1-2-5LB": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DRYWALL-COARSE-1_1-4-1LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DRYWALL-COARSE-1_1-4-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DRYWALL-COARSE-1_5-8-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DRYWALL-COARSE-2IN-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-DRYWALL-FINE-1_1-4-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-HVAC-ZIP-HEX-1_2-100PK": {
    unspsc: "31161506", unspscTitle: "Sheet metal screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Zip screws are sheet-metal screws. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-SCREW-WOOD-CONSTR-T25-2_1-2-5LB": {
    unspsc: "31161508", unspscTitle: "Wood screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Deck/exterior screws are wood screws; coating is an attribute, not a code. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FAST-WASHER-FLAT-GALV-1_2-100PK": {
    unspsc: "31161807", unspscTitle: "Flat washers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161807 'Flat washers'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-ANCHOR-WEDGE-1_2X5_5-25PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-ANCHOR-WEDGE-1_2X7-25PK": {
    unspsc: "31162102", unspscTitle: "Wedge anchors", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162102 'Wedge anchors'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-BOLT-ANCHOR-FOUNDATION-1_2X10-50PK": {
    unspsc: "31161601", unspscTitle: "Anchor bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161601 'Anchor bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-BOLT-CARRIAGE-1_2X6-25PK": {
    unspsc: "31161603", unspscTitle: "Carriage bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161603 'Carriage bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-BOLT-CARRIAGE-1_2X8-25PK": {
    unspsc: "31161603", unspscTitle: "Carriage bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161603 'Carriage bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-BOLT-CARRIAGE-3_8X6-25PK": {
    unspsc: "31161603", unspscTitle: "Carriage bolts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31161603 'Carriage bolts'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-1_1_4-25LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-1_1_4-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-1_5_8-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-6X1_1_4-1LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-6X1_1_4-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-6X1_1_4-FINE-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-6X1_5_8-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-DRYWALL-SCREW-6X2-5LB": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-ELECTRICAL-STAPLES-ROMEX-100PK": {
    unspsc: "31162404", unspscTitle: "Hardware staples", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162404 'Hardware staples'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "FASTENER-SCREW-CEMENTBOARD-1_25-750CT": {
    unspsc: "31161509", unspscTitle: "Drywall screws", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Cementboard screws are drywall-type screws; no separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-BEAM-HU410-3_1_2": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-IJOIST-IUS11_88": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-IJOIST-IUS9_5": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-JOIST-LUS210-2X10": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-JOIST-LUS210_2-DBL2X10": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-JOIST-LUS26-2X6": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-JOIST-LUS26_2-DBL2X6": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-JOIST-LUS28-2X8": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "HANGER-JOIST-LUS28_2-DBL2X8": {
    unspsc: "31162306", unspscTitle: "Mounting hangers", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Joist/beam hangers. Vs 31162502 'Angle brackets': hangers are the verified fit for hanger-form connectors. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-COMMON-16D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-COMMON-8D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FINISH-16GA-2IN-2500CT": {
    unspsc: "31162003", unspscTitle: "Finishing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162003 'Finishing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FINISH-16GA-2_1_2-2500CT": {
    unspsc: "31162003", unspscTitle: "Finishing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162003 'Finishing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FINISH-16GA-2_5IN-2500CT": {
    unspsc: "31162003", unspscTitle: "Finishing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162003 'Finishing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FRAMING-21DEG-3IN-2500CT": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FRAMING-21DEG-3_1_4-2000CT": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FRAMING-21DEG-RING-2_3_8-2500CT": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FRAMING-COIL-15DEG-3IN-2700CT": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FRAMING-COLLATED-21DEG-3IN-2000CT": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FRAMING-COLLATED-21DEG-3_1_4-2000CT": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-FRAMING-COLLATED-21DEG-RING-2_3_8": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-HAND-COMMON-16D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-HAND-COMMON-8D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-JOIST-HANGER-1_1_2-1000CT": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-ROOFING-COIL-1_1_4-7200CT": {
    unspsc: "31162005", unspscTitle: "Roofing nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 31162005 'Roofing nails'. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-SINKER-16D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "NAIL-SINKER-8D-50LB": {
    unspsc: "31162006", unspscTitle: "Wire nails", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Common/sinker/collated framing nails are wire nails; collation is packaging, not a separate commodity. Fasteners; commodity verified in UNSPSC Codeset v8.1201.",
  },
  "ANCHOR-CONCRETE-SCREW-HEX-1_4X2_3_4-75PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry/concrete screws (Tapcon): 31161502 'Anchor screws' vs 31162101 'Concrete anchors'. Function is screw-anchor; human review.",
  },
  "ANCHOR-CONCRETE-SCREW-HEX-1_4X3_1_4-75PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry/concrete screws (Tapcon): 31161502 'Anchor screws' vs 31162101 'Concrete anchors'. Function is screw-anchor; human review.",
  },
  "ANCHOR-CONCRETE-SCREW-HEX-3_16X2_1_4-75PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry/concrete screws (Tapcon): 31161502 'Anchor screws' vs 31162101 'Concrete anchors'. Function is screw-anchor; human review.",
  },
  "ANCHOR-TAPCON-1_4X2_3_4-75PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry/concrete screws (Tapcon): 31161502 'Anchor screws' vs 31162101 'Concrete anchors'. Function is screw-anchor; human review.",
  },
  "CONNECTOR-HURRICANE-H2_5A": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Hurricane ties: 31162306 'Mounting hangers' vs 31162310 'Mounting straps' vs 31162502 'Angle brackets'. Tie form is strap-like; human review.",
  },
  "FAST-SCREW-CONC-TAPCON-1_4X2_1-4-75PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry/concrete screws (Tapcon): 31161502 'Anchor screws' vs 31162101 'Concrete anchors'. Function is screw-anchor; human review.",
  },
  "FAST-SCREW-CONC-TAPCON-3_16X1_3-4-75PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry/concrete screws (Tapcon): 31161502 'Anchor screws' vs 31162101 'Concrete anchors'. Function is screw-anchor; human review.",
  },
  "FAST-SCREW-STRUCT-HEADLOK-2_8IN-50PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Proprietary structural screws (HeadLok/LedgerLok/TimberLok); no dedicated commodity. Wood screws is the closest verified fit; engineering review for substitution.",
  },
  "FAST-SCREW-STRUCT-LEDGERLOK-3_6IN-50PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Proprietary structural screws (HeadLok/LedgerLok/TimberLok); no dedicated commodity. Wood screws is the closest verified fit; engineering review for substitution.",
  },
  "FAST-SCREW-STRUCT-LEDGERLOK-5IN-50PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Proprietary structural screws (HeadLok/LedgerLok/TimberLok); no dedicated commodity. Wood screws is the closest verified fit; engineering review for substitution.",
  },
  "FAST-SCREW-STRUCT-TIMBERLOK-4IN-50PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Proprietary structural screws (HeadLok/LedgerLok/TimberLok); no dedicated commodity. Wood screws is the closest verified fit; engineering review for substitution.",
  },
  "FAST-SCREW-STRUCT-TIMBERLOK-5IN-50PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Proprietary structural screws (HeadLok/LedgerLok/TimberLok); no dedicated commodity. Wood screws is the closest verified fit; engineering review for substitution.",
  },
  "FAST-SCREW-STRUCT-TIMBERLOK-6IN-50PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Proprietary structural screws (HeadLok/LedgerLok/TimberLok); no dedicated commodity. Wood screws is the closest verified fit; engineering review for substitution.",
  },
  "FAST-SCREW-STRUCT-TIMBERLOK-8IN-50PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Proprietary structural screws (HeadLok/LedgerLok/TimberLok); no dedicated commodity. Wood screws is the closest verified fit; engineering review for substitution.",
  },
  // ---- Concrete and masonry: backfilled 2026-10-08 from the research package ----
  "BLOCK-CMU-HOLLOW-12X8X16": {
    unspsc: "30131502", unspscTitle: "Concrete blocks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "CMU is concrete block; hollow/solid/partition/header are form variants. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BLOCK-CMU-HOLLOW-8X8X16": {
    unspsc: "30131502", unspscTitle: "Concrete blocks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "CMU is concrete block; hollow/solid/partition/header are form variants. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BLOCK-CMU-HOLLOW-HALF-8X8X8": {
    unspsc: "30131502", unspscTitle: "Concrete blocks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "CMU is concrete block; hollow/solid/partition/header are form variants. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BLOCK-CMU-HOLLOW-PARTITION-4X8X16": {
    unspsc: "30131502", unspscTitle: "Concrete blocks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "CMU is concrete block; hollow/solid/partition/header are form variants. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BLOCK-CMU-SOLID-4X8X16": {
    unspsc: "30131502", unspscTitle: "Concrete blocks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "CMU is concrete block; hollow/solid/partition/header are form variants. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BLOCK-CMU-SOLID-HEADER-8X8X16": {
    unspsc: "30131502", unspscTitle: "Concrete blocks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "CMU is concrete block; hollow/solid/partition/header are form variants. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-BUILDING-COMMON-RED": {
    unspsc: "30131602", unspscTitle: "Ceramic bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fired clay bricks are ceramic bricks. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-CLAY-COMMON-RED-MODULAR": {
    unspsc: "30131602", unspscTitle: "Ceramic bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fired clay bricks are ceramic bricks. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-CONCRETE-SPLITFACE-RED": {
    unspsc: "30131603", unspscTitle: "Concrete bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30131603 'Concrete bricks'. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-FACE-MODULAR-DARK-IRONSPOT": {
    unspsc: "30131602", unspscTitle: "Ceramic bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fired clay bricks are ceramic bricks. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-FACE-MODULAR-RED": {
    unspsc: "30131602", unspscTitle: "Ceramic bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fired clay bricks are ceramic bricks. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-FACE-MODULAR-WIRECUT": {
    unspsc: "30131602", unspscTitle: "Ceramic bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fired clay bricks are ceramic bricks. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-FACE-QUEEN-RED": {
    unspsc: "30131602", unspscTitle: "Ceramic bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fired clay bricks are ceramic bricks. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-FACE-UTILITY-RED": {
    unspsc: "30131602", unspscTitle: "Ceramic bricks", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Fired clay bricks are ceramic bricks. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-MASONRY-BRIXMENT-N-70LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry cement (Brixment etc.) is a cement blend; 30111601 is the verified fit. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-MASONRY-BRIXMENT-N-CHOCOLATE": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry cement (Brixment etc.) is a cement blend; 30111601 is the verified fit. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-MASONRY-BRIXMENT-S-75LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry cement (Brixment etc.) is a cement blend; 30111601 is the verified fit. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-MASONRY-FEDERAL-WHITE-N-70LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry cement (Brixment etc.) is a cement blend; 30111601 is the verified fit. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-MASONRY-LONESTAR-N-70LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry cement (Brixment etc.) is a cement blend; 30111601 is the verified fit. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-MASONRY-LONESTAR-S-75LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry cement (Brixment etc.) is a cement blend; 30111601 is the verified fit. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-PORTLAND-TYPE1-94LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30111601 'Cement'. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-PORTLAND-TYPE1_2-94LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30111601 'Cement'. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "CEMENT-PORTLAND-WHITE-92LB": {
    unspsc: "30111601", unspscTitle: "Cement", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30111601 'Cement'. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-MASON-MIX-80LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-SPECMIX-TYPEN-80LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-SPECMIX-TYPES-80LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-SPECMIX-VENEER-80LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-STONE-HOLD-TYPEN-75LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-THINSET-ULTRAFLEX1-50LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-THINSET-VERSABOND-GRAY-50LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-THINSET-VERSABOND-WHITE-50LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-TYPEN-80LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "MORTAR-TYPES-80LB": {
    unspsc: "30111504", unspscTitle: "Mortars", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Masonry, thinset, and veneer mortars are mortars. Commodity verified in UNSPSC Codeset v8.1201.",
  },
  "BRICK-FIRE-LARGE-STANDARD": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Refractory firebrick: ceramic is the closest verified fit but refractory is a specialty use; human review.",
  },
  "BRICK-FIRE-SMALL-SPLIT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Refractory firebrick: ceramic is the closest verified fit but refractory is a specialty use; human review.",
  },
  "BRICK-FIREBRICK-ARCH-WEDGE": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Refractory firebrick: ceramic is the closest verified fit but refractory is a specialty use; human review.",
  },
  "BRICK-FIREBRICK-SPLIT-1-1-4IN": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Refractory firebrick: ceramic is the closest verified fit but refractory is a specialty use; human review.",
  },
  "CONCRETE-MIX-4000PSI-60LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO dedicated bagged-concrete-mix commodity in v8.1201 (class 30111500 'Concrete and mortars' lists foamed/conductive/insulating concrete + mortars only). Left code-empty; class-level fit only.",
  },
  "CONCRETE-MIX-4000PSI-80LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO dedicated bagged-concrete-mix commodity in v8.1201 (class 30111500 'Concrete and mortars' lists foamed/conductive/insulating concrete + mortars only). Left code-empty; class-level fit only.",
  },
  "CONCRETE-MIX-5000PLUS-80LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO dedicated bagged-concrete-mix commodity in v8.1201 (class 30111500 'Concrete and mortars' lists foamed/conductive/insulating concrete + mortars only). Left code-empty; class-level fit only.",
  },
  "CONCRETE-MIX-60LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO dedicated bagged-concrete-mix commodity in v8.1201 (class 30111500 'Concrete and mortars' lists foamed/conductive/insulating concrete + mortars only). Left code-empty; class-level fit only.",
  },
  "CONCRETE-MIX-80LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO dedicated bagged-concrete-mix commodity in v8.1201 (class 30111500 'Concrete and mortars' lists foamed/conductive/insulating concrete + mortars only). Left code-empty; class-level fit only.",
  },
  "CONCRETE-MIX-BAGGED-80LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO dedicated bagged-concrete-mix commodity in v8.1201 (class 30111500 'Concrete and mortars' lists foamed/conductive/insulating concrete + mortars only). Left code-empty; class-level fit only.",
  },
  "CONCRETE-MIX-HIGHSTRENGTH-80LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO dedicated bagged-concrete-mix commodity in v8.1201 (class 30111500 'Concrete and mortars' lists foamed/conductive/insulating concrete + mortars only). Left code-empty; class-level fit only.",
  },
  "GROUT-NONSANDED-POLYBLEND-WHITE-10LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-NONSHRINK-1107-50LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-NONSHRINK-FASTSET-50LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-POLYBLEND-SANDED-25LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-POLYBLEND-UNSANDED-10LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-PRECISION-FASTSET-QUIKRETE-50LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-PRISM-GRAY-10LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-SANDED-KERACOLOR-25LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "GROUT-SANDED-POLYBLEND-WHITE-25LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No grout commodity in v8.1201; mortars (30111504) is the closest verified fit. Tile grout vs non-shrink structural grout are different uses — never merge on code.",
  },
  "MORTAR-REFRACTORY-FIREPLACE-50LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Refractory mortar: mortars is the closest verified fit; specialty use, human review.",
  },
  "MORTAR-REFRACTORY-HEATSTOP-15LB": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Refractory mortar: mortars is the closest verified fit; specialty use, human review.",
  },
  "PAVER-CLAY-BOWERSTON-105": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No paver commodity in v8.1201. Candidates: 30131602 'Ceramic bricks' vs 30131700 'Tiles and flagstones'. Human review; left code-empty.",
  },
  "PAVER-CLAY-BOWERSTON-115": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No paver commodity in v8.1201. Candidates: 30131602 'Ceramic bricks' vs 30131700 'Tiles and flagstones'. Human review; left code-empty.",
  },
  "PAVER-CLAY-BOWERSTON-505": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No paver commodity in v8.1201. Candidates: 30131602 'Ceramic bricks' vs 30131700 'Tiles and flagstones'. Human review; left code-empty.",
  },
  "PAVER-CONCRETE-MISSION1-BUFF": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No paver commodity in v8.1201. Candidates: 30131502 'Concrete blocks' vs 30131700 'Tiles and flagstones'. Human review; left code-empty.",
  },
  "PAVER-CONCRETE-MISSION1-CHARCOAL": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No paver commodity in v8.1201. Candidates: 30131502 'Concrete blocks' vs 30131700 'Tiles and flagstones'. Human review; left code-empty.",
  },
  "PAVER-CONCRETE-MISSION1-RED": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No paver commodity in v8.1201. Candidates: 30131502 'Concrete blocks' vs 30131700 'Tiles and flagstones'. Human review; left code-empty.",
  },
  "PAVER-CONCRETE-MISSION1-REDWOOD": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "No paver commodity in v8.1201. Candidates: 30131502 'Concrete blocks' vs 30131700 'Tiles and flagstones'. Human review; left code-empty.",
  },
  // ---- Insulation and weather barriers: backfilled 2026-10-08 from the research package ----
  "INSUL-BATT-R11-UNFACED-15IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R13-15X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R13-15X93-UNFACED": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R13-23X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R13-KRAFT-15IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R13-UNFACED-15IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R15-15X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R15-KRAFT-15IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R15-KRAFT-23IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R19-15X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R19-23X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R19-KRAFT-15IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R19-KRAFT-23IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R21-KRAFT-15IN-93IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R30-16X48-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R30-KRAFT-16IN-48IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R30-UNFACED-24IN-48IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R38-16X48-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R38-KRAFT-16IN-48IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BATT-R38-UNFACED-24IN-48IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BLOWIN-FIBERGLASS-ATTICAT-BAG": {
    unspsc: "30141506", unspscTitle: "Loose fill insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30141506 'Loose fill insulation'. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BLOWN-CELLULOSE-25LB": {
    unspsc: "30141506", unspscTitle: "Loose fill insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "UNSPSC 30141506 'Loose fill insulation'. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FIBERGLASS-BATT-R30-16OC-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FIBERGLASS-BATT-R38-16OC-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FOAM-GUN-GREATSTUFF-PRO-24OZ": {
    unspsc: "30141503", unspscTitle: "Foam insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Gun-applied expanding insulating foam sealant; UNSPSC 30141503 Foam insulation.",
  },
  "INSUL-FOAM-POLYISO-1IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FOAM-POLYISO-1_2IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FOAM-RIGID-XPS-2IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FOAM-XPS-1IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FOAM-XPS-1_2IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FOAM-XPS-1_5IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-FOAM-XPS-2IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-MINERAL-WOOL-ROCKWOOL-15IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Mineral wool batts are batts; material is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-POLYISO-RMAX-1IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-POLYISO-RMAX-1_2-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-POLYISO-RMAX-2IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-ROCKWOOL-COMFORTBATT-R15-16OC": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Mineral wool batts are batts; material is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-ROCKWOOL-SAFENSOOUND-16OC": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Mineral wool batts are batts; material is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-ROLL-R13-15X32-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-ROLL-R13-KRAFT-15IN-32FT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-XPS-FOAMULAR-1IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-XPS-FOAMULAR-1_2-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-XPS-FOAMULAR-1_5IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-XPS-FOAMULAR-2IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-FIBERGLASS-R13-15IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-FIBERGLASS-R19-15IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-FIBERGLASS-R30-15IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-FIBERGLASS-R38-15IN": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R13-15X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R13-15X93-UNFACED": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R15-15X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R19-15X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R19-23X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R21-15X93-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R30-15X48-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R30-24X48-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BATT-R38-24X48-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-BLOCKFILL-PERLITE-24LB": {
    unspsc: "30141506", unspscTitle: "Loose fill insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Poured block-fill (perlite) is loose-fill by application. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-FOAMBOARD-EPS-1IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-FOAMBOARD-POLYISO-1IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-FOAMBOARD-XPS-1IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-FOAMBOARD-XPS-1_2-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-FOAMBOARD-XPS-1_5-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-FOAMBOARD-XPS-2IN-4X8": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-POLYISO-1.5IN-R9": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-POLYISO-1IN-R6": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-POLYISO-2IN-R13": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-XPS-1.5IN-R7.5": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-XPS-1IN-R5": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-XPS-1IN-R5-TG": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-XPS-2IN-R10": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-RIGID-XPS-2IN-R10-TG": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-ROLL-R13-15X32-KRAFT": {
    unspsc: "30141504", unspscTitle: "Insulation batts", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Batt/roll form. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-ROOF-COVERBOARD-HD-0.5IN": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Commercial roofing application; same commodity. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-ROOF-POLYISO-FLAT-1.5IN": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Commercial roofing application; same commodity. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-ROOF-POLYISO-FLAT-2IN": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Commercial roofing application; same commodity. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-ROOF-POLYISO-TAPERED-4X4": {
    unspsc: "30141507", unspscTitle: "Rigid board insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Rigid board form; XPS/polyiso/EPS are material attributes. Commercial roofing application; same commodity. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-SPRAYFOAM-BIGGAP-12OZ": {
    unspsc: "30141503", unspscTitle: "Foam insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "One-component sealant cans and two-part kits are both foam insulation; professional vs DIY is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-SPRAYFOAM-FIREBLOCK-12OZ": {
    unspsc: "30141503", unspscTitle: "Foam insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "One-component sealant cans and two-part kits are both foam insulation; professional vs DIY is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-SPRAYFOAM-FROTHPAK-200": {
    unspsc: "30141503", unspscTitle: "Foam insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "One-component sealant cans and two-part kits are both foam insulation; professional vs DIY is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-SPRAYFOAM-GAPS-12OZ": {
    unspsc: "30141503", unspscTitle: "Foam insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "One-component sealant cans and two-part kits are both foam insulation; professional vs DIY is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-SPRAYFOAM-GAPS-16OZ": {
    unspsc: "30141503", unspscTitle: "Foam insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "One-component sealant cans and two-part kits are both foam insulation; professional vs DIY is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSULATION-SPRAYFOAM-WINDOOR-12OZ": {
    unspsc: "30141503", unspscTitle: "Foam insulation", status: "mapped",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "One-component sealant cans and two-part kits are both foam insulation; professional vs DIY is an attribute. Class 30141500 Thermal insulation; WRB rows stay ambiguous (no WRB commodity).",
  },
  "INSUL-BAFFLE-ATTIC-VENT-24X48-10PK": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Attic ventilation baffle, not insulation; no verified commodity in this pass.",
  },
  "TAPE-FLASH-TYVEK-4IN-75FT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "TAPE-FLASH-TYVEK-FLEXWRAP-6IN-75FT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "TAPE-FLASH-TYVEK-FLEXWRAP-9IN-75FT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "TAPE-FLASHING-SELFADHERING-4X75": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "TAPE-FLASHING-SELFADHERING-6X75": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "TAPE-SEAM-REX-3IN-165FT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "TAPE-SEAM-TYVEK-1_88X164": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "TAPE-SEAM-TYVEK-2IN-55M": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "WEATHER-BARRIER-TYVEK-9X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WEATHER-BARRIER-TYVEK-9X150": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WEATHER-HOUSEWRAP-TYVEK-3X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WEATHER-HOUSEWRAP-TYVEK-9X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WEATHER-HOUSEWRAP-TYVEK-9X150": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WEATHER-POLY-6MIL-10X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Poly sheeting vapor barrier: no verified commodity; left code-empty.",
  },
  "WEATHER-POLY-6MIL-20X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Poly sheeting vapor barrier: no verified commodity; left code-empty.",
  },
  "WEATHER-SILLSEAL-5_5X50": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Sill-plate foam gasket; no verified commodity in this pass.",
  },
  "WEATHER-TAPE-FLASHING-TYVEK-4IN-75FT": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "WEATHER-TAPE-TYVEK-1_88X164": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "Flashing/seam tape: WRB-system accessory; no verified commodity in this pass (tapes belong to a future sealants/adhesives pass).",
  },
  "WRAP-HOUSE-REX-WRAP-10X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-REX-WRAP-3X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-REX-WRAP-9X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-REX-WRAP-9X150": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-TYVEK-COMMERCIAL-10X125": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-TYVEK-DRAINWRAP-9X125": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-TYVEK-HOMELAP-3X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-TYVEK-HOMELAP-9X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRAP-HOUSE-TYVEK-HOMEWRAP-10X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRB-HOUSEWRAP-COMMERCIAL-5X200": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRB-HOUSEWRAP-DRAINAGE-STUCCO-5X200": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRB-HOUSEWRAP-REFLECTIVE-5X150": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRB-HOUSEWRAP-STANDARD-9X100": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
  },
  "WRB-HOUSEWRAP-STANDARD-9X150": {
    status: "ambiguous",
    provenance: UNSPSC_V8_PROVENANCE,
    note: "NO housewrap/weather-barrier commodity in v8.1201. WRB is not thermal insulation; left code-empty. Material and roll size are the identity attributes.",
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
