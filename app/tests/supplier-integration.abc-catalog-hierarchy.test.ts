import { AbcCatalogClient } from "../modules/supplier-integration/abcCatalog";

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}
function clientWith(fetchFn: jest.Mock) {
  return new AbcCatalogClient(
    { clientId: "sandbox-app", clientSecret: "example-secret" },
    fetchFn as unknown as typeof fetch, () => 1_000_000, async () => undefined,
  );
}
const hierarchy = {
  productGroup: { code: "1000", label: "Steep Slope Products",
    category: { code: "13", label: "Steep Slope Roofing",
      productType: { code: "70", label: "Fiberglass Shingles",
        materialComposition: { code: "62", label: "Asphalt",
          warranty: { code: "143", label: "Dimensional Shingles",
            brandLine: { code: "3232", label: "GAF Timberline HD" },
          },
        },
      },
    },
  },
};

describe("ABC official hierarchy — on-demand provider reads (#735)", () => {
  it("uses client_credentials product.read and returns only flattened verified six-level paths", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-product-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({
        pagination: { pageNumber: 2, itemsPerPage: 25, totalPages: 3, totalItems: 62 },
        hierarchies: [hierarchy],
      }));
    const result = await clientWith(fetchFn).listHierarchy(2, 25);
    expect(fetchFn.mock.calls[0][0]).toContain("sandbox.auth.partners.abcsupply.com");
    expect(String((fetchFn.mock.calls[0][1] as RequestInit).body)).toContain("scope=product.read");
    expect(fetchFn.mock.calls[1][0]).toBe("https://partners-sb.abcsupply.com/api/product/v1/hierarchy?itemsPerPage=25&pageNumber=2");
    expect(result.paths[0].map(p => p.code)).toEqual(["1000", "13", "70", "62", "143", "3232"]);
    expect(result.paths[0].map(p => p.label)).toEqual([
      "Steep Slope Products", "Steep Slope Roofing", "Fiberglass Shingles",
      "Asphalt", "Dimensional Shingles", "GAF Timberline HD",
    ]);
    expect(result).toMatchObject({ source: "ABC Supply", environment: "sandbox",
      pricing: "not-requested", persisted: false, pagination: { totalItems: 62, pageNumber: 2 } });
    expect(JSON.stringify(result)).not.toContain("unitPrice");
  });

  it("rejects provider pagination mismatch and unsupported page size", async () => {
    const noNetwork = jest.fn();
    await expect(clientWith(noNetwork).listHierarchy(0, 25)).rejects.toThrow("Invalid ABC hierarchy pagination");
    await expect(clientWith(noNetwork).listHierarchy(1, 51)).rejects.toThrow("Invalid ABC hierarchy pagination");
    expect(noNetwork).not.toHaveBeenCalled();
    const bad = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({
        pagination: { pageNumber: 1, itemsPerPage: 10, totalPages: 2, totalItems: 20 },
        hierarchies: [hierarchy],
      }));
    await expect(clientWith(bad).listHierarchy(1, 25)).rejects.toThrow("ABC hierarchy pagination mismatch");
  });

  it("fails closed on missing supplier group identity rather than inventing a category", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({
        pagination: { pageNumber: 1, itemsPerPage: 25, totalPages: 1, totalItems: 1 },
        hierarchies: [{ productGroup: { code: "1000" } }],
      }));
    await expect(clientWith(fetchFn).listHierarchy(1, 25))
      .rejects.toThrow("ABC hierarchy missing provider code or label");
  });
});
