import {
  JURISDICTION_DISCLAIMER,
  citationSourceHash,
  enrichCodeReferences,
  resolveAdvisoryJurisdiction,
  resolveSourceVersion,
  type EnrichableCodeReference,
  type JurisdictionInput,
  type KnownSourceVersion,
} from "../modules/costbook/codes/jurisdiction";

const fullJurisdiction: JurisdictionInput = {
  state: "IN",
  county: "Vigo",
  parcelId: "84-09-08-102-001.000-004",
  incorporated: false,
  zoningDistrict: "C-3",
  authorityName: "Vigo County Area Planning",
  authorityId: "vigo-area-planning",
  sourceCitation: "Vigo County UZO §16",
  sourceVersion: "1996-10-21 as amended",
  sourceEffectiveDate: "1996-10-21",
};

const sampleReference: EnrichableCodeReference = {
  id: "vigo-zoning-signs",
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
};

const knownVersions: KnownSourceVersion[] = [
  { citation: "Vigo County UZO §16", status: "current", effectiveDate: "1996-10-21", reviewedAt: "2026-11-08" },
  { citation: "675 IAC 13-2.6", status: "superseded", effectiveDate: "2014-12-01", supersededByCitation: "675 IAC 13-2.7", reviewedAt: "2026-11-08" },
  { citation: "675 IAC 13-2.7", status: "current", effectiveDate: "2020-01-01", reviewedAt: "2026-11-08" },
];

describe("Athena jurisdiction enrichment (fail-closed)", () => {
  it("resolves verified only when parcel, incorporated status, authority, citation, and version are all explicit", () => {
    const outcome = resolveAdvisoryJurisdiction(fullJurisdiction);
    expect(outcome.resolution).toBe("verified");
    expect(outcome.jurisdiction?.parcelId).toBe("84-09-08-102-001.000-004");
    expect(outcome.jurisdiction?.incorporated).toBe(false);
    expect(outcome.missing).toEqual([]);
    expect(outcome.whyItMatters).toMatch(/governing authority/i);
    expect(outcome.nextHumanAction).toMatch(/reconfirm/i);
  });

  it("treats unincorporated (false) as an explicit answer, not as missing", () => {
    expect(resolveAdvisoryJurisdiction({ ...fullJurisdiction, incorporated: false }).resolution).toBe("verified");
    expect(resolveAdvisoryJurisdiction({ ...fullJurisdiction, incorporated: true }).resolution).toBe("verified");
  });

  it("returns needs_verification for missing, stale, or ambiguous jurisdiction — never infers it", () => {
    const cases: JurisdictionInput[] = [
      { state: "IN", county: "Vigo" },
      { ...fullJurisdiction, parcelId: undefined },
      { ...fullJurisdiction, incorporated: null },
      { ...fullJurisdiction, authorityName: undefined },
      { ...fullJurisdiction, sourceVersion: undefined },
      { ...fullJurisdiction, sourceCitation: "   " },
      { state: "IN", county: "Vigo", parcelId: "84-09-08-102-001.000-004", incorporated: false },
    ];
    for (const input of cases) {
      const outcome = resolveAdvisoryJurisdiction(input);
      expect(outcome.resolution).toBe("needs_verification");
      expect(outcome.jurisdiction).toBeNull();
      expect(outcome.missing.length).toBeGreaterThan(0);
      expect(outcome.nextHumanAction).toMatch(/confirm/i);
    }
  });

  it("never verifies jurisdiction from county or state alone", () => {
    const outcome = resolveAdvisoryJurisdiction({ state: "IN", county: "Vigo", incorporated: false, authorityName: "Vigo County Area Planning" });
    expect(outcome.resolution).toBe("needs_verification");
    expect(outcome.missing).toContain("parcel identifier");
  });

  it("resolves a current source version from an exact citation match", () => {
    const outcome = resolveSourceVersion({ citation: "Vigo County UZO §16", sourceDate: "1996-10-21" }, knownVersions);
    expect(outcome.status).toBe("current");
    expect(outcome.matched?.citation).toBe("Vigo County UZO §16");
  });

  it("keeps superseded versions readable in history with their successor pointer", () => {
    const outcome = resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: "2014-12-01" }, knownVersions);
    expect(outcome.status).toBe("superseded");
    expect(outcome.matched).not.toBeNull();
    expect(outcome.matched?.status).toBe("superseded");
    expect(outcome.supersededByCitation).toBe("675 IAC 13-2.7");
    expect(outcome.nextHumanAction).toMatch(/675 IAC 13-2\.7/);
  });

  it("marks an unregistered citation unknown and a citation older than a known version stale", () => {
    const unknown = resolveSourceVersion({ citation: "Some County Ordinance §9", sourceDate: "2001-01-01" }, knownVersions);
    expect(unknown.status).toBe("unknown");
    expect(unknown.matched).toBeNull();
    expect(unknown.nextHumanAction).toMatch(/issuing authority/i);

    const stale = resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: "2014-12-01" }, [
      { citation: "675 IAC 13-2.9", status: "current", effectiveDate: "2024-01-01" },
    ]);
    expect(stale.status).toBe("stale");
  });

  it("returns stale for a reference older than the newest same-citation edition, not the first match", () => {
    const outcome = resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: "1996-10-21" }, [
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2014-12-01" },
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ]);
    expect(outcome.status).toBe("stale");
    expect(outcome.matched?.effectiveDate).toBe("2024-01-01");
  });

  it("returns current when the reference matches the newest same-citation edition, and when either date is null", () => {
    const newest = resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: "2024-01-01" }, [
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2014-12-01" },
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ]);
    expect(newest.status).toBe("current");
    expect(newest.matched?.effectiveDate).toBe("2024-01-01");

    // No dated staleness can be established without both dates.
    const undatedReference = resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: null }, [
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ]);
    expect(undatedReference.status).toBe("current");
    const undatedEntry = resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: "1996-10-21" }, [
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: null },
    ]);
    expect(undatedEntry.status).toBe("current");
  });

  it("returns unknown for an unrelated article that merely shares a leading number", () => {
    const outcome = resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: "2014-12-01" }, [
      { citation: "675 IAC 17-1", status: "current", effectiveDate: "2024-01-01" },
    ]);
    expect(outcome.status).toBe("unknown");
    expect(outcome.matched).toBeNull();
  });

  it("stores citation + source hash only — never full code text", () => {
    const hash = citationSourceHash("Vigo County UZO §16", "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(citationSourceHash("Vigo County UZO §16", "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf")).toBe(hash);
    expect(citationSourceHash("Vigo County UZO §5", "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf")).not.toBe(hash);
  });

  it("enriches advisory references without certifying anything", () => {
    const enriched = enrichCodeReferences([sampleReference], { state: "IN", county: "Vigo" }, knownVersions);
    expect(enriched.status).toBe("advisory");
    expect(enriched.disclaimer).toBe(JURISDICTION_DISCLAIMER);
    expect(enriched.disclaimer).toMatch(/No source link or AI message counts as a permit/);
    expect(enriched.total).toBe(1);
    expect(enriched.jurisdiction.resolution).toBe("needs_verification");
    const [item] = enriched.items;
    expect(item.applicability).toBe("unverified");
    expect(item.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(item.version.status).toBe("current");
    expect(item.whyItMatters).toMatch(/parcel jurisdiction/i);
    expect(item.nextHumanAction).toBe(sampleReference.nextAction);
    // No full-text field exists anywhere in the enriched payload.
    expect(JSON.stringify(enriched)).not.toContain("fullText");
    expect("fullText" in item).toBe(false);
  });

  it("enrichment keeps superseded sources visible with their version outcome", () => {
    const building = { ...sampleReference, id: "indiana-building-code", citation: "675 IAC 13-2.6", sourceDate: "2014-12-01" };
    const enriched = enrichCodeReferences([building], fullJurisdiction, knownVersions);
    expect(enriched.jurisdiction.resolution).toBe("verified");
    expect(enriched.items[0].version.status).toBe("superseded");
    expect(enriched.items[0].version.supersededByCitation).toBe("675 IAC 13-2.7");
    expect(enriched.items[0].applicability).toBe("unverified");
  });

  it("never verifies jurisdiction from a known superseded source", () => {
    const outcome = resolveAdvisoryJurisdiction(
      { ...fullJurisdiction, sourceCitation: "675 IAC 13-2.6", sourceVersion: "2014-12-01" },
      knownVersions,
    );
    expect(outcome.resolution).toBe("needs_verification");
    expect(outcome.jurisdiction).toBeNull();
    expect(outcome.missing.join(" ")).toMatch(/superseded by 675 IAC 13-2\.7/);
    expect(outcome.nextHumanAction).toMatch(/675 IAC 13-2\.7/);
  });

  it("keeps a current jurisdiction source verified when only unrelated items are superseded", () => {
    const building = { ...sampleReference, id: "indiana-building-code", citation: "675 IAC 13-2.6", sourceDate: "2014-12-01" };
    const enriched = enrichCodeReferences(
      [building],
      { ...fullJurisdiction, sourceCitation: "675 IAC 13-2.7", sourceVersion: "2020-01-01" },
      knownVersions,
    );
    expect(enriched.jurisdiction.resolution).toBe("verified");
    expect(enriched.items[0].version.status).toBe("superseded");
  });

  it("returns needs_verification when the input cites a stale edition the registry has newer", () => {
    const registry: KnownSourceVersion[] = [
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ];
    const outcome = resolveAdvisoryJurisdiction(
      { ...fullJurisdiction, sourceCitation: "675 IAC 13-2.6", sourceVersion: "2014-12-01", sourceEffectiveDate: "2014-12-01" },
      registry,
    );
    expect(outcome.resolution).toBe("needs_verification");
    expect(outcome.jurisdiction).toBeNull();
    expect(outcome.missing.join(" ")).toMatch(/newer 2024-01-01 edition/);
    // Same verdict as the version resolver for the same citation + date.
    expect(resolveSourceVersion({ citation: "675 IAC 13-2.6", sourceDate: "2014-12-01" }, registry).status).toBe("stale");
  });

  it("verifies the current edition when an older superseded entry shares the citation", () => {
    const registry: KnownSourceVersion[] = [
      { citation: "675 IAC 13-2.6", status: "superseded", effectiveDate: "2014-12-01", supersededByCitation: "675 IAC 13-2.6 (2024)" },
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ];
    const outcome = resolveAdvisoryJurisdiction(
      { ...fullJurisdiction, sourceCitation: "675 IAC 13-2.6", sourceVersion: "2024-01-01", sourceEffectiveDate: "2024-01-01" },
      registry,
    );
    expect(outcome.resolution).toBe("verified");
    expect(outcome.jurisdiction?.sourceCitation).toBe("675 IAC 13-2.6");
  });

  it("keeps an equal-date current edition verified", () => {
    const registry: KnownSourceVersion[] = [
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ];
    const outcome = resolveAdvisoryJurisdiction(
      { ...fullJurisdiction, sourceCitation: "675 IAC 13-2.6", sourceVersion: "2024-01-01", sourceEffectiveDate: "2024-01-01" },
      registry,
    );
    expect(outcome.resolution).toBe("verified");
  });

  it("returns needs_verification when the input names the superseded edition itself", () => {
    const registry: KnownSourceVersion[] = [
      { citation: "675 IAC 13-2.6", status: "superseded", effectiveDate: "2014-12-01", supersededByCitation: "675 IAC 13-2.6 (2024)" },
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ];
    const outcome = resolveAdvisoryJurisdiction(
      { ...fullJurisdiction, sourceCitation: "675 IAC 13-2.6", sourceVersion: "2014-12-01", sourceEffectiveDate: "2014-12-01" },
      registry,
    );
    expect(outcome.resolution).toBe("needs_verification");
    expect(outcome.jurisdiction).toBeNull();
    // The superseded entry is reported, not the newest entry.
    expect(outcome.missing.join(" ")).toMatch(/superseded by 675 IAC 13-2\.6 \(2024\)/);
  });

  it("fails closed when the named edition cannot be matched and the citation has a superseded entry", () => {
    const registry: KnownSourceVersion[] = [
      { citation: "675 IAC 13-2.6", status: "superseded", effectiveDate: "2014-12-01", supersededByCitation: "675 IAC 13-2.6 (2024)" },
      { citation: "675 IAC 13-2.6", status: "current", effectiveDate: "2024-01-01" },
    ];
    const outcome = resolveAdvisoryJurisdiction(
      {
        ...fullJurisdiction,
        sourceCitation: "675 IAC 13-2.6",
        sourceVersion: "2014 edition",
        sourceEffectiveDate: undefined,
      },
      registry,
    );
    expect(outcome.resolution).toBe("needs_verification");
    expect(outcome.jurisdiction).toBeNull();
    expect(outcome.missing.join(" ")).toMatch(/superseded/);
  });
});
