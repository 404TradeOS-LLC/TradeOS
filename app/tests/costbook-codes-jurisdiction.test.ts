/**
 * Jurisdiction matcher unit tests (issue #946, TODO 4).
 * Pure-function tests: no database, no network. Every fail-closed rule is
 * covered — verified match, ambiguous authority, missing parcel, stale
 * records, ROW/easement distinction, incorporated vs unincorporated — plus
 * the invariant that no setback, footing size, wiring method, or permit fee
 * is ever inferred.
 */
import { resolveJurisdiction } from "../modules/costbook/codes/jurisdiction";
import type { JurisdictionRecord, SiteInput } from "../modules/costbook/codes/types";

const NOW = new Date("2026-11-09T12:00:00.000Z");

function record(overrides: Partial<JurisdictionRecord> = {}): JurisdictionRecord {
  return {
    id: "rec-state",
    authority: "Indiana Department of Homeland Security",
    level: "state",
    state: "IN",
    county: null,
    municipality: null,
    status: "reviewed",
    reviewedAt: "2026-11-08T00:00:00.000Z",
    effectiveFrom: null,
    expiresAt: null,
    topics: ["permits", "structural", "electrical"],
    citation: "675 IAC 13-2.6",
    sourceUrl: "https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/",
    ...overrides,
  };
}

function municipalRecord(overrides: Partial<JurisdictionRecord> = {}): JurisdictionRecord {
  return record({
    id: "rec-municipal",
    authority: "City of Terre Haute",
    level: "municipal",
    county: "Vigo",
    municipality: "Terre Haute",
    topics: ["signage", "permits"],
    citation: "Terre Haute Municipal Code — Signs",
    sourceUrl: "https://www.terrehaute.in.gov/",
    ...overrides,
  });
}

function countyRecord(overrides: Partial<JurisdictionRecord> = {}): JurisdictionRecord {
  return record({
    id: "rec-county",
    authority: "Vigo County Area Planning",
    level: "county",
    county: "Vigo",
    municipality: null,
    topics: ["signage", "permits", "structural"],
    citation: "Vigo County UZO §16",
    sourceUrl: "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf",
    ...overrides,
  });
}

function verifiedSite(overrides: Partial<SiteInput> = {}): SiteInput {
  return {
    parcelId: "84-09-08-102-001.000-004",
    siteAddress: "4050 S. State Road 63, Terre Haute, IN 47802",
    city: "Terre Haute",
    county: "Vigo",
    state: "IN",
    incorporated: true,
    zoningDistrict: "C-3",
    signCategory: "on-premises",
    nearStateRoad: false,
    crossesRoadEdge: false,
    rightOfWayBoundaryVerified: null,
    signDetailsVerified: true,
    electricalConnectionVerified: true,
    ...overrides,
  };
}

const FORBIDDEN_KEYS = ["setback", "footingDiameter", "footingDepth", "wiringMethod", "permitFee"];

function expectNoInferredValues(resolution: ReturnType<typeof resolveJurisdiction>): void {
  for (const key of FORBIDDEN_KEYS) {
    expect(Object.keys(resolution)).not.toContain(key);
  }
  expect(JSON.stringify(resolution)).not.toMatch(/"setback"|"footingDiameter"|"footingDepth"|"wiringMethod"|"permitFee"/);
}

describe("resolveJurisdiction", () => {
  it("verifies a match when parcel, authority, incorporation, zoning, and topics are all established", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [record(), municipalRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("verified");
    expect(resolution.matched.map((item) => item.id)).toEqual(["rec-state", "rec-municipal"]);
    expect(resolution.reasons).toEqual(["verified_match"]);
    expect(resolution.openQuestions).toEqual([]);
    expect(resolution.distinctions).toEqual({
      parcelBoundary: "verified",
      rightOfWay: "not_applicable",
      incorporatedStatus: "verified",
      zoningOverlays: "verified",
      signCategory: "verified",
    });
    expect(resolution.citations).toHaveLength(2);
    expectNoInferredValues(resolution);
  });

  it("verifies an unincorporated site against the county record, not a municipal one", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ incorporated: false, city: null, signCategory: null }),
      [record(), countyRecord()],
      "roof repair",
      NOW,
    );
    expect(resolution.outcome).toBe("verified");
    expect(resolution.matched.map((item) => item.id)).toEqual(["rec-state", "rec-county"]);
    expect(resolution.distinctions.incorporatedStatus).toBe("verified");
    expect(resolution.distinctions.signCategory).toBe("not_applicable");
    expectNoInferredValues(resolution);
  });

  it("fails closed on ambiguous local authority instead of picking one", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [
        record(),
        municipalRecord(),
        municipalRecord({ id: "rec-municipal-2", authority: "Vigo County Area Planning" }),
      ],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.matched).toEqual([]);
    expect(resolution.reasons).toContain("ambiguous_local_authority");
    expect(resolution.openQuestions.join(" ")).toMatch(/More than one local authority/);
    expectNoInferredValues(resolution);
  });

  it("fails closed when no parcel, coordinates, or address identify the site", () => {
    const resolution = resolveJurisdiction({}, [record()], "sign replacement", NOW);
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_verifiable_site");
    expect(resolution.openQuestions.length).toBeGreaterThan(0);
    expectNoInferredValues(resolution);
  });

  it("fails closed when only a street address identifies the site — an address alone is not a parcel", () => {
    const resolution = resolveJurisdiction(
      { siteAddress: "4050 S. State Road 63, Terre Haute, IN 47802" },
      [record()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_verifiable_site");
    expect(resolution.openQuestions.join(" ")).toMatch(/verified parcel ID, or a verified site address with coordinates/);
    expectNoInferredValues(resolution);
  });

  it("accepts coordinates plus address as an identifiable site without a parcel id", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ parcelId: null, latitude: 39.4665, longitude: -87.413 }),
      [record(), municipalRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("verified");
    expect(resolution.reasons).not.toContain("no_verifiable_site");
    expect(resolution.distinctions.parcelBoundary).toBe("verified");
    expectNoInferredValues(resolution);
  });

  it("does not treat 'design' as signage work — the sign match needs word boundaries", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ signCategory: null, signDetailsVerified: false }),
      [record({ topics: ["permits"] }), municipalRecord({ topics: ["permits"] })],
      "kitchen design",
      NOW,
    );
    expect(resolution.outcome).toBe("verified");
    expect(resolution.reasons).not.toContain("sign_category_unknown");
    expect(resolution.reasons).not.toContain("sign_details_unverified");
    expect(resolution.distinctions.signCategory).toBe("not_applicable");
    expectNoInferredValues(resolution);
  });

  it("still treats standalone 'sign' and 'signage' as signage work", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ signCategory: null }),
      [record(), municipalRecord()],
      "signage install",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("sign_category_unknown");
    expectNoInferredValues(resolution);
  });

  it("fails closed when an incorporated site has no city — a missing municipality matches no record", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ city: null }),
      [record(), municipalRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_municipal_authority_record");
    expect(resolution.openQuestions.join(" ")).toMatch(/governing municipal authority/);
    expectNoInferredValues(resolution);
  });

  it("fails closed when an incorporated site has no county — a missing county matches no county-claiming record", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ county: null }),
      [record(), municipalRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_municipal_authority_record");
    expectNoInferredValues(resolution);
  });

  it("fails closed when an unincorporated site has no county", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ incorporated: false, city: null, county: null, signCategory: null }),
      [record(), countyRecord()],
      "roof repair",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_county_authority_record");
    expectNoInferredValues(resolution);
  });

  it("does not let an unmatched record cover a topic the work requires", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [
        record({ topics: ["permits"] }),
        municipalRecord({ topics: ["permits"] }),
        countyRecord({ topics: ["signage", "permits", "structural"] }),
      ],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("missing_topics:signage");
    expectNoInferredValues(resolution);
  });

  it("fails closed when every record is stale, superseded, or research-only", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [
        record({ status: "superseded" }),
        municipalRecord({ status: "stale" }),
        countyRecord({ status: "research" }),
      ],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_reviewed_current_records");
    expect(resolution.matched).toEqual([]);
    expectNoInferredValues(resolution);
  });

  it("fails closed when reviewed records expired before the job date", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [
        record({ expiresAt: "2026-11-01T00:00:00.000Z" }),
        municipalRecord({ expiresAt: "2026-11-01T00:00:00.000Z" }),
      ],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_reviewed_current_records");
    expect(resolution.reasons).toContain("unusable_record:rec-state:reviewed");
    expectNoInferredValues(resolution);
  });

  it("fails closed on the state scope when only the local record is current", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [record({ expiresAt: "2026-11-01T00:00:00.000Z" }), municipalRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_state_authority_record");
    expectNoInferredValues(resolution);
  });

  it("does not let a superseded record on file block a verified match from current records", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [record(), record({ id: "rec-old", status: "superseded" }), municipalRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("verified");
    expect(resolution.reasons).toContain("unusable_record:rec-old:superseded");
    expectNoInferredValues(resolution);
  });

  it("keeps the road edge distinct from the parcel boundary and the right-of-way", () => {
    const nearRoad = resolveJurisdiction(
      verifiedSite({ nearStateRoad: true, rightOfWayBoundaryVerified: false }),
      [record(), municipalRecord({ topics: ["signage", "permits", "right-of-way"] })],
      "sign replacement",
      NOW,
    );
    expect(nearRoad.outcome).toBe("needs_verification");
    expect(nearRoad.reasons).toContain("right_of_way_unverified");
    expect(nearRoad.openQuestions.join(" ")).toMatch(/surveyed right-of-way/);
    expect(nearRoad.openQuestions.join(" ")).toMatch(/private property/);
    expect(nearRoad.distinctions.rightOfWay).toBe("unknown");
    expect(nearRoad.distinctions.parcelBoundary).toBe("verified");
    expectNoInferredValues(nearRoad);

    const surveyed = resolveJurisdiction(
      verifiedSite({ nearStateRoad: true, rightOfWayBoundaryVerified: true }),
      [record(), municipalRecord({ topics: ["signage", "permits", "right-of-way"] })],
      "sign replacement",
      NOW,
    );
    expect(surveyed.outcome).toBe("verified");
    expect(surveyed.distinctions.rightOfWay).toBe("verified");
  });

  it("fails closed when incorporated status is unknown, even with a county record on file", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ incorporated: null }),
      [record(), countyRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("incorporated_status_unknown");
    expect(resolution.openQuestions.join(" ")).toMatch(/incorporated city\/town limits or on unincorporated county land/);
    expectNoInferredValues(resolution);
  });

  it("fails closed when an incorporated site has no municipal record", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [record(), countyRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("no_municipal_authority_record");
    expectNoInferredValues(resolution);
  });

  it("fails closed when the zoning district is unknown", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ zoningDistrict: null }),
      [record(), municipalRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("zoning_district_unknown");
    expectNoInferredValues(resolution);
  });

  it("never infers an on- vs off-premises sign category from highway proximity", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ signCategory: null, nearStateRoad: true, rightOfWayBoundaryVerified: true }),
      [record(), municipalRecord({ topics: ["signage", "permits", "right-of-way"] })],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("sign_category_unknown");
    expect(resolution.openQuestions.join(" ")).toMatch(/on-premises or off-premises/);
    expect(resolution.openQuestions.join(" ")).toMatch(/proximity to a state road alone does not decide it/);
    expectNoInferredValues(resolution);
  });

  it("fails closed on unverified sign height/structure and electrical connection", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ signDetailsVerified: false, electricalConnectionVerified: false }),
      [record(), municipalRecord()],
      "sign replacement with electrical run",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("sign_details_unverified");
    expect(resolution.reasons).toContain("electrical_connection_unverified");
    expect(resolution.openQuestions.join(" ")).toMatch(/sign height/);
    expect(resolution.openQuestions.join(" ")).toMatch(/structural engineering/);
    expect(resolution.openQuestions.join(" ")).toMatch(/authorized installer/);
    expectNoInferredValues(resolution);
  });

  it("fails closed when no record covers a topic the work requires", () => {
    const resolution = resolveJurisdiction(
      verifiedSite(),
      [record({ topics: ["permits"] }), municipalRecord({ topics: ["permits"] })],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toContain("missing_topics:signage");
    expectNoInferredValues(resolution);
  });

  it("accumulates every open question instead of stopping at the first failure", () => {
    const resolution = resolveJurisdiction(
      verifiedSite({ incorporated: null, zoningDistrict: null, signCategory: null, nearStateRoad: true, rightOfWayBoundaryVerified: false }),
      [record(), countyRecord()],
      "sign replacement",
      NOW,
    );
    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.reasons).toEqual(
      expect.arrayContaining([
        "incorporated_status_unknown",
        "zoning_district_unknown",
        "right_of_way_unverified",
        "sign_category_unknown",
      ]),
    );
    expect(resolution.openQuestions.length).toBeGreaterThanOrEqual(4);
    expectNoInferredValues(resolution);
  });
});
