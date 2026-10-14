import { AbcCatalogClient } from "../modules/supplier-integration/abcCatalog";

const config = { clientId: "sandbox-id", clientSecret: "sandbox-only-secret" };

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function clientWith(fetchFn: jest.Mock) {
  return new AbcCatalogClient(config, fetchFn as unknown as typeof fetch, () => 1_000_000, async () => undefined);
}

const hierarchy = {
  productGroup: {
    code: "1000", label: "Steep Slope Products",
    category: {
      code: "13", label: "Steep Slope Roofing",
      productType: {
        code: "70", label: "Fiberglass Shingles",
        materialComposition: {
          code: "62", label: "Asphalt",
          warranty: { code: "143", label: "Dimensional Shingles",
            brandLine: { code: "3232", label: "GAF Timberline HD" },
          },
        },
      },
    },
  },
};

describe("ABC Product API: Get Item + Get Product Hierarchy (#735)", () => {
  it("retrieves one exact item with server product.read, embedded dimensional variations and provider hierarchy", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "sandbox-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({
        itemNumber: "02GASTZ3WW", itemDescription: "GAF Shingles", marketingDescription: "Original provider description",
        status: "Active", supplierName: "GAF", isDimensional: true, hierarchy,
        dimensions: { variations: [{ type: "standard", size: "10 foot", length: { value: "10", uomCode: "ft" } }] },
        uoms: [{ code: "BD", name: "Bundle", description: "stocking" }],
        familyItems: [{ itemNumber: "SIBLING", itemDescription: "Gray", color: "gray" }],
        unitCost: 123.45, price: 789,
      }));
    const item = await clientWith(fetchFn).getItem("02GASTZ3WW");
    expect(fetchFn.mock.calls[0][0]).toContain("sandbox.auth.partners.abcsupply.com");
    expect(fetchFn.mock.calls[1][0]).toBe(
      "https://partners-sb.abcsupply.com/api/product/v1/items/02GASTZ3WW?embed=%5Bvariations%5D&familyItems=false",
    );
    expect(item).toMatchObject({
      itemNumber: "02GASTZ3WW", name: "GAF Shingles", manufacturer: "GAF", status: "active",
      marketingDescription: "Original provider description", isDimensional: true,
      variations: [{ size: "10 foot" }],
      familyItems: [{ itemNumber: "SIBLING", name: "Gray", color: "gray" }],
      hierarchy: [{ code: "1000", level: "productGroup" }, { code: "13" }, { code: "70" }, { code: "62" }, { code: "143" }, { code: "3232" }],
      priceStatus: "unpriced", pricing: "not-requested", persisted: false,
    });
    expect(JSON.stringify(item)).not.toContain("unitCost");
    expect(JSON.stringify(item)).not.toContain('"price":789');
  });

  it("fails closed on mismatched item identity or malformed item numbers before requesting a token", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({ itemNumber: "OTHER" }));
    await expect(clientWith(fetchFn).getItem("EXPECTED")).rejects.toThrow("identity mismatch");
    const noNetwork = jest.fn();
    await expect(clientWith(noNetwork).getItem("../evil")).rejects.toThrow("Invalid ABC item number");
    await expect(clientWith(noNetwork).getItem("A?branch=579")).rejects.toThrow("Invalid ABC item number");
    expect(noNetwork).not.toHaveBeenCalled();
  });

  it("does not report an inactive item as an approved or priced Costbook item", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({ itemNumber: "INACTIVE", status: "Inactive" }));
    await expect(clientWith(fetchFn).getItem("INACTIVE"))
      .resolves.toMatchObject({ status: "inactive", priceStatus: "unpriced", persisted: false });
  });

  it("retrieves the provider's exact hierarchy page and flattens all six documented levels", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({
        pagination: { pageNumber: 2, itemsPerPage: 25, totalPages: 3, totalItems: 62 },
        hierarchies: [hierarchy],
      }));
    const result = await clientWith(fetchFn).listHierarchy(2, 25);
    expect(fetchFn.mock.calls[1][0]).toBe(
      "https://partners-sb.abcsupply.com/api/product/v1/hierarchy?itemsPerPage=25&pageNumber=2",
    );
    expect(result.paths[0].map((part) => part.label)).toEqual([
      "Steep Slope Products", "Steep Slope Roofing", "Fiberglass Shingles",
      "Asphalt", "Dimensional Shingles", "GAF Timberline HD",
    ]);
    expect(result).toMatchObject({
      pagination: { pageNumber: 2, totalItems: 62 },
      persisted: false, pricing: "not-requested",
    });
  });

  it("rejects invalid hierarchy pagination and missing provider code rather than fabricating categories", async () => {
    const noNetwork = jest.fn();
    await expect(clientWith(noNetwork).listHierarchy(0)).rejects.toThrow("Invalid ABC hierarchy pagination");
    await expect(clientWith(noNetwork).listHierarchy(1, 1000)).rejects.toThrow("Invalid ABC hierarchy pagination");
    expect(noNetwork).not.toHaveBeenCalled();
    const malformed = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({
        pagination: { pageNumber: 1, itemsPerPage: 25, totalPages: 1, totalItems: 1 },
        hierarchies: [{ productGroup: { code: "1" } }],
      }));
    await expect(clientWith(malformed).listHierarchy(1, 25)).rejects.toThrow("missing provider code or label");
  });
});
