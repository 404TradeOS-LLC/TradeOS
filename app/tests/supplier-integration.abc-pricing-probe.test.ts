jest.mock("../db/client", () => ({
  prisma: {
    supplier: { findFirst: jest.fn() },
    supplierProduct: { findFirst: jest.fn(), count: jest.fn() },
    material: { count: jest.fn() },
    supplierPriceObservation: { count: jest.fn() },
  },
}));
jest.mock("../modules/supplier-integration/feed", () => ({
  priceOneAbcSandboxSku: jest.fn(),
}));

import { prisma } from "../db/client";
import { priceOneAbcSandboxSku } from "../modules/supplier-integration/feed";
import { probeAbcSandboxPricing } from "../modules/supplier-integration/abcPricingProbe";

const orgId = "6d9fbc90-e4db-45b5-b6c7-852def03695a";
const supplierId = "bb73490f-a05d-4e2f-abd9-6179a9df31b6";
const product = {
  id: "9459c6b0-9b48-49b7-a639-c091881b9d1e",
  name: "ABC synthetic underlayment",
  sku: "654210",
  purchaseUnit: "SQ",
  canonicalMaterialKey: "ROOFING-UNDERLAYMENT-SYNTHETIC-STANDARD",
  isActive: true,
  materialId: null,
};

const findSupplier = prisma.supplier.findFirst as jest.Mock;
const findProduct = prisma.supplierProduct.findFirst as jest.Mock;
const countProducts = prisma.supplierProduct.count as jest.Mock;
const countMaterials = prisma.material.count as jest.Mock;
const countObservations = prisma.supplierPriceObservation.count as jest.Mock;
const pricing = priceOneAbcSandboxSku as jest.Mock;

describe("single ABC sandbox price probe (no Material)", () => {
  const originalId = process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = supplierId;
    findSupplier.mockResolvedValue({ id: supplierId });
    findProduct.mockResolvedValue(product);
    countProducts.mockResolvedValue(1);
    countMaterials.mockResolvedValue(0);
    countObservations.mockResolvedValue(1);
    pricing.mockResolvedValue([{
      id: "review-0", itemNumber: "654210", quantity: 1, unitPrice: 19.75,
      currencyCode: "USD", statusCode: "OK", statusMessage: "Priced Successfully",
    }]);
  });

  afterAll(() => {
    if (originalId === undefined) delete process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID;
    else process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = originalId;
  });

  it("prices exactly one scoped SKU without claiming its stock UOM or writing prices", async () => {
    await expect(probeAbcSandboxPricing(orgId, "ABC-654210")).resolves.toEqual({
      supplierProductKey: "ABC-654210", sku: "654210", sourcePurchaseUnit: "SQ",
      priced: true, price: 19.75, currency: "USD", providerStatus: "OK",
      providerStockingUnitVerified: false, materialCreated: false, priceApplied: false,
    });
    expect(findSupplier).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: supplierId, orgId, apiIntegrationKey: "ABC_SUPPLY" },
    }));
    expect(findProduct).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId, supplierId, supplierProductKey: "ABC-654210" },
    }));
    expect(pricing).toHaveBeenCalledWith(orgId, supplierId, "654210");
  });

  it("refuses unverified, ambiguous or unobserved product before ABC is called", async () => {
    countProducts.mockResolvedValueOnce(2);
    await expect(probeAbcSandboxPricing(orgId, "ABC-654210")).rejects.toThrow("ambiguous");
    countObservations.mockResolvedValueOnce(0);
    await expect(probeAbcSandboxPricing(orgId, "ABC-654210")).rejects.toThrow("no source observation");
    findProduct.mockResolvedValueOnce({ ...product, canonicalMaterialKey: null });
    await expect(probeAbcSandboxPricing(orgId, "ABC-654210")).rejects.toThrow("canonical mapping");
    expect(pricing).not.toHaveBeenCalled();
  });

  it("fails closed if configured ABC supplier is absent in tenant", async () => {
    findSupplier.mockResolvedValueOnce(null);
    await expect(probeAbcSandboxPricing(orgId, "ABC-654210")).rejects.toThrow("not available");
    expect(pricing).not.toHaveBeenCalled();
  });

  it("does not treat unmatched/non-USD/zero provider lines as a verified price", async () => {
    pricing.mockResolvedValueOnce([{ id: "review-0", itemNumber: "654210", unitPrice: 0,
      currencyCode: "USD", statusCode: "OK" }]);
    const result = await probeAbcSandboxPricing(orgId, "ABC-654210");
    expect(result.priced).toBe(false);
    expect(result.price).toBeNull();
    pricing.mockResolvedValueOnce([{ id: "review-0", itemNumber: "654210", unitPrice: 12,
      currencyCode: "EUR", statusCode: "OK" }]);
    expect((await probeAbcSandboxPricing(orgId, "ABC-654210")).priced).toBe(false);
  });
});
