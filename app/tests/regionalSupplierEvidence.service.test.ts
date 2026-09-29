import { prepareRegionalSupplierEvidence } from "../modules/regional-supplier-evidence/service";
import type { IngestRegionalSupplierEvidenceInput } from "../modules/regional-supplier-evidence/types";

function input(overrides: Partial<IngestRegionalSupplierEvidenceInput> = {}): IngestRegionalSupplierEvidenceInput {
  return {
    orgId: "org-a",
    supplierId: "supplier-a",
    sourceFile: "regional-normalized.xlsx",
    products: [{
      supplierProductKey: "SKU-1",
      name: "Example material",
      canonicalMaterialKey: "example-material",
      availabilityStatus: "available",
    }],
    observations: [{
      observationKey: "obs-1",
      supplierProductKey: "SKU-1",
      observedAt: new Date("2026-09-19T00:00:00.000Z"),
      priceStatus: "priced",
      effectivePrice: 12.5,
    }],
    ...overrides,
  };
}

describe("regional supplier evidence preparation", () => {
  it("preserves unavailable observations without inventing a price", () => {
    const prepared = prepareRegionalSupplierEvidence(input({
      observations: [{
        observationKey: "carter-obs-1",
        supplierProductKey: "SKU-1",
        observedAt: new Date("2026-09-19T00:00:00.000Z"),
        priceStatus: "unavailable",
        eligibilityReason: "No public price returned",
      }],
    }));

    expect(prepared.observations).toHaveLength(1);
    expect(prepared.observations[0].priceStatus).toBe("unavailable");
    expect(prepared.observations[0].effectivePrice).toBeUndefined();
    expect(prepared.observations[0].eligibilityReason).toBe("No public price returned");
  });

  it("rejects duplicate supplier product keys", () => {
    expect(() => prepareRegionalSupplierEvidence(input({
      products: [
        { supplierProductKey: "SKU-1", name: "First" },
        { supplierProductKey: "SKU-1", name: "Second" },
      ],
    }))).toThrow("Duplicate supplier product key SKU-1");
  });

  it("rejects duplicate observation keys", () => {
    expect(() => prepareRegionalSupplierEvidence(input({
      observations: [
        { observationKey: "obs-1", supplierProductKey: "SKU-1", observedAt: new Date(), priceStatus: "priced" },
        { observationKey: "obs-1", supplierProductKey: "SKU-1", observedAt: new Date(), priceStatus: "priced" },
      ],
    }))).toThrow("Duplicate observation key obs-1");
  });
});
