import {
  assessBuilderMuseMaterialRow,
  toBuilderMuseEscalationReference,
  toVerifiedBuilderMuseCandidate,
} from "../modules/costbook/builderMuseIntake";

const materialRow = {
  externalId: "buildermuse-pt-lumber-2x6",
  itemCode: "BM-PT-2X6",
  category: "Lumber",
  description: "Pressure-treated lumber 2x6",
  costbookUnit: "BF",
  sourceValue: 695,
  packageQuantity: 1000,
  normalizedUnitCost: 0.695,
  sourcePriceUnit: "MBF",
  pricePeriod: "2026-03",
  geography: "Not specified",
  vendorOrSource: "Dealer Survey",
  supplierSku: null,
  importStatus: "REVIEW",
  reviewReason: "Verify supplier, SKU, Terre Haute price, capture date and source evidence before import",
  sourceFile: "BuilderMuse_Costbook_Prepared.xlsx",
  sourceRow: 4,
};

describe("BuilderMuse Costbook intake", () => {
  it("blocks prepared material pricing that lacks exact provenance", () => {
    const assessment = assessBuilderMuseMaterialRow(materialRow);

    expect(assessment.eligibleForCandidateCreation).toBe(false);
    expect(assessment.blockers).toEqual([
      "missing-exact-source-date",
      "missing-local-geography",
      "missing-supplier-sku",
      "missing-source-evidence",
    ]);
  });

  it("does not invent an exact source date from a YYYY-MM price period", () => {
    const assessment = assessBuilderMuseMaterialRow({
      ...materialRow,
      geography: "Terre Haute, Indiana",
      supplierSku: "ABC-123",
    });

    expect(assessment.blockers).toContain("missing-exact-source-date");
  });

  it("requires separately verified evidence before creating a research candidate", () => {
    expect(() => toVerifiedBuilderMuseCandidate(materialRow, {
      sourceDate: "2026-03-12",
      retrievedAt: "2026-09-12T20:00:00-04:00",
      regionalBasis: "Terre Haute, Indiana",
      supplierSku: "ABC-123",
      sourceName: "Local supplier quote",
    })).toThrow();

    const candidate = toVerifiedBuilderMuseCandidate(materialRow, {
      sourceDate: "2026-03-12",
      retrievedAt: "2026-09-12T20:00:00-04:00",
      regionalBasis: "Terre Haute, Indiana",
      supplierSku: "ABC-123",
      evidenceUrl: "https://example.com/evidence/buildermuse-pt-2x6",
      sourceName: "Local supplier quote",
    });

    expect(candidate.materialCostTypical).toBe(0.695);
    expect(candidate.sourceDate).toBe("2026-03-12");
    expect(candidate.regionalBasis).toBe("Terre Haute, Indiana");
    expect(candidate.sourceUrl).toBe("https://example.com/evidence/buildermuse-pt-2x6");
    expect(candidate.sourceIdentifier).toBe("BUILDERMUSE-buildermuse-pt-lumber-2x6");
    expect(candidate.provenanceStatus).toBe("documented");
    expect(candidate.laborRateAssumption).toBeUndefined();
  });

  it("keeps price indices as escalation references instead of dollar prices", () => {
    const reference = toBuilderMuseEscalationReference({
      category: "Lumber",
      seriesId: "WPU081",
      seriesName: "Lumber and wood products",
      indexValue: 291.02,
      period: "2026-03",
      source: "BLS/FRED",
      costbookUse: "ESCALATION REFERENCE ONLY",
    });

    expect(reference.semanticBoundary).toBe("escalation-reference-only");
    expect(reference.indexValue).toBe(291.02);
    expect(reference).not.toHaveProperty("materialCostTypical");
    expect(reference).not.toHaveProperty("billRate");
  });

  it("rejects malformed numeric material rows", () => {
    expect(() => assessBuilderMuseMaterialRow({ ...materialRow, normalizedUnitCost: Number.NaN })).toThrow();
    expect(() => assessBuilderMuseMaterialRow({ ...materialRow, normalizedUnitCost: -1 })).toThrow();
  });
});
