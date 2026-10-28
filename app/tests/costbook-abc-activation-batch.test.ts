import {
  ABC_SKU_MATERIAL_ACTIVATION_BATCH,
  ABC_SKU_MATERIAL_ACTIVATION_SUMMARY,
} from "../modules/costbook/abcSkuMaterialActivationBatch";
import { SUPPLIER_PRICES_47802 } from "../modules/costbook/supplierPrices47802";

const abcSourceRows = SUPPLIER_PRICES_47802.filter(
  (row) => row.supplierCode === "ABC_SUPPLY"
);

describe("ABC SKU -> material activation proposal batch", () => {
  it("covers every seeded ABC product exactly once", () => {
    expect(abcSourceRows).toHaveLength(584);
    expect(ABC_SKU_MATERIAL_ACTIVATION_BATCH).toHaveLength(abcSourceRows.length);
    const batchKeys = ABC_SKU_MATERIAL_ACTIVATION_BATCH.map((row) => row.productKey).sort();
    const sourceKeys = abcSourceRows.map((row) => row.productKey).sort();
    expect(batchKeys).toEqual(sourceKeys);
    expect(new Set(batchKeys).size).toBe(batchKeys.length);
  });

  it("is review-only: every row is UNAPPROVED with provenance", () => {
    for (const row of ABC_SKU_MATERIAL_ACTIVATION_BATCH) {
      expect(row.approvalStatus).toBe("UNAPPROVED");
      expect(row.provenance).toContain("supplierPrices47802.ts");
      expect(row.provenance).toContain("NOT live ABC API pricing");
      expect(row.sourceUrl).toMatch(/^https:\/\//);
      expect(row.stockingUnit.length).toBeGreaterThan(0);
    }
  });

  it("never invents a candidate: candidate is the workbook key or null", () => {
    for (const row of ABC_SKU_MATERIAL_ACTIVATION_BATCH) {
      if (row.candidateCanonicalMaterialKey === null) {
        expect(row.disposition).toBe("UNMAPPED");
        expect(row.candidateMaterialName).toBeNull();
        expect(row.reviewReasons.length).toBeGreaterThan(0);
      } else {
        expect(row.candidateCanonicalMaterialKey).toBe(row.workbookCanonicalKey);
        expect(row.candidateMaterialName).toBeTruthy();
      }
    }
  });

  it("keeps weak-evidence rows UNMAPPED instead of forcing a match", () => {
    for (const row of ABC_SKU_MATERIAL_ACTIVATION_BATCH) {
      if (row.nameEvidence === "WEAK") {
        expect(row.disposition).toBe("UNMAPPED");
        expect(row.nameMatchScore).toBeLessThan(0.25);
      }
      if (row.disposition === "UNMAPPED") {
        expect(row.nameEvidence).toBe("WEAK");
      }
    }
  });

  it("PROPOSED rows carry an exact SKU, strong name evidence, and no unit conflict", () => {
    const proposed = ABC_SKU_MATERIAL_ACTIVATION_BATCH.filter(
      (row) => row.disposition === "PROPOSED"
    );
    expect(proposed.length).toBeGreaterThan(0);
    for (const row of proposed) {
      expect(row.sku).toBeTruthy();
      expect(row.nameEvidence).toBe("STRONG");
      expect(row.nameMatchScore).toBeGreaterThanOrEqual(0.4);
      expect(row.unitVerdict).not.toBe("CONFLICT");
      expect(row.reviewReasons).toHaveLength(0);
    }
  });

  it("flags every unit conflict and every missing SKU for review", () => {
    for (const row of ABC_SKU_MATERIAL_ACTIVATION_BATCH) {
      if (row.unitVerdict === "CONFLICT" && row.disposition !== "UNMAPPED") {
        expect(row.disposition).toBe("REVIEW");
        expect(row.reviewReasons.join(" ")).toContain("Stocking-unit conflict");
      }
      if (row.sku === null && row.disposition !== "UNMAPPED") {
        expect(row.disposition).toBe("REVIEW");
        expect(row.reviewReasons.join(" ")).toContain("No SKU in the seed source");
      }
    }
  });

  it("summary counts match the batch rows", () => {
    const rows = ABC_SKU_MATERIAL_ACTIVATION_BATCH;
    expect(ABC_SKU_MATERIAL_ACTIVATION_SUMMARY.totalRows).toBe(rows.length);
    expect(ABC_SKU_MATERIAL_ACTIVATION_SUMMARY.proposed).toBe(
      rows.filter((row) => row.disposition === "PROPOSED").length
    );
    expect(ABC_SKU_MATERIAL_ACTIVATION_SUMMARY.review).toBe(
      rows.filter((row) => row.disposition === "REVIEW").length
    );
    expect(ABC_SKU_MATERIAL_ACTIVATION_SUMMARY.unmapped).toBe(
      rows.filter((row) => row.disposition === "UNMAPPED").length
    );
    expect(ABC_SKU_MATERIAL_ACTIVATION_SUMMARY.unitCompatible).toBe(
      rows.filter((row) => row.unitVerdict === "COMPATIBLE").length
    );
    expect(ABC_SKU_MATERIAL_ACTIVATION_SUMMARY.unitConflict).toBe(
      rows.filter((row) => row.unitVerdict === "CONFLICT").length
    );
    expect(ABC_SKU_MATERIAL_ACTIVATION_SUMMARY.unitUnknown).toBe(
      rows.filter((row) => row.unitVerdict === "UNKNOWN").length
    );
  });

  it("row fields agree with the seed source for a sampled product", () => {
    const source = abcSourceRows.find((row) => row.productKey === "ABC-100012");
    const batch = ABC_SKU_MATERIAL_ACTIVATION_BATCH.find(
      (row) => row.productKey === "ABC-100012"
    );
    expect(source).toBeDefined();
    expect(batch).toBeDefined();
    expect(batch?.sku).toBe(source?.sku);
    expect(batch?.productName).toBe(source?.productName);
    expect(batch?.workbookCanonicalKey).toBe(source?.canonicalKey);
    expect(batch?.sourceUnit).toBe(source?.unit);
    expect(batch?.stockingUnit).toBe("SQ");
  });
});
