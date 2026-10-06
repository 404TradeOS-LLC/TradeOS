import {
  AbcSupplyAuth,
  AbcSupplyPricingClient,
  createAbcSupplyFeedFetcher,
  loadAbcSupplyConfig,
} from "../modules/supplier-integration/abcSupply";

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const body = handler(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return { access_token: "user-token-1", expires_in: 1800, ...overrides };
}

function priceResponse(lines: unknown[]) {
  return { requestId: "r1", lines };
}

function okLine(id: string, unitPrice: number) {
  return {
    id,
    itemNumber: `ITEM-${id}`,
    unitPrice,
    currency: { code: "USD", symbol: "$" },
    status: { code: "OK", message: "Priced Successfully" },
  };
}

describe("loadAbcSupplyConfig", () => {
  it("returns null when any required variable is missing", () => {
    expect(loadAbcSupplyConfig({})).toBeNull();
    expect(
      loadAbcSupplyConfig({
        ABC_SUPPLY_SANDBOX_CLIENT_ID: "id",
        ABC_SUPPLY_SANDBOX_CLIENT_SECRET: "secret",
        ABC_SUPPLY_SANDBOX_REFRESH_TOKEN: "rt",
        ABC_SUPPLY_BRANCH_NUMBER: "579",
      }),
    ).toBeNull();
  });

  it("returns the config when fully configured", () => {
    expect(
      loadAbcSupplyConfig({
        ABC_SUPPLY_SANDBOX_CLIENT_ID: "id",
        ABC_SUPPLY_SANDBOX_CLIENT_SECRET: "secret",
        ABC_SUPPLY_SANDBOX_REFRESH_TOKEN: "rt",
        ABC_SUPPLY_BRANCH_NUMBER: "579",
        ABC_SUPPLY_SHIP_TO_NUMBER: "1008710",
      }),
    ).toEqual({
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "rt",
      branchNumber: "579",
      shipToNumber: "1008710",
    });
  });
});

describe("AbcSupplyAuth", () => {
  const config = {
    clientId: "cid",
    clientSecret: "csecret",
    refreshToken: "rt",
    branchNumber: "579",
    shipToNumber: "1008710",
  };

  it("mints a user token with the refresh_token grant and Basic auth", async () => {
    const fetchFn = mockFetch((url, init) => {
      expect(url).toBe(
        "https://sandbox.auth.partners.abcsupply.com/oauth2/aus1vp07knpuqf6Xz0h8/v1/token",
      );
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe(
        `Basic ${Buffer.from("cid:csecret", "utf8").toString("base64")}`,
      );
      expect(String(init?.body)).toContain("grant_type=refresh_token");
      expect(String(init?.body)).toContain("scope=pricing.read");
      return tokenResponse();
    });
    const auth = new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch);
    await expect(auth.getPricingToken()).resolves.toBe("user-token-1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("caches the token until near expiry", async () => {
    let nowMs = 1_000_000;
    const fetchFn = mockFetch(() => tokenResponse());
    const auth = new AbcSupplyAuth(
      config,
      fetchFn as unknown as typeof fetch,
      () => nowMs,
    );
    await auth.getPricingToken();
    await auth.getPricingToken();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    nowMs += 1800 * 1000; // past expiry
    await auth.getPricingToken();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("notifies when the refresh token rotates", async () => {
    const onRefreshTokenRotated = jest.fn();
    const fetchFn = mockFetch(() => tokenResponse({ refresh_token: "rt-new" }));
    const auth = new AbcSupplyAuth(
      config,
      fetchFn as unknown as typeof fetch,
      Date.now,
      { onRefreshTokenRotated },
    );
    await auth.getPricingToken();
    expect(onRefreshTokenRotated).toHaveBeenCalledWith("rt-new");
  });

  it("throws a clear error when the token endpoint rejects", async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 401 }) as Response);
    const auth = new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch);
    await expect(auth.getPricingToken()).rejects.toThrow(
      "ABC Supply token refresh failed: HTTP 401",
    );
  });
});

describe("AbcSupplyPricingClient", () => {
  const config = {
    clientId: "cid",
    clientSecret: "csecret",
    refreshToken: "rt",
    branchNumber: "579",
    shipToNumber: "1008710",
  };

  function pricingTestSetup(priceHandler: (body: any) => unknown) {
    const seen: { url: string; body: any }[] = [];
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/v1/token")) {
        return { ok: true, status: 200, json: async () => tokenResponse() } as Response;
      }
      const body = JSON.parse(String(init?.body));
      seen.push({ url: String(url), body });
      return { ok: true, status: 200, json: async () => priceHandler(body) } as Response;
    });
    const auth = new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch);
    const pricing = new AbcSupplyPricingClient(auth, fetchFn as unknown as typeof fetch);
    return { fetchFn, pricing, seen };
  }

  it("posts to the sandbox Price Items endpoint with purpose estimating", async () => {
    const { pricing, seen } = pricingTestSetup((body) =>
      priceResponse([okLine(body.lines[0].id, 135.36)]),
    );
    const priced = await pricing.priceItems([{ id: "line-0", itemNumber: "02GASTZ3WW", quantity: 1 }], {
      branchNumber: "579",
      shipToNumber: "1008710",
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://partners-sb.abcsupply.com/api/pricing/v2/prices");
    expect(seen[0].body).toMatchObject({
      shipToNumber: "1008710",
      branchNumber: "579",
      purpose: "estimating",
      lines: [{ id: "line-0", itemNumber: "02GASTZ3WW", quantity: 1 }],
    });
    expect(seen[0].body.requestId).toEqual(expect.any(String));
    expect(priced).toEqual([
      {
        id: "line-0",
        itemNumber: "02GASTZ3WW",
        quantity: 1,
        unitPrice: 135.36,
        currencyCode: "USD",
        statusCode: "OK",
        statusMessage: "Priced Successfully",
      },
    ]);
  });

  it("sends the Bearer user token", async () => {
    const authHeaders: string[] = [];
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/v1/token")) {
        return { ok: true, status: 200, json: async () => tokenResponse() } as Response;
      }
      authHeaders.push((init?.headers as Record<string, string>).authorization);
      return { ok: true, status: 200, json: async () => priceResponse([]) } as Response;
    });
    const auth = new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch);
    const pricing = new AbcSupplyPricingClient(auth, fetchFn as unknown as typeof fetch);
    await pricing.priceItems([{ id: "line-0", itemNumber: "SKU-1", quantity: 1 }], {
      branchNumber: "579",
      shipToNumber: "1008710",
    });
    expect(authHeaders).toEqual(["Bearer user-token-1"]);
  });

  it("batches more than 50 lines into separate requests", async () => {
    const { pricing, seen } = pricingTestSetup((body) =>
      priceResponse(body.lines.map((l: any) => okLine(l.id, 10))),
    );
    const lines = Array.from({ length: 51 }, (_, i) => ({
      id: `line-${i}`,
      itemNumber: `ITEM-${i}`,
      quantity: 1,
    }));
    const priced = await pricing.priceItems(lines, { branchNumber: "579", shipToNumber: "1008710" });
    expect(seen).toHaveLength(2);
    expect(seen[0].body.lines).toHaveLength(50);
    expect(seen[1].body.lines).toHaveLength(1);
    expect(priced).toHaveLength(51);
  });

  it("throws a clear error when Price Items rejects", async () => {
    const fetchFn = jest.fn(async (url: string) => {
      if (String(url).includes("/v1/token")) {
        return { ok: true, status: 200, json: async () => tokenResponse() } as Response;
      }
      return { ok: false, status: 403 } as Response;
    });
    const auth = new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch);
    const pricing = new AbcSupplyPricingClient(auth, fetchFn as unknown as typeof fetch);
    await expect(
      pricing.priceItems([{ id: "line-0", itemNumber: "X", quantity: 1 }], {
        branchNumber: "579",
        shipToNumber: "1008710",
      }),
    ).rejects.toThrow("ABC Supply Price Items request failed: HTTP 403");
  });
});

describe("createAbcSupplyFeedFetcher", () => {
  const config = {
    clientId: "cid",
    clientSecret: "csecret",
    refreshToken: "rt",
    branchNumber: "579",
    shipToNumber: "1008710",
  };

  function fetcherSetup(priceLines: (body: any) => unknown[]) {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/v1/token")) {
        return { ok: true, status: 200, json: async () => tokenResponse() } as Response;
      }
      const body = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => priceResponse(priceLines(body)),
      } as Response;
    });
    const loadMaterials = jest.fn(async () => [
      { id: "mat-1", sku: "SKU-1" },
      { id: "mat-2", sku: "SKU-2" },
      { id: "mat-3", sku: "SKU-3" },
    ]);
    const auth = new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch);
    const pricing = new AbcSupplyPricingClient(auth, fetchFn as unknown as typeof fetch);
    return { fetcher: createAbcSupplyFeedFetcher({ config, loadMaterials, auth, pricing }), loadMaterials };
  }

  it("is a no-op returning [] when unconfigured", async () => {
    const fetcher = createAbcSupplyFeedFetcher({ config: null });
    await expect(fetcher("sup-1", "org-1")).resolves.toEqual([]);
  });

  it("maps OK-priced lines to material quotes by SKU", async () => {
    const { fetcher } = fetcherSetup((body) =>
      body.lines.map((l: any, i: number) => ({
        id: l.id,
        itemNumber: l.itemNumber,
        unitPrice: 100 + i,
        currency: { code: "USD", symbol: "$" },
        status: { code: "OK", message: "Priced Successfully" },
      })),
    );
    const quotes = await fetcher("sup-1", "org-1");
    expect(quotes).toHaveLength(3);
    expect(quotes[0]).toMatchObject({ materialId: "mat-1", proposedUnitCost: 100 });
  });

  it("skips non-OK lines and $0.00 lines", async () => {
    const { fetcher } = fetcherSetup(() => [
      { ...okLine("line-0", 50), itemNumber: "SKU-1" },
      { ...okLine("line-1", 0), itemNumber: "SKU-2" },
      {
        id: "line-2",
        itemNumber: "SKU-3",
        unitPrice: 0,
        currency: { code: "USD", symbol: "$" },
        status: { code: "Error", message: "Cannot price item SKU-3. Call for pricing." },
      },
    ]);
    const quotes = await fetcher("sup-1", "org-1");
    expect(quotes).toEqual([{ materialId: "mat-1", proposedUnitCost: 50 }]);
  });

  it("returns [] when the supplier has no SKU-bearing materials", async () => {
    const fetchFn = jest.fn();
    const fetcher = createAbcSupplyFeedFetcher({
      config,
      loadMaterials: async () => [],
      auth: new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch),
      pricing: new AbcSupplyPricingClient(
        new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch),
        fetchFn as unknown as typeof fetch,
      ),
    });
    await expect(fetcher("sup-1", "org-1")).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("skips lines whose SKU maps to more than one material", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/v1/token")) {
        return { ok: true, status: 200, json: async () => tokenResponse() } as Response;
      }
      const body = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () =>
          priceResponse(
            body.lines.map((l: any) => ({ ...okLine(l.id, 42), itemNumber: l.itemNumber })),
          ),
      } as Response;
    });
    const loadMaterials = jest.fn(async () => [
      { id: "mat-a", sku: "DUP-SKU" },
      { id: "mat-b", sku: "DUP-SKU" },
      { id: "mat-c", sku: "UNIQUE-SKU" },
    ]);
    const auth = new AbcSupplyAuth(config, fetchFn as unknown as typeof fetch);
    const pricing = new AbcSupplyPricingClient(auth, fetchFn as unknown as typeof fetch);
    const fetcher = createAbcSupplyFeedFetcher({ config, loadMaterials, auth, pricing });
    // Only the unambiguous SKU produces a quote; the duplicated SKU is
    // dropped rather than pricing the wrong material.
    await expect(fetcher("sup-1", "org-1")).resolves.toEqual([
      { materialId: "mat-c", proposedUnitCost: 42 },
    ]);
  });
});
