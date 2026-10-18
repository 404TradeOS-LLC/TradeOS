import {
  CANONICAL_MATERIAL_CODES,
  canonicalMaterialCodeCoverage,
  classifySupplierCodes,
  codesForCanonicalKey,
  unmappedCanonicalKeysForBackfill,
} from "../modules/costbook/canonicalMaterialCodes";
import { SUPPLIER_PRICES_47802 } from "../modules/costbook/supplierPrices47802";
import { matchPilotCanonicalProduct } from "../modules/costbook/canonicalProductMatcher";

const corpusKeys = [...new Set(SUPPLIER_PRICES_47802.map((row) => row.canonicalKey))];

describe("Canonical material classification codes", () => {
  it("records only verified codes in valid formats", () => {
    for (const entry of Object.values(CANONICAL_MATERIAL_CODES)) {
      expect(["mapped", "ambiguous", "unmapped"]).toContain(entry.status);
      if (entry.unspsc) expect(entry.unspsc).toMatch(/^\d{8}$/);
      if (entry.status === "mapped") {
        expect(entry.unspsc ?? entry.omniclass23).toBeTruthy();
        expect(entry.provenance).toBeTruthy();
      }
    }
  });

  it("maps the first verified roofing/exterior batch to real UNSPSC commodities", () => {
    expect(codesForCanonicalKey("ROOFING-SHINGLE-ARCHITECTURAL")).toMatchObject({
      unspsc: "30151508",
      unspscTitle: "Shingles",
      status: "mapped",
    });
    expect(codesForCanonicalKey("ROOFING-ICE-WATER-MEMBRANE-GRANULAR")).toMatchObject({
      unspsc: "30151505",
      status: "mapped",
    });
    expect(codesForCanonicalKey("SIDING-VINYL-LAP-D4-TRADITIONAL")).toMatchObject({
      unspsc: "30151802",
      status: "mapped",
    });
    expect(codesForCanonicalKey("GUTTER-KSTYLE-5IN-ALUM")).toMatchObject({
      unspsc: "30151703",
      status: "mapped",
    });
    expect(codesForCanonicalKey("DOWNSPOUT-2X3-ALUM")).toMatchObject({
      unspsc: "30151701",
      status: "mapped",
    });
  });

  it("maps only the verified untreated SPF framing-stud slice", () => {
    for (const key of [
      "LUMBER-SPF-2X4-92_5_8-STUD",
      "LUMBER-SPF-2X4-104_5_8-STUD",
      "LUMBER-SPF-2X4-116_5_8-STUD",
    ]) {
      expect(codesForCanonicalKey(key)).toMatchObject({
        unspsc: "30103605",
        unspscTitle: "Wood planks",
        status: "mapped",
      });
    }
    // A legacy key with no verified classification stays nullable/unmapped.
    expect(codesForCanonicalKey("LUMBER-SYP-2X4-96IN-PT")).toBeUndefined();
    expect(classifySupplierCodes("30103605", undefined, "LUMBER-SYP-2X4-96IN-PT")).toMatchObject({
      kind: "code-unmapped",
    });
  });

  it("flags ambiguous classifications instead of silently merging them", () => {
    for (const key of [
      "ROOFING-RIDGE-CAP",
      "ROOFING-UNDERLAYMENT-SYNTHETIC-PREMIUM",
      "TRIM-COIL-ALUM-24INX50FT-PVC",
      "SIDING-VINYL-JCHANNEL-0.75IN",
    ]) {
      const entry = codesForCanonicalKey(key);
      expect(entry?.status).toBe("ambiguous");
      expect(entry?.unspsc).toBeUndefined();
      expect(entry?.note).toBeTruthy();
    }
  });

  it("assigns class-level 31371100 to firebrick keys, keeping ambiguous status (M7#27)", () => {
    for (const key of [
      "BRICK-FIRE-LARGE-STANDARD",
      "BRICK-FIRE-SMALL-SPLIT",
      "BRICK-FIREBRICK-ARCH-WEDGE",
      "BRICK-FIREBRICK-SPLIT-1-1-4IN",
    ]) {
      expect(codesForCanonicalKey(key)).toMatchObject({
        unspsc: "31371100",
        unspscTitle: "Refractory bricks",
        status: "ambiguous",
      });
    }
  });

  it("maps the plastic-cap key to 31162002 after the M10#42 correction", () => {
    expect(codesForCanonicalKey("FAST-NAIL-PLASTIC-CAP-1_1-4-3M")).toMatchObject({
      unspsc: "31162002",
      unspscTitle: "Cap nails",
      status: "mapped",
    });
  });

  it("keeps aluminum siding nails at 31162006 Wire nails (not cap nails)", () => {
    expect(codesForCanonicalKey("FAST-NAIL-SIDING-ALUM-1_1-4-1LB")).toMatchObject({
      unspsc: "31162006",
      unspscTitle: "Wire nails",
      status: "mapped",
    });
  });

  it("maps Tapcon keys to 31162104 Screw anchors (M10#39)", () => {
    for (const key of [
      "ANCHOR-CONCRETE-SCREW-HEX-1_4X2_3_4-75PK",
      "ANCHOR-CONCRETE-SCREW-HEX-1_4X3_1_4-75PK",
      "ANCHOR-CONCRETE-SCREW-HEX-3_16X2_1_4-75PK",
      "ANCHOR-TAPCON-1_4X2_3_4-75PK",
      "FAST-SCREW-CONC-TAPCON-1_4X2_1-4-75PK",
      "FAST-SCREW-CONC-TAPCON-3_16X1_3-4-75PK",
      "SCREW-CONCRETE-TAPCON-1_4X1_75-100PK",
      "SCREW-CONCRETE-TAPCON-1_4X2_25-100PK",
      "SCREW-CONCRETE-TAPCON-3_16X1_75-100PK",
    ]) {
      expect(codesForCanonicalKey(key)).toMatchObject({
        unspsc: "31162104",
        unspscTitle: "Screw anchors",
        status: "mapped",
      });
    }
  });

  it("maps grout keys to 30111606 after the M7#26 correction", () => {
    for (const key of [
      "GROUT-NONSANDED-POLYBLEND-WHITE-10LB",
      "GROUT-NONSHRINK-1107-50LB",
      "GROUT-NONSHRINK-FASTSET-50LB",
      "GROUT-POLYBLEND-SANDED-25LB",
      "GROUT-POLYBLEND-UNSANDED-10LB",
      "GROUT-PRECISION-FASTSET-QUIKRETE-50LB",
      "GROUT-PRISM-GRAY-10LB",
      "GROUT-SANDED-KERACOLOR-25LB",
      "GROUT-SANDED-POLYBLEND-WHITE-25LB",
    ]) {
      expect(codesForCanonicalKey(key)).toMatchObject({
        unspsc: "30111606",
        unspscTitle: "Grout",
        status: "mapped",
      });
    }
  });

  it("tracks coverage against the full corpus key list", () => {
    const coverage = canonicalMaterialCodeCoverage(corpusKeys);
    expect(coverage.total).toBe(corpusKeys.length);
    expect(coverage.mapped + coverage.ambiguous + coverage.unmapped).toBe(coverage.total);
    // The backfill added 397 rows to the map; 74 greenfield keys (framing/engineered)
    // are not in the static corpus yet, so 267 count against corpus coverage.
    expect(Object.keys(CANONICAL_MATERIAL_CODES).length).toBeGreaterThanOrEqual(425);
    expect(coverage.mapped).toBeGreaterThanOrEqual(267);
    // 267 mapped in-corpus = 20 from the PR #694 seed batch + 247 from the backfill.
    expect(coverage.ambiguous).toBeGreaterThanOrEqual(68);
    // 68 ambiguous in-corpus = 7 from the seed batch + 61 from the backfill (recorded, never merged).
    // (Was 83 before the 2026-10-18 grout correction moved 9 GROUT-* keys and the
    // Tapcon correction moved 6 keys to mapped.)
    // First batch is roofing/exterior only — the vast majority stays unmapped.
    // The five-family backfill (397 keys) dropped unmapped coverage below 95%;
    // the bulk of the corpus is still unclassified and awaits the next family wave.
    expect(coverage.unmapped).toBeGreaterThan(coverage.total * 0.8);
  });

  it("produces a deterministic, deduplicated backfill queue", () => {
    const first = unmappedCanonicalKeysForBackfill(corpusKeys);
    const second = unmappedCanonicalKeysForBackfill([...corpusKeys].reverse());
    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
    expect(new Set(first).size).toBe(first.length);
    expect(first).not.toContain("ROOFING-SHINGLE-ARCHITECTURAL");
    expect(first).toContain("METAL-ROOF-PANEL-EXPOSED-29GA-36IN");
  });

  it("carries no tenant/org data — the map is global reference data", () => {
    const serialized = JSON.stringify(CANONICAL_MATERIAL_CODES).toLowerCase();
    expect(serialized).not.toContain("orgid");
    expect(serialized).not.toContain("org_id");
  });
});

describe("Classification-assisted matching verdicts", () => {
  it("confirms a code match for the candidate canonical material", () => {
    expect(classifySupplierCodes("30151508", undefined, "ROOFING-SHINGLE-ARCHITECTURAL")).toEqual({
      kind: "code-confirmed",
      canonicalKey: "ROOFING-SHINGLE-ARCHITECTURAL",
    });
  });

  it("flags a supplier code that belongs to a different canonical material", () => {
    expect(classifySupplierCodes("30151703", undefined, "ROOFING-SHINGLE-ARCHITECTURAL")).toEqual({
      kind: "code-conflict",
      canonicalKey: "ROOFING-SHINGLE-ARCHITECTURAL",
      conflictingKey: "GUTTER-KSTYLE-5IN-ALUM",
    });
  });

  it("returns unmapped when neither side carries verified codes", () => {
    expect(classifySupplierCodes(undefined, undefined, "ROOFING-SHINGLE-ARCHITECTURAL")).toMatchObject({
      kind: "code-unmapped",
    });
    expect(classifySupplierCodes("30151508", undefined, "SOME-UNCODED-MATERIAL")).toMatchObject({
      kind: "code-unmapped",
    });
  });

  it("returns ambiguous for ambiguously classified canonical materials", () => {
    expect(classifySupplierCodes("30151508", undefined, "ROOFING-RIDGE-CAP")).toMatchObject({
      kind: "code-ambiguous",
      canonicalKey: "ROOFING-RIDGE-CAP",
    });
  });
});

describe("Classification-assisted pilot matching", () => {
  it("confirms an auto-link when the supplier code matches the verified map", () => {
    const result = matchPilotCanonicalProduct({
      name: "Owens Corning Duration architectural shingles",
      purchaseUnit: "bundle",
      unspsc: "30151508",
    });
    expect(result.action).toBe("AUTO_LINK");
    expect(result.canonicalMaterialKey).toBe("ROOFING.SHINGLE.ARCHITECTURAL.BUNDLE");
    expect(result.rationale).toContain("verified canonical map");
  });

  it("never assigns a canonical identity from code alone when text is weak", () => {
    const result = matchPilotCanonicalProduct({
      name: "3-tab shingles",
      unspsc: "30151508",
    });
    expect(result.action).toBe("CREATE_NEW_CANDIDATE");
    expect(result.canonicalMaterialKey).toBeNull();
    expect(result.displayName).toBeNull();
  });

  it("downgrades a conflicting code to human review instead of silently merging", () => {
    const result = matchPilotCanonicalProduct({
      name: "architectural shingles bundle",
      purchaseUnit: "bundle",
      unspsc: "30151703", // gutters — belongs to a different canonical material
    });
    expect(result.action).toBe("HUMAN_REVIEW");
    expect(result.rationale).toContain("never silently merged");
  });

  it("keeps unit-compatibility review even when the code confirms the candidate", () => {
    const result = matchPilotCanonicalProduct({
      name: "architectural shingles",
      purchaseUnit: "square", // conflicts with the pilot BUNDLE unit
      unspsc: "30151508",
    });
    expect(result.action).toBe("HUMAN_REVIEW");
    expect(result.rationale).toContain("unit");
  });

  it("leaves behavior unchanged when no classification codes are supplied", () => {
    const result = matchPilotCanonicalProduct({ name: "architectural shingles bundle" });
    expect(result.action).toBe("AUTO_LINK");
    expect(result.rationale).not.toContain("verified canonical map");
  });
});
