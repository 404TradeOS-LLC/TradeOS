import {
  buildKnowledgeCorpusReport,
  classifyKnowledgeCostItem,
  normalizeKnowledgeCostItem,
} from "../modules/costbook/knowledgeCandidateNormalizer";
import { isEligibleForCostbookPromotion } from "../modules/costbook/candidateCostItem";
import { getKnowledgeRepositorySnapshot } from "../modules/knowledge-runtime/repository";
import type { KnowledgeCostItemRecord } from "../modules/knowledge-runtime/types";

/**
 * A legacy corpus record: exactly the eight fields every item in
 * packages/knowledge-engine/exports/json/costbook.json actually carries, with
 * no provenance whatsoever. This is what 1,795 of 1,795 canonical items look
 * like today.
 */
function legacyRecord(overrides: Partial<KnowledgeCostItemRecord> = {}): KnowledgeCostItemRecord {
  return {
    id: "b8feee9c-947e-44ba-821c-a4b796b6d49c",
    name: "3-5/8 Inch 20 Gauge Steel Stud Install",
    category: "Framing",
    trade: "Framing",
    unitOfMeasure: "LF",
    description: "Standard interior partition stud",
    keywords: ["steel", "stud"],
    ...overrides,
    metadata: {
      source: "knowledge-engine",
      laborCost: 1.05,
      materialCost: 0.88,
      equipmentCost: 0.05,
      totalUnitCost: 1.98,
      schemaRefs: ["cost-item.schema.json"],
      provenanceStatus: "unverified-legacy",
      ...(overrides.metadata ?? {}),
    },
  };
}

/**
 * A hypothetical fully-documented record. No such record exists in the
 * canonical corpus today - this fixture exists to prove the ready path, not
 * to imply the corpus contains one.
 */
function documentedRecord(overrides: Partial<KnowledgeCostItemRecord> = {}): KnowledgeCostItemRecord {
  const base = legacyRecord(overrides);
  return {
    ...base,
    metadata: {
      ...base.metadata,
      provenanceStatus: "documented",
      sourceName: "State of Indiana published unit price book",
      sourceUrl: "https://example.gov/unit-prices/2026",
      sourceDate: "2026-06-01",
      retrievedAt: "2026-09-01T00:00:00.000Z",
      confidence: "medium",
      reviewedBy: "estimator@example.com",
      reviewedAt: "2026-09-02T00:00:00.000Z",
      ...(overrides.metadata ?? {}),
    },
  };
}

describe("normalizeKnowledgeCostItem — legacy corpus records", () => {
  it("classifies an unsourced legacy item as unverified-legacy and refuses to make it a candidate", () => {
    const result = normalizeKnowledgeCostItem(legacyRecord());

    expect(result.outcome).toBe("blocked");
    expect(result.candidate).toBeNull();
    expect(result.classification.provenanceStatus).toBe("unverified-legacy");
    expect(result.classification.candidateReady).toBe(false);
  });

  it("reports every missing piece of evidence rather than defaulting them", () => {
    const result = normalizeKnowledgeCostItem(legacyRecord());

    expect(result.classification.blockReasons).toEqual(
      expect.arrayContaining([
        "missing-source",
        "missing-source-date",
        "missing-retrieved-at",
        "missing-confidence",
        "unverified-provenance",
      ])
    );
  });

  it("never fabricates provenance for a record that asserts none", () => {
    const result = normalizeKnowledgeCostItem(legacyRecord());

    // The only trust state a sourceless record may hold is the safe default.
    expect(result.classification.provenanceStatus).toBe("unverified-legacy");
    expect(result.candidate).toBeNull();
  });

  it("treats a self-declared placeholder price as blocked even if it is otherwise complete", () => {
    const result = normalizeKnowledgeCostItem(
      documentedRecord({ metadata: { provenanceStatus: "placeholder" } as never })
    );

    expect(result.outcome).toBe("blocked");
    expect(result.classification.blockReasons).toContain("placeholder-pricing");
  });
});

describe("normalizeKnowledgeCostItem — documented records", () => {
  it("produces a contract-valid candidate when every required field is present", () => {
    const result = normalizeKnowledgeCostItem(documentedRecord());

    expect(result.outcome).toBe("ready");
    expect(result.classification.candidateReady).toBe(true);
    expect(result.classification.blockReasons).toEqual([]);
    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.sourceName).toBe("State of Indiana published unit price book");
    expect(result.candidate!.materialCostTypical).toBe(1.98);
    expect(result.candidate!.unitOfMeasure).toBe("LF");
  });

  it("never yields a candidate that is already eligible for promotion", () => {
    const result = normalizeKnowledgeCostItem(documentedRecord());

    expect(result.candidate!.reviewStatus).toBe("candidate");
    expect(result.candidate!.reviewedBy).toBeUndefined();
    expect(result.candidate!.reviewedAt).toBeUndefined();
    // Normalization can never substitute for a human review decision.
    expect(isEligibleForCostbookPromotion(result.candidate!)).toBe(false);
  });

  it("does not present national research as local pricing", () => {
    const result = normalizeKnowledgeCostItem(documentedRecord());

    expect(result.candidate!.regionalBasis).toMatch(/national\/default/);
    expect(result.candidate!.regionalBasis).not.toMatch(/Terre Haute/i);
  });

  it("blocks a documented record whose unit is outside the known Costbook set", () => {
    const result = normalizeKnowledgeCostItem(documentedRecord({ unitOfMeasure: "per tree" }));

    expect(result.outcome).toBe("blocked");
    expect(result.classification.blockReasons).toContain("unsupported-unit");
  });

  it.each([
    ["a zero total unit cost", 0, "missing-cost"],
    ["a negative total unit cost", -5, "negative-cost"],
    ["a non-finite total unit cost", Number.NaN, "non-finite-cost"],
  ])("fails closed on %s", (_label, totalUnitCost, expectedReason) => {
    const record = documentedRecord();
    const result = normalizeKnowledgeCostItem({
      ...record,
      metadata: { ...record.metadata, totalUnitCost },
    });

    expect(result.outcome).toBe("blocked");
    expect(result.classification.blockReasons).toContain(expectedReason);
  });

  it("blocks a record whose trade could not be inferred", () => {
    const result = normalizeKnowledgeCostItem(documentedRecord({ trade: null }));

    expect(result.outcome).toBe("blocked");
    expect(result.classification.blockReasons).toContain("missing-trade");
  });

  it("requires a citation, not merely a source name", () => {
    const record = documentedRecord();
    const result = normalizeKnowledgeCostItem({
      ...record,
      metadata: { ...record.metadata, sourceUrl: undefined, sourceIdentifier: undefined },
    });

    expect(result.outcome).toBe("blocked");
    expect(result.classification.blockReasons).toContain("missing-source");
  });
});

describe("buildKnowledgeCorpusReport", () => {
  it("counts provenance states and candidate readiness deterministically", () => {
    const report = buildKnowledgeCorpusReport([legacyRecord(), legacyRecord(), documentedRecord()]);

    expect(report.totalItems).toBe(3);
    expect(report.unverifiedLegacy).toBe(2);
    expect(report.documented).toBe(1);
    expect(report.candidateReady).toBe(1);
    expect(report.blocked).toBe(2);
    expect(report.blockReasonCounts["missing-source"]).toBe(2);
  });

  it("returns the same counts for the same input every time", () => {
    const records = [legacyRecord(), documentedRecord()];
    expect(buildKnowledgeCorpusReport(records)).toEqual(buildKnowledgeCorpusReport(records));
  });
});

describe("the real Knowledge Engine corpus", () => {
  /**
   * Baseline honesty pin. The canonical corpus currently carries no
   * item-level provenance at all, so nothing in it is candidate-ready. If a
   * future slice populates real, cited provenance, this test should be
   * updated deliberately - not deleted - to record the new truth.
   */
  it("contains no candidate-ready items today, because no item carries a cited source", () => {
    const snapshot = getKnowledgeRepositorySnapshot();
    const report = buildKnowledgeCorpusReport(snapshot.costItems);

    expect(report.totalItems).toBeGreaterThan(1700);
    expect(report.documented).toBe(0);
    expect(report.candidateReady).toBe(0);
    expect(report.blocked).toBe(report.totalItems);
    expect(report.blockReasonCounts["missing-source"]).toBe(report.totalItems);
  });

  it("classifies every corpus item without throwing", () => {
    const snapshot = getKnowledgeRepositorySnapshot();

    for (const record of snapshot.costItems) {
      const classification = classifyKnowledgeCostItem(record);
      expect(classification.knowledgeItemId).toBe(record.id);
      expect(classification.candidateReady).toBe(false);
    }
  });
});
