import {
  getKnowledgeRepositorySnapshot,
  resetKnowledgeRepositoryCache,
  resolveItemProvenance,
} from "../modules/knowledge-runtime/repository";
import { KnowledgeTrade, RawKnowledgeCostItem } from "../modules/knowledge-runtime/types";

function fakeTrade(name: string, provenanceStatus: KnowledgeTrade["provenanceStatus"] = "unverified-legacy"): KnowledgeTrade {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    itemCount: 0,
    status: "Stable",
    coverage: "100%",
    notes: "",
    keywords: [],
    provenanceStatus,
  };
}

const FAKE_TRADES: KnowledgeTrade[] = [fakeTrade("Roofing", "unverified-legacy"), fakeTrade("Tree Service", "placeholder")];

function rawItem(overrides: Partial<RawKnowledgeCostItem> = {}): RawKnowledgeCostItem {
  return {
    id: "item-1",
    name: "Test Item",
    category: "Roofing",
    unit: "SF",
    laborCost: "1.00",
    materialCost: "2.00",
    equipmentCost: "0.00",
    ...overrides,
  };
}

describe("resolveItemProvenance — item-level provenance/source metadata (additive)", () => {
  it("falls back to the item's trade-level provenanceStatus when the item carries no fields of its own (today's real-corpus behavior)", () => {
    const result = resolveItemProvenance(rawItem(), "Roofing", FAKE_TRADES);
    expect(result).toEqual({ provenanceStatus: "unverified-legacy" });
  });

  it("falls back to trade-level provenanceStatus even when the item's trade could not be inferred", () => {
    const result = resolveItemProvenance(rawItem(), null, FAKE_TRADES);
    expect(result.provenanceStatus).toBe("unverified-legacy");
  });

  it("prefers an item's own valid provenanceStatus over its trade's", () => {
    const result = resolveItemProvenance(rawItem({ provenanceStatus: "documented" }), "Roofing", FAKE_TRADES);
    expect(result.provenanceStatus).toBe("documented");
  });

  it("does not trust an unrecognized item-level provenanceStatus value - falls back to trade-level instead", () => {
    const result = resolveItemProvenance(rawItem({ provenanceStatus: "verified-by-vibes" }), "Roofing", FAKE_TRADES);
    expect(result.provenanceStatus).toBe("unverified-legacy");
  });

  it("surfaces source/confidence/review fields only when present and non-blank", () => {
    const result = resolveItemProvenance(
      rawItem({
        provenanceStatus: "documented",
        sourceName: "Manufacturer price sheet",
        sourceUrl: "https://example.com/pricing",
        sourceDate: "2026-08-01",
        retrievedAt: "2026-09-08T00:00:00.000Z",
        confidence: "high",
        reviewedBy: "jane@example.com",
        reviewedAt: "2026-09-08T01:00:00.000Z",
      }),
      "Roofing",
      FAKE_TRADES
    );
    expect(result).toEqual({
      provenanceStatus: "documented",
      sourceName: "Manufacturer price sheet",
      sourceUrl: "https://example.com/pricing",
      sourceDate: "2026-08-01",
      retrievedAt: "2026-09-08T00:00:00.000Z",
      confidence: "high",
      reviewedBy: "jane@example.com",
      reviewedAt: "2026-09-08T01:00:00.000Z",
    });
  });

  it("treats a blank/whitespace-only source or reviewer field as absent, not as an empty assertion", () => {
    const result = resolveItemProvenance(rawItem({ sourceName: "   ", reviewedBy: "" }), "Roofing", FAKE_TRADES);
    expect(result.sourceName).toBeUndefined();
    expect(result.reviewedBy).toBeUndefined();
  });

  it("ignores an unrecognized confidence value rather than passing it through", () => {
    const result = resolveItemProvenance(rawItem({ confidence: "extremely-sure" }), "Roofing", FAKE_TRADES);
    expect(result.confidence).toBeUndefined();
  });

  it("sets no optional field keys at all when the item carries none of them (exact shape check)", () => {
    const result = resolveItemProvenance(rawItem(), "Roofing", FAKE_TRADES);
    expect(Object.keys(result)).toEqual(["provenanceStatus"]);
  });
});

describe("item-level provenance against the real Knowledge Engine corpus (backward compatibility)", () => {
  beforeEach(() => {
    resetKnowledgeRepositoryCache();
  });

  it("every real cost item's resolved provenanceStatus still matches its trade-level value (no item in the canonical export carries its own field yet)", () => {
    const snap = getKnowledgeRepositorySnapshot();
    expect(snap.costItems.length).toBeGreaterThan(0);
    for (const item of snap.costItems) {
      const trade = snap.trades.find((candidate) => candidate.name === item.trade);
      const expected = trade ? trade.provenanceStatus : "unverified-legacy";
      expect(item.metadata.provenanceStatus).toBe(expected);
    }
  });

  it("no real cost item currently carries item-level source/confidence/review metadata (honest baseline, not fabricated)", () => {
    const snap = getKnowledgeRepositorySnapshot();
    const withSourceMetadata = snap.costItems.filter(
      (item) =>
        item.metadata.sourceName ||
        item.metadata.sourceUrl ||
        item.metadata.sourceIdentifier ||
        item.metadata.confidence ||
        item.metadata.retrievedAt
    );
    expect(withSourceMetadata).toHaveLength(0);
  });

  it("does not change any cost item's derived pricing (laborCost/materialCost/equipmentCost/totalUnitCost) as a side effect of the added fields", () => {
    const snap = getKnowledgeRepositorySnapshot();
    const shingleItem = snap.costItems.find((item) => item.name === "3-5/8 Inch 20 Gauge Steel Stud Install");
    expect(shingleItem).toBeDefined();
    expect(shingleItem?.metadata.laborCost).toBeCloseTo(1.05, 5);
    expect(shingleItem?.metadata.materialCost).toBeCloseTo(0.88, 5);
    expect(shingleItem?.metadata.equipmentCost).toBeCloseTo(0.05, 5);
  });
});
