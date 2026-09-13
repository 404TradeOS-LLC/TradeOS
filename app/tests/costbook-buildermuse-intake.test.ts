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

const verifiedProvenance = {
  sourceDate: "2026-03-12",
  retrievedAt: "2026-09-12T20:00:00-04:00",
  regionalBasis: "Terre Haute, Indiana",
  supplierSku: "ABC-123",
  evidenceUrl: "https://example.com/evidence/buildermuse-pt-2x6",
  sourceName: "Local supplier quote",
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
    const assessment = assessBuilderMuseMaterialRow({ ...materialRow, geography: "Terre Haute, Indiana", supplierSku: "ABC-123" });
    expect(assessment.blockers).toContain("missing-exact-source-date");
  });

  it("requires separately verified evidence before creating a research candidate", () => {
    const { evidenceUrl: _evidenceUrl, ...withoutEvidence } = verifiedProvenance;
    expect(() => toVerifiedBuilderMuseCandidate(materialRow, withoutEvidence)).toThrow();

    const candidate = toVerifiedBuilderMuseCandidate(materialRow, verifiedProvenance);
    expect(candidate.materialCostTypical).toBe(0.695);
    expect(candidate.sourceDate).toBe("2026-03-12");
    expect(candidate.regionalBasis).toBe("Terre Haute, Indiana");
    expect(candidate.sourceUrl).toBe(verifiedProvenance.evidenceUrl);
    expect(candidate.sourceIdentifier).toBe("BUILDERMUSE-buildermuse-pt-lumber-2x6");
    expect(candidate.provenanceStatus).toBe("documented");
    expect(candidate.laborRateAssumption).toBeUndefined();
  });

  it("supports quote-only primary evidence without inventing a URL", () => {
    const { evidenceUrl: _evidenceUrl, ...base } = verifiedProvenance;
    const candidate = toVerifiedBuilderMuseCandidate(materialRow, { ...base, evidenceQuote: "Supplier quote Q-1042 dated 2026-03-12" });
    expect(candidate.sourceUrl).toBeUndefined();
    expect(candidate.researchNotes).toContain("Supplier quote Q-1042");
  });

  it("rejects invalid calendar dates and placeholder verified provenance", () => {
    expect(() => toVerifiedBuilderMuseCandidate(materialRow, { ...verifiedProvenance, sourceDate: "2026-02-31" })).toThrow();
    expect(() => toVerifiedBuilderMuseCandidate(materialRow, { ...verifiedProvenance, regionalBasis: "Not specified" })).toThrow();
    expect(() => toVerifiedBuilderMuseCandidate(materialRow, { ...verifiedProvenance, supplierSku: "N/A" })).toThrow();
  });

  it("rejects invalid calendar months", () => {
    expect(() => assessBuilderMuseMaterialRow({ ...materialRow, pricePeriod: "2026-13" })).toThrow();
    expect(() => toBuilderMuseEscalationReference({ category: "Lumber", seriesId: "WPU081", seriesName: "Lumber", indexValue: 291.02, period: "2026-00", source: "BLS/FRED", costbookUse: "ESCALATION REFERENCE ONLY" })).toThrow();
  });

  it("keeps price indices as escalation references instead of dollar prices", () => {
    const reference = toBuilderMuseEscalationReference({
      category: "Lumber", seriesId: "WPU081", seriesName: "Lumber and wood products", indexValue: 291.02,
      period: "2026-03", source: "BLS/FRED", costbookUse: "ESCALATION REFERENCE ONLY",
    });
    expect(reference.semanticBoundary).toBe("escalation-reference-only");
    expect(reference.indexValue).toBe(291.02);
    expect(reference).not.toHaveProperty("materialCostTypical");
    expect(reference).not.toHaveProperty("billRate");
  });

  it("rejects non-escalation markers and malformed price-index values", () => {
    const base = { category: "Lumber", seriesId: "WPU081", seriesName: "Lumber", indexValue: 291.02, period: "2026-03", source: "BLS/FRED", costbookUse: "ESCALATION REFERENCE ONLY" };
    expect(() => toBuilderMuseEscalationReference({ ...base, costbookUse: "MATERIAL PRICE" })).toThrow();
    expect(() => toBuilderMuseEscalationReference({ ...base, indexValue: Number.NaN })).toThrow();
  });

  it("rejects malformed numeric material rows", () => {
    expect(() => assessBuilderMuseMaterialRow({ ...materialRow, normalizedUnitCost: Number.NaN })).toThrow();
    expect(() => assessBuilderMuseMaterialRow({ ...materialRow, normalizedUnitCost: -1 })).toThrow();
  });
});
