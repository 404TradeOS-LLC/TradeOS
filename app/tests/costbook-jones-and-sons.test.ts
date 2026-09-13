import { costbookResearchCandidateSchema } from "../modules/costbook/candidateCostItem";
import {
  JONES_AND_SONS_READY_MIX_AVAILABILITY,
  JONES_AND_SONS_SOURCE_NAME,
  JONES_AND_SONS_TERRE_HAUTE_REGIONAL_BASIS,
  JONES_AND_SONS_UNCONFIRMED_REGIONAL_BASIS,
  OBSERVED_UNVERIFIED_RECORDS,
  TERRE_HAUTE_VERIFIED_RECORDS,
  buildAllJonesAndSonsCandidates,
  buildJonesAndSonsObservedCandidates,
  buildJonesAndSonsTerreHauteCandidates,
  dedupeJonesAndSonsCandidatesBySku,
  toJonesAndSonsCandidate,
  type JonesAndSonsRecord,
} from "../modules/costbook/jonesAndSonsTerreHaute";

describe("Jones & Sons Terre Haute candidate ingestion", () => {
  const retrievedAt = "2026-09-12T10:00:00.000Z";

  describe("branch verification", () => {
    it("marks only records with explicit branch evidence + a source URL as Terre Haute-verified", () => {
      const candidates = buildJonesAndSonsTerreHauteCandidates({ retrievedAt });
      expect(candidates).toHaveLength(2);
      for (const candidate of candidates) {
        expect(candidate.confidence).toBe("high");
        expect(candidate.regionalBasis).toBe(JONES_AND_SONS_TERRE_HAUTE_REGIONAL_BASIS);
        expect(candidate.sourceUrl).toMatch(/^https:\/\/jonesandsons\.com\/products\//);
      }
    });

    it("never labels a record Terre Haute-verified without both branch evidence and a source URL", () => {
      const candidates = buildJonesAndSonsObservedCandidates({ retrievedAt });
      expect(candidates).toHaveLength(6);
      for (const candidate of candidates) {
        expect(candidate.confidence).toBe("low");
        expect(candidate.regionalBasis).toBe(JONES_AND_SONS_UNCONFIRMED_REGIONAL_BASIS);
        expect(candidate.regionalBasis).not.toContain("Terre Haute branch");
        expect(candidate.sourceUrl).toBeUndefined();
      }
    });

    it("treats branch evidence text alone (without a source URL) as insufficient for verification", () => {
      const record: JonesAndSonsRecord = {
        supplierProductName: "Test Product",
        normalizedMaterialName: "Test Product",
        supplierSku: "TEST.01",
        trade: "Sitework",
        category: "Aggregate",
        price: 10,
        normalizedUnit: "ton",
        unitAssumed: false,
        terreHauteBranchEvidence: "Terre Haute pickup shown", // present, but no sourceUrl below
      };
      const candidate = toJonesAndSonsCandidate(record, { retrievedAt });
      expect(candidate.confidence).toBe("low");
      expect(candidate.regionalBasis).toBe(JONES_AND_SONS_UNCONFIRMED_REGIONAL_BASIS);
    });
  });

  describe("schema and provenance completeness", () => {
    it("produces candidates that satisfy the governed research-candidate contract", () => {
      for (const candidate of buildAllJonesAndSonsCandidates({ retrievedAt })) {
        const parsed = costbookResearchCandidateSchema.parse(candidate);
        expect(parsed.reviewStatus).toBe("candidate");
        expect(parsed.provenanceStatus).toBe("documented");
        expect(parsed.sourceName).toBe(JONES_AND_SONS_SOURCE_NAME);
        expect(parsed.retrievedAt).toBe(retrievedAt);
        expect(parsed.sourceDate).toBe("2026-09-12");
        expect(parsed.sourceUrl ?? parsed.sourceIdentifier).toBeTruthy();
        expect(parsed.researchNotes).toBeTruthy();
      }
    });

    it("carries the supplier SKU in sourceIdentifier for every candidate", () => {
      for (const candidate of buildAllJonesAndSonsCandidates({ retrievedAt })) {
        expect(candidate.sourceIdentifier).toMatch(/^Jones & Sons SKU /);
      }
    });

    it("never produces a candidate promotion-eligible on its own", () => {
      for (const candidate of buildAllJonesAndSonsCandidates({ retrievedAt })) {
        const parsed = costbookResearchCandidateSchema.parse(candidate);
        expect(parsed.reviewStatus).not.toBe("approved");
      }
    });
  });

  describe("price validation", () => {
    it("rejects a record with a non-positive price rather than importing it", () => {
      const badRecord: JonesAndSonsRecord = {
        supplierProductName: "Free Sample",
        normalizedMaterialName: "Free Sample",
        supplierSku: "FREE.01",
        trade: "Sitework",
        category: "Aggregate",
        price: 0,
        normalizedUnit: "ton",
        unitAssumed: false,
      };
      expect(() => toJonesAndSonsCandidate(badRecord)).toThrow(/non-positive price/);
    });

    it("rejects a negative price", () => {
      const badRecord: JonesAndSonsRecord = {
        supplierProductName: "Negative Price",
        normalizedMaterialName: "Negative Price",
        supplierSku: "NEG.01",
        trade: "Sitework",
        category: "Aggregate",
        price: -5,
        normalizedUnit: "ton",
        unitAssumed: false,
      };
      expect(() => toJonesAndSonsCandidate(badRecord)).toThrow(/non-positive price/);
    });
  });

  describe("unit handling", () => {
    it("flags every observed-record unit as assumed, never presented as confirmed", () => {
      for (const record of OBSERVED_UNVERIFIED_RECORDS) {
        expect(record.unitAssumed).toBe(true);
      }
      const candidates = buildJonesAndSonsObservedCandidates({ retrievedAt });
      for (const candidate of candidates) {
        expect(candidate.researchNotes).toContain("was not confirmed by the source and is assumed");
      }
    });

    it("does not flag Terre Haute-verified records' units as assumed", () => {
      for (const record of TERRE_HAUTE_VERIFIED_RECORDS) {
        expect(record.unitAssumed).toBe(false);
      }
    });
  });

  describe("deduplication", () => {
    it("keeps the highest-confidence observation when the same SKU appears twice", () => {
      const low = toJonesAndSonsCandidate(
        {
          supplierProductName: "Dup",
          normalizedMaterialName: "Dup",
          supplierSku: "DUP.01",
          trade: "Sitework",
          category: "Aggregate",
          price: 20,
          normalizedUnit: "ton",
          unitAssumed: true,
        },
        { retrievedAt }
      );
      const high = toJonesAndSonsCandidate(
        {
          supplierProductName: "Dup",
          normalizedMaterialName: "Dup",
          supplierSku: "DUP.01",
          trade: "Sitework",
          category: "Aggregate",
          price: 22,
          normalizedUnit: "ton",
          unitAssumed: false,
          sourceUrl: "https://jonesandsons.com/products/dup",
          terreHauteBranchEvidence: "Terre Haute pickup shown",
        },
        { retrievedAt }
      );

      const deduped = dedupeJonesAndSonsCandidatesBySku([low, high]);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].confidence).toBe("high");
      expect(deduped[0].materialCostTypical).toBe(22);
    });

    it("does not collapse the two real Terre Haute-verified records into each other", () => {
      const deduped = dedupeJonesAndSonsCandidatesBySku(buildJonesAndSonsTerreHauteCandidates({ retrievedAt }));
      expect(deduped).toHaveLength(2);
    });

    it("produces no duplicate SKUs across the full seed dataset", () => {
      const all = buildAllJonesAndSonsCandidates({ retrievedAt });
      const skus = all.map((c) => c.sourceIdentifier);
      expect(new Set(skus).size).toBe(skus.length);
    });
  });

  describe("ready-mix concrete", () => {
    it("is represented as quote-required availability, never a priced candidate", () => {
      expect(JONES_AND_SONS_READY_MIX_AVAILABILITY.price).toBeNull();
      expect(JONES_AND_SONS_READY_MIX_AVAILABILITY.pricingModel).toBe("per_yard_via_dispatch");
      expect(JONES_AND_SONS_READY_MIX_AVAILABILITY.supplierBranch).toBe("Terre Haute");
    });

    it("does not appear anywhere in the candidate-producing functions", () => {
      const all = buildAllJonesAndSonsCandidates({ retrievedAt });
      for (const candidate of all) {
        expect(candidate.itemName.toLowerCase()).not.toContain("ready mix");
      }
    });
  });

  describe("normalization", () => {
    it("preserves the original supplier product name in the candidate description", () => {
      const candidates = buildJonesAndSonsTerreHauteCandidates({ retrievedAt });
      expect(candidates[0].description).toContain('#8/CA-11 Crushed Limestone (1" to 1/2")');
      expect(candidates[0].description).toContain("XX8.07");
    });

    it("maps categories to existing trade conventions rather than inventing new ones", () => {
      const all = buildAllJonesAndSonsCandidates({ retrievedAt });
      const tradesUsed = new Set(all.map((c) => c.trade));
      expect(tradesUsed).toEqual(new Set(["Sitework", "Concrete", "Masonry"]));
    });
  });

  describe("real-corpus baseline", () => {
    it("pins the current seed dataset size so future edits are deliberate", () => {
      expect(TERRE_HAUTE_VERIFIED_RECORDS).toHaveLength(2);
      expect(OBSERVED_UNVERIFIED_RECORDS).toHaveLength(6);
      expect(buildAllJonesAndSonsCandidates({ retrievedAt })).toHaveLength(8);
    });
  });
});
