import { probeAbcSandboxCatalog } from "../scripts/probe-abc-sandbox-catalog";
import type { AbcCatalogItem, AbcCatalogPage } from "../modules/supplier-integration/abcCatalog";

function product(itemNumber: string): AbcCatalogItem {
  return {
    itemNumber, name: "Sensitive supplier product",
    familyId: null, familyName: null, manufacturer: null,
    isDimensional: false, uoms: [], dimensions: null, color: null, finish: null,
    variations: [], prop65Warnings: [], source: "ABC Supply", priceStatus: "unpriced",
  };
}

function page(pageNumber: number, totalPages: number, totalItems: number, items: AbcCatalogItem[]): AbcCatalogPage {
  return {
    items,
    pagination: { itemsPerPage: 25, pageNumber, totalItems, totalPages },
    source: "ABC Supply", environment: "sandbox",
    pricing: "not-requested", persisted: false,
  };
}

describe("read-only ABC sandbox Product API proof (#735)", () => {
  it("validates two real provider-shaped pages but returns only counts", async () => {
    const client = { list: jest.fn()
      .mockResolvedValueOnce(page(1, 3, 52, [product("SECRET-SKU-01")]))
      .mockResolvedValueOnce(page(2, 3, 52, [product("SECRET-SKU-02")])) };
    const summary = await probeAbcSandboxCatalog(client, { maxPages: 2, itemsPerPage: 25 });
    expect(client.list).toHaveBeenNthCalledWith(1, { pageNumber: 1, itemsPerPage: 25 });
    expect(client.list).toHaveBeenNthCalledWith(2, { pageNumber: 2, itemsPerPage: 25 });
    expect(summary).toMatchObject({
      status: "verified_sandbox_page", environment: "sandbox",
      productScope: "product.read", pagesVerified: 2,
      providerReportedTotalItems: 52, providerReportedTotalPages: 3,
      activeProductsReturned: 2, uniqueActiveProductIdentitiesChecked: 2,
      storedProducts: 0, providerPricingRequested: false,
    });
    expect(JSON.stringify(summary)).not.toContain("SECRET-SKU");
    expect(JSON.stringify(summary)).not.toContain("Sensitive supplier product");
  });

  it("stops after one page when the provider says there is only one", async () => {
    const client = { list: jest.fn().mockResolvedValue(page(1, 1, 1, [product("SINGLE")])) };
    expect((await probeAbcSandboxCatalog(client, { maxPages: 2 })).pagesVerified).toBe(1);
    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it("rejects zero-count/empty first-page proof instead of claiming success", async () => {
    const client = { list: jest.fn().mockResolvedValue(page(1, 0, 0, [])) };
    await expect(probeAbcSandboxCatalog(client)).rejects.toThrow("catalog_probe_empty_first_page");
  });

  it("fails when second page changes provider-reported catalog size", async () => {
    const client = { list: jest.fn()
      .mockResolvedValueOnce(page(1, 3, 60, [product("A")]))
      .mockResolvedValueOnce(page(2, 3, 61, [product("B")])) };
    await expect(probeAbcSandboxCatalog(client, { maxPages: 2 }))
      .rejects.toThrow("catalog_probe_pagination_drift");
  });

  it("rejects duplicated active ABC identities across provider pages", async () => {
    const client = { list: jest.fn()
      .mockResolvedValueOnce(page(1, 2, 2, [product("DUP")]))
      .mockResolvedValueOnce(page(2, 2, 2, [product("DUP")])) };
    await expect(probeAbcSandboxCatalog(client, { maxPages: 2 }))
      .rejects.toThrow("catalog_probe_identity_or_pricing_mismatch");
  });

  it("rejects a misplaced priced product and invalid provider boundary", async () => {
    const priced = { ...product("P"), priceStatus: "priced" as "unpriced" };
    const client = { list: jest.fn().mockResolvedValue(page(1, 1, 1, [priced])) };
    await expect(probeAbcSandboxCatalog(client)).rejects.toThrow("catalog_probe_identity_or_pricing_mismatch");

    const invalid = { ...page(1, 1, 1, [product("GOOD")]), environment: "production" as "sandbox" };
    const other = { list: jest.fn().mockResolvedValue(invalid) };
    await expect(probeAbcSandboxCatalog(other)).rejects.toThrow("catalog_probe_contract_mismatch");
  });

  it("rejects unbounded scans before any provider/network work", async () => {
    const client = { list: jest.fn() };
    await expect(probeAbcSandboxCatalog(client, { maxPages: 3 as 2 })).rejects.toThrow("invalid_probe_bounds");
    await expect(probeAbcSandboxCatalog(client, { itemsPerPage: 1000 })).rejects.toThrow("invalid_probe_bounds");
    expect(client.list).not.toHaveBeenCalled();
  });
});
