import { listCodeReferences, type CodeReferenceQuery } from "../modules/costbook/codes/registry";

const vigoSign: CodeReferenceQuery = { state: "IN", county: "Vigo", topic: "signage" };

describe("Costbook Codes & Permits reference catalog", () => {
  it("returns linked authoritative sources for a Vigo County sign search", () => {
    const result = listCodeReferences(vigoSign);
    expect(result.items.length).toBeGreaterThan(1);
    expect(result.items.some((item) => item.citation === "Vigo County UZO §16")).toBe(true);
    expect(result.items.some((item) => item.issuer === "Indiana Department of Transportation")).toBe(true);
    // Pin the published county ordinance PDF, not a CMS page that may redirect or deny access.
    const vigoSources = result.items.filter((item) => item.county === "Vigo");
    expect(vigoSources).toHaveLength(2);
    expect(vigoSources.every((item) =>
      item.sourceUrl === "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf"
    )).toBe(true);
    for (const item of result.items) {
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.applicability).toBe("unverified");
      expect("estimatedFee" in item).toBe(false);
    }
  });

  it("never returns Vigo-specific rules for a different county or state", () => {
    const otherIndiana = listCodeReferences({ state: "IN", county: "Marion", topic: "signage" });
    expect(otherIndiana.items.every((item) => item.county === null)).toBe(true);
    const otherState = listCodeReferences({ state: "IL", county: "Vigo", topic: "signage" });
    expect(otherState.items).toHaveLength(0);
  });

  it("does not assign parcel-specific compliance, approval, costs or permit status", () => {
    const result = listCodeReferences(vigoSign);
    expect(result.disclaimer).toMatch(/verify/i);
    expect(result.status).toBe("advisory");
    expect(result.items.every((item) => item.nextAction.length > 10)).toBe(true);
  });

  it("filters by topic and case-insensitive text without changing source order", () => {
    const electrical = listCodeReferences({ state: "IN", county: "Vigo", topic: "electrical", q: "Indiana" });
    expect(electrical.items.some((item) => item.citation === "675 IAC 17-1.8")).toBe(true);
    expect(electrical.items.every((item) => item.topics.includes("electrical"))).toBe(true);
    const noMatch = listCodeReferences({ state: "IN", county: "Vigo", q: "unfindable-does-not-exist" });
    expect(noMatch.items).toHaveLength(0);
  });

  it("returns only statewide sources without an explicitly selected county", () => {
    const result = listCodeReferences({ state: "IN", topic: "signage" });
    expect(result.items.every((item) => item.county === null)).toBe(true);
  });
});
