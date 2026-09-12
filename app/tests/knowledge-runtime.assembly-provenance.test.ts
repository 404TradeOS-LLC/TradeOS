import {
  getKnowledgeRepositorySnapshot,
  resetKnowledgeRepositoryCache,
  resolveAssemblyProvenance,
} from "../modules/knowledge-runtime/repository";
import { KnowledgeTrade, RawKnowledgeAssembly } from "../modules/knowledge-runtime/types";

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

function rawAssembly(overrides: Partial<RawKnowledgeAssembly> = {}): RawKnowledgeAssembly {
  return {
    id: "assembly-1",
    name: "Test Assembly",
    category: "Roofing",
    lineItems: [],
    ...overrides,
  };
}

describe("resolveAssemblyProvenance — assembly-level provenance/source metadata (additive)", () => {
  it("falls back to the assembly's trade-level provenanceStatus when it carries no fields of its own (today's real-corpus behavior)", () => {
    const result = resolveAssemblyProvenance(rawAssembly(), "Roofing", FAKE_TRADES);
    expect(result).toEqual({ provenanceStatus: "unverified-legacy" });
  });

  it("falls back to trade-level provenanceStatus even when the assembly's trade could not be inferred", () => {
    const result = resolveAssemblyProvenance(rawAssembly(), null, FAKE_TRADES);
    expect(result.provenanceStatus).toBe("unverified-legacy");
  });

  it("prefers an assembly's own valid provenanceStatus over its trade's", () => {
    const result = resolveAssemblyProvenance(rawAssembly({ provenanceStatus: "documented" }), "Roofing", FAKE_TRADES);
    expect(result.provenanceStatus).toBe("documented");
  });

  it("does not trust an unrecognized assembly-level provenanceStatus value - falls back to trade-level instead", () => {
    const result = resolveAssemblyProvenance(rawAssembly({ provenanceStatus: "verified-by-vibes" }), "Roofing", FAKE_TRADES);
    expect(result.provenanceStatus).toBe("unverified-legacy");
  });

  it("surfaces source/confidence/review fields only when present and non-blank", () => {
    const result = resolveAssemblyProvenance(
      rawAssembly({
        provenanceStatus: "documented",
        sourceName: "Manufacturer assembly guide",
        sourceUrl: "https://example.com/assembly-guide",
        sourceDate: "2026-08-01",
        retrievedAt: "2026-09-10T00:00:00.000Z",
        confidence: "high",
        reviewedBy: "jane@example.com",
        reviewedAt: "2026-09-10T01:00:00.000Z",
      }),
      "Roofing",
      FAKE_TRADES
    );
    expect(result).toEqual({
      provenanceStatus: "documented",
      sourceName: "Manufacturer assembly guide",
      sourceUrl: "https://example.com/assembly-guide",
      sourceDate: "2026-08-01",
      retrievedAt: "2026-09-10T00:00:00.000Z",
      confidence: "high",
      reviewedBy: "jane@example.com",
      reviewedAt: "2026-09-10T01:00:00.000Z",
    });
  });

  it("treats a blank/whitespace-only source or reviewer field as absent, not as an empty assertion", () => {
    const result = resolveAssemblyProvenance(rawAssembly({ sourceName: "   ", reviewedBy: "" }), "Roofing", FAKE_TRADES);
    expect(result.sourceName).toBeUndefined();
    expect(result.reviewedBy).toBeUndefined();
  });

  it("ignores an unrecognized confidence value rather than passing it through", () => {
    const result = resolveAssemblyProvenance(rawAssembly({ confidence: "extremely-sure" }), "Roofing", FAKE_TRADES);
    expect(result.confidence).toBeUndefined();
  });

  it("sets no optional field keys at all when the assembly carries none of them (exact shape check)", () => {
    const result = resolveAssemblyProvenance(rawAssembly(), "Roofing", FAKE_TRADES);
    expect(Object.keys(result)).toEqual(["provenanceStatus"]);
  });
});

describe("assembly-level provenance against the real Knowledge Engine corpus (backward compatibility)", () => {
  beforeEach(() => {
    resetKnowledgeRepositoryCache();
  });

  it("every real assembly's resolved provenanceStatus still matches its trade-level value (no assembly in the canonical export carries its own field yet)", () => {
    const snap = getKnowledgeRepositorySnapshot();
    expect(snap.assemblies.length).toBeGreaterThan(0);
    for (const assembly of snap.assemblies) {
      const trade = snap.trades.find((candidate) => candidate.name === assembly.trade);
      const expected = trade ? trade.provenanceStatus : "unverified-legacy";
      expect(assembly.metadata.provenanceStatus).toBe(expected);
    }
  });

  it("no real assembly currently carries assembly-level source/confidence/review metadata (honest baseline, not fabricated)", () => {
    const snap = getKnowledgeRepositorySnapshot();
    const withSourceMetadata = snap.assemblies.filter(
      (assembly) =>
        assembly.metadata.sourceName ||
        assembly.metadata.sourceUrl ||
        assembly.metadata.sourceIdentifier ||
        assembly.metadata.confidence ||
        assembly.metadata.retrievedAt
    );
    expect(withSourceMetadata).toHaveLength(0);
  });
});
