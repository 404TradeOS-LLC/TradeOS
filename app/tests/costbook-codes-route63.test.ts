/**
 * Route 63 acceptance case (issue #946).
 *
 * Given an approximate State Road 63 business-sign replacement request
 * (~20 ft sign, ~250 ft electrical path near a fence, intended hand-mixed
 * footing), TradeOS must NOT infer setback, footing diameter/depth, wiring
 * method, or permit fee. It must identify the open questions (local sign
 * district/zoning, height, private property/INDOT ROW, sign type, structural
 * engineering/foundation, electrical listing, authorized connection), cite
 * the authorities, and require verified survey/site approval before any firm
 * compliant installation is quoted.
 *
 * Site facts below are the verified research facts (Vigo Beacon GIS parcel
 * 84-09-08-102-001.000-004, 4050 S. State Road 63, Terre Haute, IN 47802,
 * 1.58 ac, C-3, owner John & Cathy Crowell). Everything not verified —
 * incorporated status, sign category, surveyed ROW, sign details, electrical
 * connection — is left unknown on purpose: the test proves the matcher
 * refuses to fill those gaps.
 *
 * Fixture records mirror the pilot registry's reviewed references
 * (docs/architecture/COSTBOOK_CODES_PERMITS_PILOT.md) in TODO 2 record
 * shape; they are test fixtures, not a second registry.
 */
import { resolveJurisdiction } from "../modules/costbook/codes/jurisdiction";
import type { JurisdictionRecord, SiteInput } from "../modules/costbook/codes/types";

const NOW = new Date("2026-11-09T12:00:00.000Z");

const ROUTE_63_SITE: SiteInput = {
  parcelId: "84-09-08-102-001.000-004",
  siteAddress: "4050 S. State Road 63, Terre Haute, IN 47802",
  city: "Terre Haute",
  county: "Vigo",
  state: "IN",
  incorporated: null,
  zoningDistrict: null,
  signCategory: null,
  nearStateRoad: true,
  crossesRoadEdge: null,
  rightOfWayBoundaryVerified: false,
  signDetailsVerified: false,
  electricalConnectionVerified: false,
};

const ROUTE_63_WORK =
  "business sign replacement, ~20 ft sign, ~250 ft electrical path near fence, hand-mixed footing";

/** Reviewed references, in TODO 2 record shape (pilot registry provenance). */
const ROUTE_63_RECORDS: JurisdictionRecord[] = [
  {
    id: "vigo-zoning-signs",
    authority: "Vigo County Area Planning",
    level: "county",
    state: "IN",
    county: "Vigo",
    municipality: null,
    status: "reviewed",
    reviewedAt: "2026-11-08T00:00:00.000Z",
    effectiveFrom: null,
    expiresAt: null,
    topics: ["signage", "permits"],
    citation: "Vigo County UZO §16",
    sourceUrl: "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf",
  },
  {
    id: "vigo-zoning-permits",
    authority: "Vigo County Area Planning",
    level: "county",
    state: "IN",
    county: "Vigo",
    municipality: null,
    status: "reviewed",
    reviewedAt: "2026-11-08T00:00:00.000Z",
    effectiveFrom: null,
    expiresAt: null,
    topics: ["permits", "signage", "structural"],
    citation: "Vigo County UZO §5",
    sourceUrl: "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf",
  },
  {
    id: "indiana-building-code",
    authority: "Indiana Department of Homeland Security",
    level: "state",
    state: "IN",
    county: null,
    municipality: null,
    status: "reviewed",
    reviewedAt: "2026-11-08T00:00:00.000Z",
    effectiveFrom: null,
    expiresAt: null,
    topics: ["structural", "permits"],
    citation: "675 IAC 13-2.6",
    sourceUrl: "https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/",
  },
  {
    id: "indiana-electrical-code",
    authority: "Indiana Department of Homeland Security",
    level: "state",
    state: "IN",
    county: null,
    municipality: null,
    status: "reviewed",
    reviewedAt: "2026-11-08T00:00:00.000Z",
    effectiveFrom: null,
    expiresAt: null,
    topics: ["electrical", "permits"],
    citation: "675 IAC 17-1.8",
    sourceUrl: "https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/",
  },
  {
    id: "indot-sign-permits",
    authority: "Indiana Department of Transportation",
    level: "state",
    state: "IN",
    county: null,
    municipality: null,
    status: "reviewed",
    reviewedAt: "2026-11-08T00:00:00.000Z",
    effectiveFrom: null,
    expiresAt: null,
    topics: ["signage", "permits", "right-of-way"],
    citation: "INDOT — Outdoor Advertising Sign Permits",
    sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/permits/",
  },
  {
    id: "indot-occupancy",
    authority: "Indiana Department of Transportation",
    level: "state",
    state: "IN",
    county: null,
    municipality: null,
    status: "reviewed",
    reviewedAt: "2026-11-08T00:00:00.000Z",
    effectiveFrom: null,
    expiresAt: null,
    topics: ["right-of-way", "electrical", "permits"],
    citation: "INDOT — Above Ground Occupancy",
    sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/permits/",
  },
];

describe("Route 63 acceptance case", () => {
  it("does not infer setback, footing, wiring, or fee, and names every open question", () => {
    const resolution = resolveJurisdiction(ROUTE_63_SITE, ROUTE_63_RECORDS, ROUTE_63_WORK, NOW);

    expect(resolution.outcome).toBe("needs_verification");
    expect(resolution.matched).toEqual([]);
    expect(resolution.workType).toBe(ROUTE_63_WORK);

    // The seven open-question topics from issue #946.
    const questions = resolution.openQuestions.join(" ");
    expect(questions).toMatch(/zoning district/);
    expect(questions).toMatch(/sign height/);
    expect(questions).toMatch(/private property/);
    expect(questions).toMatch(/right-of-way/);
    expect(questions).toMatch(/on-premises or off-premises/);
    expect(questions).toMatch(/structural engineering/);
    expect(questions).toMatch(/foundation\/footing design/);
    expect(questions).toMatch(/electrical listing/);
    expect(questions).toMatch(/authorized installer/);
    expect(questions).toMatch(/authorized connection/);

    // The matcher distinguishes the verified parcel boundary from the
    // unverified road right-of-way instead of conflating them.
    expect(resolution.distinctions.parcelBoundary).toBe("verified");
    expect(resolution.distinctions.rightOfWay).toBe("unknown");
    expect(resolution.distinctions.incorporatedStatus).toBe("unknown");
    expect(resolution.distinctions.zoningOverlays).toBe("unknown");
    expect(resolution.distinctions.signCategory).toBe("unknown");

    // Authorities are cited for follow-up; none is presented as a ruling.
    const citedIds = resolution.citations.map((citation) => citation.source_id);
    expect(citedIds).toEqual(
      expect.arrayContaining([
        "vigo-zoning-signs",
        "indiana-building-code",
        "indiana-electrical-code",
        "indot-sign-permits",
        "indot-occupancy",
      ]),
    );
    for (const citation of resolution.citations) {
      expect(citation.rationale).toMatch(/not sufficient on its own/);
    }

    // No inferred rule values anywhere in the result.
    expect(Object.keys(resolution)).not.toContain("setback");
    expect(Object.keys(resolution)).not.toContain("footingDiameter");
    expect(Object.keys(resolution)).not.toContain("footingDepth");
    expect(Object.keys(resolution)).not.toContain("wiringMethod");
    expect(Object.keys(resolution)).not.toContain("permitFee");
    expect(JSON.stringify(resolution)).not.toMatch(/"setback"|"footingDiameter"|"footingDepth"|"wiringMethod"|"permitFee"/);
    // And no numeric measurement is asserted as a resolved value: the
    // request's ~20 ft / ~250 ft figures live only in the contractor's own
    // work-type description, never as a matcher output.
    const { workType, ...resolved } = resolution;
    expect(workType).toBe(ROUTE_63_WORK);
    expect(JSON.stringify(resolved)).not.toMatch(/20\s*ft|250\s*ft/);
  });

  it("requires verified survey/site approval before a firm compliant installation can be quoted", () => {
    const resolution = resolveJurisdiction(ROUTE_63_SITE, ROUTE_63_RECORDS, ROUTE_63_WORK, NOW);
    expect(resolution.reasons).toEqual(
      expect.arrayContaining([
        "incorporated_status_unknown",
        "zoning_district_unknown",
        "right_of_way_unverified",
        "sign_category_unknown",
        "sign_details_unverified",
        "electrical_connection_unverified",
      ]),
    );
    // Even the old (1996) county ordinance on file does not certify the job:
    // the resolution never claims a rule applies.
    expect(resolution.outcome).toBe("needs_verification");
  });
});
