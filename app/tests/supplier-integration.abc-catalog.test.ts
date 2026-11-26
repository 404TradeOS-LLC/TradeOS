import { AbcCatalogClient, isCatalogEnabled, type AbcCatalogClientOptions } from "../modules/supplier-integration/abcCatalog";

const config = { clientId: "sandbox-app", clientSecret: "example-secret" };

function json(payload: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function page(items: unknown[], pageNumber = 1, totalItems = items.length, totalPages = 1, itemsPerPage = 25) {
  return {
    pagination: { itemsPerPage, pageNumber, totalPages, totalItems },
    items,
  };
}

function clientWith(fetchFn: jest.Mock, options?: AbcCatalogClientOptions): AbcCatalogClient {
  return new AbcCatalogClient(
    config,
    fetchFn as unknown as typeof fetch,
    () => 1_000_000,
    async () => undefined,
    options,
  );
}

describe("ABC Supply provider-backed catalog (#735)", () => {
  it("is explicitly opt-in and does not depend on customer refresh tokens", () => {
    expect(isCatalogEnabled({})).toBe(false);
    expect(isCatalogEnabled({ ABC_SUPPLY_CATALOG_BROWSE_ENABLED: "true" })).toBe(true);
  });

  it("gets a product.read CLIENT CREDENTIALS token then reads a real Get All Items page contract", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-only-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([
        {
          itemNumber: "ABC-00001",
          itemDescription: "Test Shingle",
          supplierName: "Manufacturer A",
          familyId: "PFam_123",
          familyName: "Shingles",
          status: "Active",
          uoms: [{ code: "BD", description: "stocking" }],
        },
      ])));
    const result = await clientWith(fetchFn).list({ pageNumber: 1, itemsPerPage: 25 });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://sandbox.auth.partners.abcsupply.com/oauth2/aus1vp07knpuqf6Xz0h8/v1/token",
    );
    const tokenRequest = fetchFn.mock.calls[0][1] as RequestInit;
    expect(String(tokenRequest.body)).toContain("grant_type=client_credentials");
    expect(String(tokenRequest.body)).toContain("scope=product.read");
    expect(String(tokenRequest.body)).not.toContain("refresh_token");
    expect(fetchFn.mock.calls[1][0]).toBe(
      "https://partners-sb.abcsupply.com/api/product/v1/items?pageNumber=1&itemsPerPage=25&familyItems=false",
    );
    expect(result).toMatchObject({
      persisted: false, pricing: "not-requested", environment: "sandbox",
      items: [{ itemNumber: "ABC-00001", name: "Test Shingle", priceStatus: "unpriced" }],
    });
    expect(JSON.stringify(result)).not.toContain("unitPrice");
  });

  it("uses the provider's documented Search Items filters and server-side page", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([], 2, 30, 3, 10)));
    const result = await clientWith(fetchFn).list({
      q: "GAF", searchBy: "itemDescription", familyId: "PFam_123",
      pageNumber: 2, itemsPerPage: 10,
    });
    expect(fetchFn.mock.calls[1][0]).toBe("https://partners-sb.abcsupply.com/api/product/v1/search/items");
    const request = fetchFn.mock.calls[1][1] as RequestInit;
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toEqual({
      filters: [
        { key: "itemDescription", condition: "contains", values: ["GAF"], joinCondition: null },
        { key: "productFamilyId", condition: "equals", values: ["PFam_123"], joinCondition: "and" },
      ],
      pagination: { pageNumber: 2, itemsPerPage: 10 },
    });
    expect(result.pagination.totalItems).toBe(30);
  });

  it("listRaw returns the parsed provider page intact for the Phase 0 probe census (#735)", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([
        {
          itemNumber: "RAW-01", status: "Inactive",
          marketingDescription: "Provider copy",
          hierarchy: { productGroup: { code: "1", label: "Roofing" } },
          weights: [{ value: "2", uom: "LB" }],
          specifications: [{ name: "Future field" }],
          images: [],
          branches: [{ number: "579" }],
          familyItems: [{ itemNumber: "RAW-02" }],
        },
        { itemNumber: "RAW-02", status: "Active" },
      ], 1, 2, 1, 25)));
    const result = await clientWith(fetchFn).listRaw({ pageNumber: 1, itemsPerPage: 25 });
    // Inactive rows stay in the raw page (list() filters them); passthrough
    // fields survive for the census; nothing is persisted or priced.
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      itemNumber: "RAW-01", marketingDescription: "Provider copy",
      hierarchy: { productGroup: { code: "1", label: "Roofing" } },
      weights: [{ value: "2", uom: "LB" }],
    });
    expect(result).toMatchObject({
      persisted: false, pricing: "not-requested", environment: "sandbox",
      pagination: { totalItems: 2 },
    });
    expect(JSON.stringify(result)).not.toContain("unitPrice");
  });

  it("listRaw requests family items only when asked; list() keeps familyItems=false", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([{ itemNumber: "F-01", familyItems: [{ itemNumber: "F-02" }] }], 1, 1, 1, 25)));
    await clientWith(fetchFn).listRaw({ pageNumber: 1, itemsPerPage: 25, familyItems: true });
    expect(String(fetchFn.mock.calls[1][0])).toContain("familyItems=true");

    const plain = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([{ itemNumber: "F-01" }], 1, 1, 1, 25)));
    await clientWith(plain).list({ pageNumber: 1, itemsPerPage: 25 });
    expect(String(plain.mock.calls[1][0])).toContain("familyItems=false");
  });

  it("filters inactive provider items and does not invent missing attributes", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([
        { itemNumber: "INACTIVE", status: "Inactive" },
        { itemNumber: "ACTIVE", status: "Active" },
      ], 1, 2, 1, 25)));
    const result = await clientWith(fetchFn).list({ pageNumber: 1, itemsPerPage: 25 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      itemNumber: "ACTIVE", familyId: null, manufacturer: null, uoms: [],
      priceStatus: "unpriced",
    });
  });

  it("fails closed on inconsistent pagination or duplicate ABC item identities", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([], 2, 10, 1, 25)));
    await expect(clientWith(fetchFn).list({ pageNumber: 1, itemsPerPage: 25 }))
      .rejects.toThrow("pagination does not match");

    const duplicates = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(page([{ itemNumber: "SAME" }, { itemNumber: "SAME" }])));
    await expect(clientWith(duplicates).list({ pageNumber: 1, itemsPerPage: 25 }))
      .rejects.toThrow("Duplicate ABC item number");
  });

  it("retries provider 429 with bounded backoff without exposing request tokens", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 1800 }))
      .mockResolvedValueOnce(json({ message: "slow down" }, 429, { "retry-after": "1" }))
      .mockResolvedValueOnce(json(page([])));
    await expect(clientWith(fetchFn).list({ pageNumber: 1, itemsPerPage: 25 }))
      .resolves.toMatchObject({ items: [], pricing: "not-requested" });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("never retries a provider authentication denial", async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce(json({ message: "unauthorized" }, 401));
    await expect(clientWith(fetchFn).list({ pageNumber: 1, itemsPerPage: 25 }))
      .rejects.toThrow("HTTP 401");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("rejects out-of-bounds page sizes before making any provider requests", async () => {
    const fetchFn = jest.fn();
    await expect(clientWith(fetchFn).list({ pageNumber: 1, itemsPerPage: 1001 }))
      .rejects.toThrow("Invalid ABC catalog pagination");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("honors a configured per-request timeout and attempt budget", async () => {
    const hanging = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const client = clientWith(hanging, { requestTimeoutMs: 50, maxAttempts: 2 });
    await expect(client.list({ pageNumber: 1, itemsPerPage: 25 }))
      .rejects.toThrow("ABC catalog provider request failed");
    expect(hanging).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid client options before any provider request", () => {
    const fetchFn = jest.fn();
    expect(() => clientWith(fetchFn, { requestTimeoutMs: 0 })).toThrow("Invalid ABC catalog client options");
    expect(() => clientWith(fetchFn, { maxAttempts: 0 })).toThrow("Invalid ABC catalog client options");
    expect(() => clientWith(fetchFn, { maxAttempts: 6 })).toThrow("Invalid ABC catalog client options");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});


describe("ABC Supply Get Item on-demand detail (#735)", () => {
  const config = { clientId: "client", clientSecret: "secret" };

  function clientFor(providerBody: unknown) {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(json({ access_token: "server-token", expires_in: 1800 }))
      .mockResolvedValueOnce(json(providerBody));
    const client = new AbcCatalogClient(config, fetchFn as unknown as typeof fetch,
      () => 1_000_000, async () => undefined);
    return { client, fetchFn };
  }

  it("reads genuine provider detail fields, hierarchy and nested variations without pricing", async () => {
    const { client, fetchFn } = clientFor({
      itemNumber: "02GASTZ3WW",
      status: "Active",
      itemDescription: "Test roofing shingles",
      marketingDescription: "Provider description",
      isDimensional: true,
      uoms: [{ code: "BD", name: "Bundle", description: "stocking" }],
      dimensions: { variations: [
        { size: "Length A", conversionFactor: 1, length: { value: "10", uom: "feet" } },
      ] },
      familyItems: [{ itemNumber: "ABC2", itemDescription: "Other color", color: "Gray" }],
      prop65Warnings: [{ display: true, label: "Provider warning" }],
      hierarchy: { productGroup: { label: "Roofing", category: {
        label: "Shingles", productType: {
          label: "Architectural", materialComposition: {
            label: "Asphalt", warranty: { label: "Limited", brandLine: { label: "Provider brand" } },
          },
        },
      } } },
    });
    const detail = await client.getItem("02GASTZ3WW");
    expect(fetchFn.mock.calls[1][0]).toBe(
      "https://partners-sb.abcsupply.com/api/product/v1/items/02GASTZ3WW?embed=variations&familyItems=true",
    );
    expect(detail).toMatchObject({
      itemNumber: "02GASTZ3WW", isDimensional: true,
      marketingDescription: "Provider description",
      priceStatus: "unpriced", branchAvailability: "not-verified",
      persisted: false, pricing: "not-requested", environment: "sandbox",
      familyItems: [{ itemNumber: "ABC2", name: "Other color", color: "Gray" }],
      hierarchyLabels: ["Roofing", "Shingles", "Architectural", "Asphalt", "Limited", "Provider brand"],
      variations: [{ size: "Length A", conversionFactor: 1 }],
    });
    expect(JSON.stringify(detail)).not.toContain("unitPrice");
    expect(JSON.stringify(detail)).not.toContain("access_token");
  });

  it("rejects path-like item numbers before provider calls", async () => {
    const fetchFn = jest.fn();
    const client = new AbcCatalogClient(config, fetchFn as unknown as typeof fetch);
    for (const unsafe of ["../secret", "ABC?foo=bar", "", "ABC/123", "x".repeat(81)]) {
      await expect(client.getItem(unsafe)).rejects.toThrow("Invalid ABC item number");
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fails closed when provider returns another item or an inactive record", async () => {
    await expect(clientFor({ itemNumber: "OTHER", status: "Active" }).client.getItem("ABC123"))
      .rejects.toThrow("identity mismatch");
    await expect(clientFor({ itemNumber: "ABC123", status: "Inactive" }).client.getItem("ABC123"))
      .rejects.toThrow("not active");
  });
});
