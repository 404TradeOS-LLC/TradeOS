import { AbcCatalogClient } from "../modules/supplier-integration/abcCatalog";

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}
function clientWith(fetchFn: jest.Mock) {
  return new AbcCatalogClient(
    { clientId: "sandbox", clientSecret: "secret" },
    fetchFn as unknown as typeof fetch, () => 1_000_000, async () => undefined,
  );
}

describe("ABC Get Item Availability — branch ordering only (#735)", () => {
  it("uses server-only product.read and returns provider-listed branches/lengths, never inventory quantity", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "sandbox-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({ branches: [
        { number: 222, isDimensional: true, stockQuantity: 100,
          variations: [{ size: "1 x 6", length: { value: "6", uomCode: "ft" }, conversionFactor: 2 }] },
        { number: "0517", isDimensional: false, variations: [] },
      ] }));
    const result = await clientWith(fetchFn).getItemAvailability("AAE23AL");
    expect(fetchFn.mock.calls[1][0]).toBe(
      "https://partners-sb.abcsupply.com/api/product/v1/availability/items/AAE23AL/branches",
    );
    expect(result).toMatchObject({
      itemNumber: "AAE23AL", providerBranchCount: 2,
      availabilityMeaning: "listed_for_ordering_not_stock_quantity",
      pricing: "not-requested", persisted: false,
      selectedBranchListed: null,
      branches: [
        { branchNumber: "222", isDimensional: true, variations: [{ size: "1 x 6", length: "6 ft" }] },
        { branchNumber: "0517", isDimensional: false, variations: [] },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("stockQuantity");
    expect(JSON.stringify(result)).not.toContain("conversionFactor");
  });

  it("filters an exact provider branch without inventing a purchase entitlement", async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({ branches: [{ number: 222 }, { number: "0517" }] }));
    const result = await clientWith(fetchFn).getItemAvailability("AAE23AL", "0517");
    expect(result).toMatchObject({ selectedBranch: "0517", selectedBranchListed: true, providerBranchCount: 2 });
    expect(result.branches.map(x => x.branchNumber)).toEqual(["0517"]);
  });

  it("reports a branch omitted by provider without claiming actual stock", async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({ branches: [] }));
    await expect(clientWith(fetchFn).getItemAvailability("AAE23AL", "579"))
      .resolves.toMatchObject({ selectedBranch: "579", selectedBranchListed: false, branches: [] });
  });

  it("rejects path/query injection before any provider token/network request", async () => {
    const noNetwork = jest.fn();
    await expect(clientWith(noNetwork).getItemAvailability("../malicious")).rejects.toThrow("Invalid ABC availability lookup");
    await expect(clientWith(noNetwork).getItemAvailability("VALID", "579?redirect=evil")).rejects.toThrow("Invalid ABC availability lookup");
    expect(noNetwork).not.toHaveBeenCalled();
  });
});
