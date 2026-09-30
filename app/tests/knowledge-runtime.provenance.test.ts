import { isCostDataProvenanceStatus, normalizeCostDataProvenanceStatus } from "../modules/costbook/provenance";
import { resetKnowledgeRepositoryCache, resolveTradeProvenanceStatus, searchKnowledge } from "../modules/knowledge-runtime/repository";
import { buildProvenanceWarning, matchScopeDeterministically } from "../modules/knowledge-runtime/matcher";
import { KnowledgeRuntimeService } from "../modules/knowledge-runtime/service";
import { KnowledgeSearchResult, KnowledgeTrade } from "../modules/knowledge-runtime/types";

describe("normalizeCostDataProvenanceStatus", () => {
  it.each(["documented", "unverified-legacy", "placeholder"] as const)("passes a known value %s through unchanged", (status) => {
    expect(normalizeCostDataProvenanceStatus(status)).toBe(status);
  });

  it("defaults an unrecognized string to unverified-legacy", () => {
    expect(normalizeCostDataProvenanceStatus("verified")).toBe("unverified-legacy");
  });

  it("defaults undefined to unverified-legacy", () => {
    expect(normalizeCostDataProvenanceStatus(undefined)).toBe("unverified-legacy");
  });

  it("defaults a non-string value to unverified-legacy", () => {
    expect(normalizeCostDataProvenanceStatus(42)).toBe("unverified-legacy");
  });

  it("isCostDataProvenanceStatus rejects unknown values", () => {
    expect(isCostDataProvenanceStatus("verified")).toBe(false);
    expect(isCostDataProvenanceStatus("documented")).toBe(true);
  });
});

function fakeTrade(overrides: Partial<KnowledgeTrade>): KnowledgeTrade {
  return {
    id: "fake-trade",
    name: "Fake Trade",
    itemCount: 1,
    status: "Stable",
    coverage: "100%",
    notes: "",
    keywords: [],
    provenanceStatus: "unverified-legacy",
    ...overrides,
  };
}

describe("resolveTradeProvenanceStatus", () => {
  it("returns unverified-legacy when the trade name is null (could not be inferred)", () => {
    expect(resolveTradeProvenanceStatus(null, [fakeTrade({ name: "Concrete", provenanceStatus: "documented" })])).toBe("unverified-legacy");
  });

  it("returns unverified-legacy when the trade name does not match any known trade", () => {
    expect(resolveTradeProvenanceStatus("Nonexistent Trade", [fakeTrade({ name: "Concrete", provenanceStatus: "documented" })])).toBe(
      "unverified-legacy"
    );
  });

  it("returns the matched trade's own provenanceStatus", () => {
    expect(resolveTradeProvenanceStatus("Tree Service", [fakeTrade({ name: "Tree Service", provenanceStatus: "placeholder" })])).toBe(
      "placeholder"
    );
    expect(resolveTradeProvenanceStatus("Concrete", [fakeTrade({ name: "Concrete", provenanceStatus: "documented" })])).toBe("documented");
  });
});

describe("knowledge runtime provenance resolution (real Knowledge Engine data)", () => {
  const service = new KnowledgeRuntimeService();

  beforeEach(() => {
    resetKnowledgeRepositoryCache();
  });

  it("resolves every trade in trade-progress.json to a known provenance status", () => {
    const trades = service.listTrades();
    expect(trades.length).toBeGreaterThan(0);
    for (const trade of trades) {
      expect(isCostDataProvenanceStatus(trade.provenanceStatus)).toBe(true);
    }
  });

  it("resolves a Stable legacy trade (Concrete) to unverified-legacy, never documented", () => {
    const trades = service.listTrades();
    const concrete = trades.find((trade) => trade.name === "Concrete");
    expect(concrete?.provenanceStatus).toBe("unverified-legacy");

    const results = searchKnowledge({ query: "concrete driveway", type: "costItem", limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      if (result.trade === "Concrete") {
        expect(result.provenanceStatus).toBe("unverified-legacy");
      }
    }
  });

  it("resolves the Tree Service trade itself to placeholder, matching its self-declared PLACEHOLDER pricing", () => {
    // Trade-level resolution only: as of 2026-09-08, no cost item or assembly
    // record actually resolves trade === "Tree Service" at runtime. The
    // canonical exports/json/costbook.json export (which loader.ts reads for
    // costItems) never included the 25 staged Tree Service items in the
    // first place (see the 2026-09-08 audit), and the one related record —
    // the "Tree Service" group entry in assembly-index.json — is currently
    // misattributed to trade "Trim" by a pre-existing, unrelated substring
    // bug in inferTrade() (its description text contains "trimming", which
    // matches "Trim" before the trades array reaches "Tree Service"). Both
    // are pre-existing data/matching gaps, not something this provenance
    // slice introduced or is scoped to fix; they are recorded in
    // docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md's deferred
    // work. This test pins the one thing that IS correct today: the trade
    // record's own provenanceStatus, and resolveTradeProvenanceStatus's
    // logic (covered above) for whenever a Tree Service item does resolve.
    const trades = service.listTrades();
    const treeService = trades.find((trade) => trade.name === "Tree Service");
    expect(treeService?.provenanceStatus).toBe("placeholder");
  });

  it("surfaces a provenance review warning for a legacy-trade match, without implying verified pricing", () => {
    const result = matchScopeDeterministically({
      scopeText: "Tear out and replace 250 sq ft of cracked concrete driveway, 4 inch slab, broom finish.",
      limit: 5,
    });

    expect(result.detectedTrade).toBe("Concrete");
    expect(result.reviewWarnings.some((warning) => warning.toLowerCase().includes("unverified-legacy"))).toBe(true);
  });
});

describe("buildProvenanceWarning", () => {
  function fakeResult(overrides: Partial<KnowledgeSearchResult>): KnowledgeSearchResult {
    return {
      id: "fake-id",
      type: "costItem",
      name: "Fake Item",
      category: "Fake",
      trade: "Fake Trade",
      unitOfMeasure: "EA",
      description: "",
      confidence: 80,
      matchedKeywords: [],
      rationale: "",
      metadata: {},
      provenanceStatus: "documented",
      ...overrides,
    };
  }

  it("returns null when every match is documented", () => {
    const documented = [fakeResult({ provenanceStatus: "documented" })];
    expect(buildProvenanceWarning(documented, documented)).toBeNull();
  });

  it("returns null when there are no matches at all", () => {
    expect(buildProvenanceWarning([], [])).toBeNull();
  });

  it("names unverified-legacy when a legacy-status match is present", () => {
    const warning = buildProvenanceWarning([], [fakeResult({ provenanceStatus: "unverified-legacy" })]);
    expect(warning).toContain("unverified-legacy");
    expect(warning).not.toContain("placeholder");
  });

  it("names placeholder when a placeholder-status match is present", () => {
    const warning = buildProvenanceWarning([fakeResult({ provenanceStatus: "placeholder" })], []);
    expect(warning).toContain("placeholder");
    expect(warning).not.toContain("unverified-legacy");
  });

  it("names both statuses when both are present across assemblies and cost items", () => {
    const warning = buildProvenanceWarning(
      [fakeResult({ provenanceStatus: "placeholder" })],
      [fakeResult({ provenanceStatus: "unverified-legacy" })]
    );
    expect(warning).toContain("placeholder");
    expect(warning).toContain("unverified-legacy");
  });

  it("never affirmatively claims documented pricing is current, local, or nationally authoritative", () => {
    // A documented match produces no warning at all - silence, not an
    // affirmative "this is verified/current/local/authoritative" claim.
    // Confirm the function itself never emits those specific claims for
    // any input, so a future edit can't accidentally add one.
    for (const status of ["documented", "unverified-legacy", "placeholder"] as const) {
      const text = buildProvenanceWarning([fakeResult({ provenanceStatus: status })], []) ?? "";
      for (const forbiddenPhrase of ["is verified", "is current", "nationally authoritative", "locally accurate"]) {
        expect(text.toLowerCase()).not.toContain(forbiddenPhrase);
      }
    }
  });
});
