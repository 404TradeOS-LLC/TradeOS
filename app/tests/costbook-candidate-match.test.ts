import {
  analyzeCandidateMatch,
  normalizeMatchName,
  type CandidateMatchSubject,
  type ExistingCostbookItem,
} from "../modules/costbook/candidateMatch";

function subject(overrides: Partial<CandidateMatchSubject> = {}): CandidateMatchSubject {
  return {
    itemName: "3-5/8 Inch 20 Gauge Steel Stud Install",
    unitOfMeasure: "LF",
    proposedUnitCost: 2.5,
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingCostbookItem> = {}): ExistingCostbookItem {
  return {
    id: "cost-item-1",
    code: "CI-001",
    name: "3-5/8 Inch 20 Gauge Steel Stud Install",
    unitOfMeasure: "LF",
    currentUnitCost: 2,
    isActive: true,
    ...overrides,
  };
}

describe("normalizeMatchName", () => {
  it("compares names ignoring case, punctuation, and spacing", () => {
    expect(normalizeMatchName("3-5/8 Inch  Steel Stud")).toBe(normalizeMatchName("3 5 8 inch steel stud"));
  });

  it("does not collapse genuinely different names", () => {
    expect(normalizeMatchName("20 Gauge Stud")).not.toBe(normalizeMatchName("25 Gauge Stud"));
  });
});

describe("analyzeCandidateMatch", () => {
  it("reports a new candidate when nothing in the catalog shares the name", () => {
    const result = analyzeCandidateMatch(subject(), [existing({ name: "Completely Different Item" })]);

    expect(result.status).toBe("new-candidate");
    expect(result.bestMatch).toBeNull();
  });

  it("reports a probable match with a signed price delta when exactly one item matches", () => {
    const result = analyzeCandidateMatch(subject({ proposedUnitCost: 2.5 }), [existing({ currentUnitCost: 2 })]);

    expect(result.status).toBe("probable-match");
    expect(result.bestMatch).not.toBeNull();
    expect(result.bestMatch!.costItemId).toBe("cost-item-1");
    expect(result.bestMatch!.priceDelta).toBe(0.5);
    expect(result.bestMatch!.priceDeltaPct).toBe(25);
  });

  it("reports a negative delta when the candidate is cheaper than the catalog", () => {
    const result = analyzeCandidateMatch(subject({ proposedUnitCost: 1.5 }), [existing({ currentUnitCost: 2 })]);

    expect(result.bestMatch!.priceDelta).toBe(-0.5);
    expect(result.bestMatch!.priceDeltaPct).toBe(-25);
  });

  it("never names a best match when several items match equally well", () => {
    const result = analyzeCandidateMatch(subject(), [
      existing({ id: "a", code: "CI-A" }),
      existing({ id: "b", code: "CI-B" }),
    ]);

    expect(result.status).toBe("ambiguous-match");
    // The whole point: promotion must not silently pick one of them.
    expect(result.bestMatch).toBeNull();
    expect(result.comparisons).toHaveLength(2);
  });

  it("reports a conflict when the same name is priced in a different unit", () => {
    const result = analyzeCandidateMatch(subject({ unitOfMeasure: "LF" }), [existing({ unitOfMeasure: "EA" })]);

    expect(result.status).toBe("conflict");
    expect(result.bestMatch).toBeNull();
    expect(result.rationale).toMatch(/not comparable/);
  });

  it("ignores deactivated catalog rows when matching", () => {
    const result = analyzeCandidateMatch(subject(), [existing({ isActive: false })]);

    expect(result.status).toBe("new-candidate");
  });

  it("reports a null percentage rather than infinity when the current price is zero", () => {
    const result = analyzeCandidateMatch(subject({ proposedUnitCost: 3 }), [existing({ currentUnitCost: 0 })]);

    expect(result.bestMatch!.priceDelta).toBe(3);
    expect(result.bestMatch!.priceDeltaPct).toBeNull();
  });

  it("reports null deltas when the existing unit cost could not be computed", () => {
    const result = analyzeCandidateMatch(subject(), [existing({ currentUnitCost: null })]);

    expect(result.bestMatch!.currentUnitCost).toBeNull();
    expect(result.bestMatch!.priceDelta).toBeNull();
    expect(result.bestMatch!.priceDeltaPct).toBeNull();
  });

  it("matches names that differ only in punctuation and case", () => {
    const result = analyzeCandidateMatch(subject({ itemName: "3 5/8 inch 20 gauge STEEL stud install" }), [existing()]);

    expect(result.status).toBe("probable-match");
  });

  it("treats unit of measure case-insensitively", () => {
    const result = analyzeCandidateMatch(subject({ unitOfMeasure: "lf" }), [existing({ unitOfMeasure: "LF" })]);

    expect(result.status).toBe("probable-match");
  });

  it("returns a new-candidate result for an empty catalog", () => {
    const result = analyzeCandidateMatch(subject(), []);

    expect(result.status).toBe("new-candidate");
    expect(result.comparisons).toEqual([]);
  });
});
