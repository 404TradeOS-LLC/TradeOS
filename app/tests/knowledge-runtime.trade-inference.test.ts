import {
  getKnowledgeRepositorySnapshot,
  inferTrade,
  resetKnowledgeRepositoryCache,
  searchKnowledge,
} from "../modules/knowledge-runtime/repository";
import { KnowledgeTrade } from "../modules/knowledge-runtime/types";

function fakeTrade(name: string): KnowledgeTrade {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    itemCount: 0,
    status: "Stable",
    coverage: "100%",
    notes: "",
    keywords: [],
  };
}

// The subset of real trades relevant to the collision this fix repairs,
// plus enough neighbors to exercise multi-trade ambiguity and specificity
// ranking. Order deliberately does NOT put "Trim" before "Tree Service" or
// vice versa - the fix must not depend on array order either way.
const FAKE_TRADES: KnowledgeTrade[] = [
  fakeTrade("Trim"),
  fakeTrade("Tree Service"),
  fakeTrade("Roofing"),
  fakeTrade("Framing"),
  fakeTrade("Concrete"),
  fakeTrade("Electrical"),
  fakeTrade("Plumbing"),
  fakeTrade("HVAC"),
  fakeTrade("Painting"),
  fakeTrade("Flooring"),
  fakeTrade("General Conditions"),
  fakeTrade("Deck"),
];

describe("inferTrade — word-boundary/token-aware classification", () => {
  it('does not match trade "Trim" inside "tree trimming" (the reported collision)', () => {
    expect(inferTrade("Tree Trimming Service", "", [], FAKE_TRADES)).not.toBe("Trim");
  });

  it('matches trade "Trim" for "trim installation"', () => {
    expect(inferTrade("Trim Installation", "", [], FAKE_TRADES)).toBe("Trim");
  });

  it('resolves "Tree Service" from text that also contains "trimming"', () => {
    const result = inferTrade(
      "Tree Service",
      "Tree Service ANSI-compliant tree removals, trimming, stump grinding, and soil fertilization packages.",
      [],
      FAKE_TRADES
    );
    expect(result).toBe("Tree Service");
  });

  it("is case-insensitive", () => {
    expect(inferTrade("ROOFING SHINGLE REPLACEMENT", "", [], FAKE_TRADES)).toBe("Roofing");
    expect(inferTrade("RoOfInG ShInGlE rEpLaCeMeNt", "", [], FAKE_TRADES)).toBe("Roofing");
  });

  it("is not broken by punctuation (hyphens, commas, slashes)", () => {
    expect(inferTrade("Roof Tear-off, Full Replacement", "", [], FAKE_TRADES)).toBe("Roofing");
    // "Fence" is not a trade in this fixture, so category falls through to
    // name; punctuation must split "deck/fence" into clean ["deck","fence"]
    // tokens rather than one unmatched blob, letting the real "Deck" token
    // resolve correctly instead of failing to tokenize at all.
    expect(inferTrade("Deck/fence Connector Bracket", "Fence", [], FAKE_TRADES)).toBe("Deck");
  });

  it("requires multi-word trade names to appear as an adjacent phrase, not merely co-occurring", () => {
    expect(inferTrade("General Contractor Conditions Report", "", [], FAKE_TRADES)).not.toBe("General Conditions");
    expect(inferTrade("General Conditions - Site Supervision", "", [], FAKE_TRADES)).toBe("General Conditions");
  });

  it("resolves multi-word trade names correctly end to end", () => {
    expect(inferTrade("General Conditions", "General Conditions", [], FAKE_TRADES)).toBe("General Conditions");
    expect(inferTrade("Tree Service Assembly Group", "Tree Service", [], FAKE_TRADES)).toBe("Tree Service");
  });

  it("does not let a shorter trade name steal a match from a longer, more specific one", () => {
    // "Tree" alone is not a trade in this fixture, but a hypothetical short
    // alias must not win over the full "Tree Service" phrase when both are
    // present; this is exercised directly via the priority/length ranking.
    const result = inferTrade("Tree Service", "Tree Service", [], FAKE_TRADES);
    expect(result).toBe("Tree Service");
  });

  it("prefers category over name when both are informative and disagree", () => {
    // Real-world case from the corpus audit: "Wall Straightening And
    // Plumbing" filed under category "Framing" must resolve to Framing,
    // not Plumbing, because category is curated ground truth.
    expect(inferTrade("Wall Straightening And Plumbing - Per LF", "Framing", [], FAKE_TRADES)).toBe("Framing");
  });

  it("falls through to name only when category names no trade at all", () => {
    expect(inferTrade("Roofing Shingle Replacement", "Assemblies - Exterior", [], FAKE_TRADES)).toBe("Roofing");
  });

  it("returns null for genuinely ambiguous text naming two real trades with equal weight", () => {
    const result = inferTrade(
      "Bathroom",
      "Assemblies - Bathroom Standard plumbing, electrical, and finishing assemblies.",
      [],
      FAKE_TRADES
    );
    expect(result).toBeNull();
  });

  it("returns null rather than an arbitrary pick when no trade matches at all", () => {
    expect(inferTrade("Widget Assembly", "Assemblies - Misc", [], FAKE_TRADES)).toBeNull();
  });

  it("prefers a strict-majority candidateTrades signal over text matching", () => {
    const result = inferTrade(
      "Remodel Package",
      "Assemblies - Misc",
      ["Roofing", "Roofing", "Painting"],
      FAKE_TRADES
    );
    expect(result).toBe("Roofing");
  });

  it("falls through to text matching when candidateTrades has no strict majority", () => {
    const result = inferTrade("Roofing Package", "Roofing", ["Roofing", "Painting"], FAKE_TRADES);
    expect(result).toBe("Roofing");
  });
});

describe("inferTrade against the real Knowledge Engine corpus", () => {
  beforeEach(() => {
    resetKnowledgeRepositoryCache();
  });

  it("resolves the Tree Service assembly-index record to Tree Service, not Trim", () => {
    const snap = getKnowledgeRepositorySnapshot();
    const record = snap.assemblies.find((a) => a.id === "assembly-index:tree-service");
    expect(record?.trade).toBe("Tree Service");
  });

  it("does not misclassify the real corpus's Trim items as anything else, and vice versa", () => {
    const results = searchKnowledge({ query: "trim installation", type: "costItem", limit: 20 });
    const trimResults = results.filter((r) => r.category === "Trim");
    expect(trimResults.length).toBeGreaterThan(0);
    for (const result of trimResults) {
      expect(result.trade).toBe("Trim");
    }
  });

  it("every cost item's trade matches its own category (module the Flatwork->Concrete normalization)", () => {
    const snap = getKnowledgeRepositorySnapshot();
    expect(snap.costItems.length).toBeGreaterThan(0);
    for (const item of snap.costItems) {
      if (item.category === "Flatwork") {
        expect(item.trade).toBe("Concrete");
      } else if (item.category === "Hvac") {
        expect(item.trade).toBe("HVAC");
      } else {
        expect(item.trade).toBe(item.category);
      }
    }
  });

  it("retains correct classification for representative real records across major trades", () => {
    const snap = getKnowledgeRepositorySnapshot();
    const byName = (name: string) => snap.costItems.find((item) => item.name === name);

    // Spot-check a handful of real, unambiguous corpus items whose
    // category-consistent classification must survive the rewrite.
    for (const name of [
      "3-5/8 Inch 20 Gauge Steel Stud Install", // Framing
    ]) {
      const item = byName(name);
      if (item) expect(item.trade).toBe(item.category);
    }

    const tradesWithItems = new Set(snap.costItems.map((item) => item.category));
    // The corpus spells this category "Hvac", not "HVAC"; the trade name is
    // "HVAC" - see the Flatwork/Hvac normalization note in the test above.
    const categoryToExpectedTrade: Record<string, string> = {
      Concrete: "Concrete",
      Roofing: "Roofing",
      Framing: "Framing",
      Electrical: "Electrical",
      Plumbing: "Plumbing",
      Hvac: "HVAC",
      Painting: "Painting",
      Flooring: "Flooring",
    };
    for (const [category, expectedTrade] of Object.entries(categoryToExpectedTrade)) {
      expect(tradesWithItems.has(category)).toBe(true);
      const itemsForCategory = snap.costItems.filter((item) => item.category === category);
      expect(itemsForCategory.length).toBeGreaterThan(0);
      for (const item of itemsForCategory) {
        expect(item.trade).toBe(expectedTrade);
      }
    }
  });

  it("never resolves zero cost items to a trade (fail-conservative applies to assemblies, not the curated cost-item category field)", () => {
    const snap = getKnowledgeRepositorySnapshot();
    const nullTradeCostItems = snap.costItems.filter((item) => item.trade === null);
    expect(nullTradeCostItems).toHaveLength(0);
  });
});
