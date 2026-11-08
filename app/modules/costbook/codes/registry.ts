/**
 * Reviewed index of official sources, not a permit determination or a code-text mirror.
 * Keep this registry independent of CostItem, Assembly, pricing and customer data.
 * Any new jurisdiction requires source/version review before publication.
 */
export type CodeTopic = "signage" | "permits" | "electrical" | "structural" | "right-of-way";

export interface CodeReference {
  id: string;
  title: string;
  issuer: string;
  citation: string;
  state: "IN";
  county: "Vigo" | null;
  sourceUrl: string;
  sourceDate: string | null;
  reviewedAt: string;
  topics: readonly CodeTopic[];
  summary: string;
  nextAction: string;
  applicability: "unverified";
}

export interface CodeReferenceQuery {
  state: string;
  county?: string;
  topic?: CodeTopic;
  q?: string;
}

const REVIEW_DATE = "2026-11-08";

const references: readonly CodeReference[] = [
  {
    id: "vigo-zoning-signs",
    title: "Unified Zoning Ordinance — Sign Regulation",
    issuer: "Vigo County Area Planning",
    citation: "Vigo County UZO §16",
    state: "IN",
    county: "Vigo",
    sourceUrl: "https://www.vigocounty.in.gov/egov/apps/document/center.egov?id=47&view=item",
    sourceDate: "1996-10-21",
    reviewedAt: REVIEW_DATE,
    topics: ["signage", "permits"],
    summary: "The county-published ordinance includes a sign-regulation section. Publication does not establish whether later amendments or parcel-specific restrictions apply.",
    nextAction: "Confirm the current amended ordinance, zoning district, sign classification, height and setback with Vigo County Area Planning before bidding or installing.",
    applicability: "unverified",
  },
  {
    id: "vigo-zoning-permits",
    title: "Unified Zoning Ordinance — Permits",
    issuer: "Vigo County Area Planning",
    citation: "Vigo County UZO §5",
    state: "IN",
    county: "Vigo",
    sourceUrl: "https://www.vigocounty.in.gov/egov/apps/document/center.egov?id=47&view=item",
    sourceDate: "1996-10-21",
    reviewedAt: REVIEW_DATE,
    topics: ["permits", "signage", "structural"],
    summary: "The county-published zoning ordinance contains permit provisions. The correct review office and current application requirements depend on the parcel and proposed work.",
    nextAction: "Ask the appropriate local permit office which zoning, building and sign permits and inspections are required for the specific project.",
    applicability: "unverified",
  },
  {
    id: "indiana-building-code",
    title: "Indiana Building Code — state adoption register",
    issuer: "Indiana Department of Homeland Security",
    citation: "675 IAC 13-2.6",
    state: "IN",
    county: null,
    sourceUrl: "https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/",
    sourceDate: "2014-12-01",
    reviewedAt: REVIEW_DATE,
    topics: ["structural", "permits"],
    summary: "The official state rules listing identifies the adopted building-code edition. Proposed replacement codes are not automatically current or applicable.",
    nextAction: "Confirm the adopted edition on the job date and obtain the required structural design and local building review for the proposed sign foundation.",
    applicability: "unverified",
  },
  {
    id: "indiana-electrical-code",
    title: "Indiana Electrical Code — state adoption register",
    issuer: "Indiana Department of Homeland Security",
    citation: "675 IAC 17-1.8",
    state: "IN",
    county: null,
    sourceUrl: "https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/",
    sourceDate: "2009-08-26",
    reviewedAt: REVIEW_DATE,
    topics: ["electrical", "permits"],
    summary: "The official state rules listing identifies the adopted electrical code. It does not approve any specific wiring method or installation.",
    nextAction: "Confirm current adoption, conductor and protection requirements, authorized installer, circuit design and inspections with the electrical authority.",
    applicability: "unverified",
  },
  {
    id: "indot-sign-permits",
    title: "INDOT outdoor advertising sign permits",
    issuer: "Indiana Department of Transportation",
    citation: "INDOT — Outdoor Advertising Sign Permits",
    state: "IN",
    county: null,
    sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/permits/",
    sourceDate: null,
    reviewedAt: REVIEW_DATE,
    topics: ["signage", "permits", "right-of-way"],
    summary: "INDOT regulates qualifying outdoor signs along designated control routes. On-premises and off-premises sign classifications can differ; proximity to a state road alone does not determine the permit.",
    nextAction: "Confirm the control route, property boundary, right-of-way and on-premises classification with INDOT District Permits before selecting a sign location.",
    applicability: "unverified",
  },
  {
    id: "indot-occupancy",
    title: "INDOT right-of-way occupancy permits",
    issuer: "Indiana Department of Transportation",
    citation: "INDOT — Above Ground Occupancy",
    state: "IN",
    county: null,
    sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/permits/",
    sourceDate: null,
    reviewedAt: REVIEW_DATE,
    topics: ["right-of-way", "electrical", "permits"],
    summary: "INDOT lists permitting for qualifying above-ground installations within state right-of-way. A private fence-side run is not automatically an INDOT occupancy project.",
    nextAction: "Identify surveyed right-of-way and utility/easement boundaries; verify occupancy and electrical approval for the proposed route before installation.",
    applicability: "unverified",
  },
];

export function listCodeReferences(query: CodeReferenceQuery): {
  status: "advisory";
  disclaimer: string;
  items: CodeReference[];
  total: number;
} {
  const state = query.state.trim().toUpperCase();
  const county = (query.county ?? "").trim().toLowerCase().replace(/ county$/, "");
  const term = (query.q ?? "").trim().toLowerCase();
  const items = references.filter((reference) => {
    if (state !== reference.state) return false;
    if (reference.county && reference.county.toLowerCase() !== county) return false;
    if (query.topic && !reference.topics.includes(query.topic)) return false;
    if (!term) return true;
    return [reference.title, reference.issuer, reference.citation, reference.summary, reference.nextAction]
      .some((value) => value.toLowerCase().includes(term));
  });
  return {
    status: "advisory",
    disclaimer: "Source links are research leads only. Verify current amendments, parcel jurisdiction, code edition and permit applicability with the authority having jurisdiction before construction or pricing.",
    items,
    total: items.length,
  };
}
