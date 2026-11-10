import {
  buildCodeSourcesWhere,
  listCodeReferencesFromDb,
  mapCodeSourceToReference,
  type CodesSourceWithScope,
} from "../modules/costbook/codes/service";

function row(overrides: Partial<CodesSourceWithScope> = {}): CodesSourceWithScope {
  return {
    id: "94600003-0000-4000-8000-000000000001",
    jurisdictionId: "94600002-0000-4000-8000-000000000001",
    authorityId: "94600001-0000-4000-8000-000000000001",
    codeFamily: "UZO",
    section: "§16",
    citation: "Vigo County UZO §16",
    title: "Unified Zoning Ordinance — Sign Regulation",
    sourceUrl: "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf",
    sourceHash: null,
    licenseNote: null,
    publishedDate: new Date("1996-10-21T00:00:00.000Z"),
    amendedDate: null,
    effectiveDate: null,
    expiryDate: null,
    status: "reviewed",
    reviewedAt: new Date("2026-11-08T00:00:00.000Z"),
    reviewedBy: null,
    versionLabel: null,
    supersedesId: null,
    topics: ["signage", "permits"],
    summary: "The county-published ordinance includes a sign-regulation section.",
    nextAction: "Confirm the current amended ordinance with Vigo County Area Planning.",
    createdAt: new Date("2026-11-09T00:00:00.000Z"),
    updatedAt: new Date("2026-11-09T00:00:00.000Z"),
    authority: {
      id: "94600001-0000-4000-8000-000000000001",
      name: "Vigo County Area Planning",
      authorityKind: "county",
      state: "IN",
      county: "Vigo",
      sourceUrl: null,
      contact: null,
      createdAt: new Date("2026-11-09T00:00:00.000Z"),
      updatedAt: new Date("2026-11-09T00:00:00.000Z"),
    },
    jurisdiction: {
      id: "94600002-0000-4000-8000-000000000001",
      authorityId: "94600001-0000-4000-8000-000000000001",
      name: "Vigo County",
      jurisdictionKind: "county",
      state: "IN",
      county: "Vigo",
      gisRef: null,
      parentId: null,
      notes: null,
      createdAt: new Date("2026-11-09T00:00:00.000Z"),
      updatedAt: new Date("2026-11-09T00:00:00.000Z"),
    },
    ...overrides,
  } as CodesSourceWithScope;
}

describe("Codes & Permits DB registry service", () => {
  it("serves only reviewed sources in the requested state", () => {
    const where = buildCodeSourcesWhere({ state: "in" });
    expect(where.status).toBe("reviewed");
    expect(where.jurisdiction).toEqual({ state: "IN", county: null });
  });

  it("never returns another county's rules, and never inherits local rules without a county", () => {
    const vigo = buildCodeSourcesWhere({ state: "IN", county: "Vigo" });
    expect(vigo.jurisdiction).toEqual({
      state: "IN",
      OR: [{ county: null }, { county: { equals: "vigo", mode: "insensitive" } }],
    });
    const withSuffix = buildCodeSourcesWhere({ state: "IN", county: "Vigo County" });
    expect(withSuffix.jurisdiction).toEqual(vigo.jurisdiction);
    const marion = buildCodeSourcesWhere({ state: "IN", county: "Marion" });
    expect(marion.jurisdiction).toEqual({
      state: "IN",
      OR: [{ county: null }, { county: { equals: "marion", mode: "insensitive" } }],
    });
    const noCounty = buildCodeSourcesWhere({ state: "IN" });
    expect(noCounty.jurisdiction).toEqual({ state: "IN", county: null });
  });

  it("filters by topic and searches title, issuer, citation, summary and next action", () => {
    const where = buildCodeSourcesWhere({ state: "IN", county: "Vigo", topic: "electrical", q: "indiana" });
    expect(where.topics).toEqual({ has: "electrical" });
    expect(where.OR).toHaveLength(5);
    expect(where.OR).toContainEqual({ authority: { name: { contains: "indiana", mode: "insensitive" } } });
    expect(where.OR).toContainEqual({ title: { contains: "indiana", mode: "insensitive" } });
    expect(where.OR).toContainEqual({ citation: { contains: "indiana", mode: "insensitive" } });
    const blankQ = buildCodeSourcesWhere({ state: "IN", q: "   " });
    expect(blankQ.OR).toBeUndefined();
  });

  it("maps a DB row to the pilot API item, byte-identical in shape", () => {
    const item = mapCodeSourceToReference(row());
    expect(item).toEqual({
      id: "94600003-0000-4000-8000-000000000001",
      title: "Unified Zoning Ordinance — Sign Regulation",
      issuer: "Vigo County Area Planning",
      citation: "Vigo County UZO §16",
      state: "IN",
      county: "Vigo",
      sourceUrl: "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf",
      sourceDate: "1996-10-21",
      reviewedAt: "2026-11-08",
      topics: ["signage", "permits"],
      summary: "The county-published ordinance includes a sign-regulation section.",
      nextAction: "Confirm the current amended ordinance with Vigo County Area Planning.",
      applicability: "unverified",
    });
    expect("estimatedFee" in item).toBe(false);
    expect("price" in item).toBe(false);
  });

  it("maps statewide sources with null county/date and drops non-allowlisted topics", () => {
    const statewide = row();
    statewide.jurisdiction!.name = "Indiana";
    statewide.jurisdiction!.jurisdictionKind = "state";
    statewide.jurisdiction!.county = null;
    statewide.publishedDate = null;
    statewide.topics = ["electrical", "not-a-topic"];
    const item = mapCodeSourceToReference(statewide);
    expect(item.county).toBeNull();
    expect(item.sourceDate).toBeNull();
    expect(item.topics).toEqual(["electrical"]);
  });

  it("returns the advisory envelope with the pilot disclaimer and DB order", async () => {
    const first = row();
    const second = row({
      id: "94600003-0000-4000-8000-000000000006",
      citation: "INDOT — Above Ground Occupancy",
      title: "INDOT right-of-way occupancy permits",
    });
    const findMany = jest.fn().mockResolvedValue([first, second]);
    const result = await listCodeReferencesFromDb(
      { state: "IN", county: "Vigo", topic: "electrical" },
      { codesSource: { findMany } },
    );
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { authority: true, jurisdiction: true },
      orderBy: { id: "asc" },
    }));
    expect(findMany.mock.calls[0][0].where.status).toBe("reviewed");
    expect(result.status).toBe("advisory");
    expect(result.disclaimer).toMatch(/verify/i);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([
      "94600003-0000-4000-8000-000000000001",
      "94600003-0000-4000-8000-000000000006",
    ]);
    expect(result.items.every((item) => item.applicability === "unverified")).toBe(true);
  });
});
