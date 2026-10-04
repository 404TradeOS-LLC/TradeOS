import {
  priceFreshness,
  resolvePrice,
  type PriceEvidenceCandidate,
} from "../modules/costbook/priceResolver";

const now = new Date("2026-10-02T12:00:00.000Z");
const base: PriceEvidenceCandidate = {
  id: "base",
  canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
  price: 4.5,
  currency: "USD",
  unit: "EACH",
  evidenceTier: "RECENT_RETAIL_VALIDATION",
  confidence: "MEDIUM",
  observedAt: new Date("2026-10-01T12:00:00.000Z"),
  tenantId: "org-a",
  supplierName: "Retail Supplier",
  postalCode: "47802",
  source: "manual_spot_check",
  verifiedVsInferred: "observed",
};

describe("Costbook PriceResolver", () => {
  it("selects a contractor actual over a cheaper retail observation", () => {
    const resolved = resolvePrice({
      tenantId: "org-a",
      canonicalMaterialKey: base.canonicalMaterialKey,
      unit: "EACH",
      postalCode: "47802",
      now,
      candidates: [
        { ...base, id: "retail", price: 3.99 },
        {
          ...base,
          id: "actual",
          price: 4.18,
          evidenceTier: "ACTUAL_CONTRACTOR_PURCHASE",
          confidence: "HIGH",
          source: "qbo_purchase",
        },
      ],
    });
    expect(resolved).not.toBeNull();
    expect(resolved?.selectedPrice).toBe(4.18);
    expect(resolved?.evidenceTier).toBe("ACTUAL_CONTRACTOR_PURCHASE");
    expect(resolved?.oneLineProvenance).toContain("Retail Supplier");
    expect(resolved?.alternatives[0].price).toBe(3.99);
  });

  it("excludes cross-tenant, stale, and incompatible-unit evidence", () => {
    const resolved = resolvePrice({
      tenantId: "org-a",
      canonicalMaterialKey: base.canonicalMaterialKey,
      unit: "EACH",
      now,
      candidates: [
        { ...base, id: "foreign", tenantId: "org-b", price: 1 },
        { ...base, id: "stale", observedAt: new Date("2026-01-01T00:00:00.000Z"), price: 2 },
        { ...base, id: "wrong-unit", unit: "BUNDLE", price: 3 },
        { ...base, id: "valid", price: 4.25 },
      ],
    });
    expect(resolved?.selectedPrice).toBe(4.25);
    expect(resolved?.alternatives).toHaveLength(0);
  });

  it("applies the governed freshness windows", () => {
    expect(priceFreshness("RECENT_RETAIL_VALIDATION", new Date("2026-09-10T12:00:00.000Z"), now)).toBe("current");
    expect(priceFreshness("RECENT_RETAIL_VALIDATION", new Date("2026-08-10T12:00:00.000Z"), now)).toBe("warn");
    expect(priceFreshness("RECENT_RETAIL_VALIDATION", new Date("2026-06-30T12:00:00.000Z"), now)).toBe("reject");
    expect(priceFreshness("AUTHORIZED_LOCAL_SUPPLIER_PRICE", new Date("2026-09-22T12:00:00.000Z"), now)).toBe("warn");
  });

  it("marks inferred selections in the trust response", () => {
    const resolved = resolvePrice({
      tenantId: "org-a",
      canonicalMaterialKey: base.canonicalMaterialKey,
      now,
      candidates: [{
        ...base,
        id: "regional",
        tenantId: null,
        evidenceTier: "REGIONAL_MODEL",
        confidence: "LOW",
        verifiedVsInferred: "inferred",
      }],
    });
    expect(resolved?.warnings).toContain("Selected price is inferred rather than directly observed.");
  });
});
