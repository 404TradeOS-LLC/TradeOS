import { AbcSupplyAccountClient } from "../modules/supplier-integration/abcAccount";
import { AbcSupplyAuth, loadAbcSupplyAuthConfig, loadAbcSupplyConfig } from "../modules/supplier-integration/abcSupply";

const config = {
  clientId: "cid",
  clientSecret: "csecret",
  refreshToken: "rt",
  branchNumber: "340",
  shipToNumber: "2010466-2",
};

function searchResponse() {
  return {
    pagination: { itemsPerPage: 50, pageNumber: 1, totalPages: 1, totalItems: 2 },
    shipTos: [
      {
        number: "2010466-2",
        name: "BIG PINE ROOFING",
        status: "active",
        branches: [
          { number: "340", name: "ABC Supply 340 - Orem, UT", status: "active", storefront: "abc", type: "Branch", homeBranch: true },
        ],
      },
      {
        number: "9999999-9",
        name: "RETIRED ACCOUNT",
        status: "inactive",
        branches: [],
      },
    ],
  };
}

describe("AbcSupplyAccountClient.searchShipToAccounts", () => {
  it("posts the Ship-To filter and returns normalized accounts with branches", async () => {
    const tokenResponse = {
      ok: true,
      json: async () => ({ access_token: "account-token", expires_in: 1800 }),
    };
    const searchFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => searchResponse(),
    });
    const auth = new AbcSupplyAuth(config, (async () => tokenResponse) as unknown as typeof fetch);
    const client = new AbcSupplyAccountClient(auth, searchFetch as unknown as typeof fetch);

    const accounts = await client.searchShipToAccounts();

    // Retired account (no branches) is filtered out per ABC guidance.
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toEqual({
      number: "2010466-2",
      name: "BIG PINE ROOFING",
      status: "active",
      branches: [{ number: "340", name: "ABC Supply 340 - Orem, UT", status: "active", homeBranch: true }],
    });

    const [url, init] = searchFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://partners-sb.abcsupply.com/api/account/v1/search/accounts");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer account-token");
    const body = JSON.parse(String(init.body));
    expect(body.filters).toEqual([{ key: "accountType", condition: "equals", values: ["Ship-to"] }]);
    expect(body.pagination).toEqual({ itemsPerPage: 50, pageNumber: 1 });
  });

  it("requests the account.read scope on refresh, not the pricing scope", async () => {
    const tokenFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "account-token", expires_in: 1800 }),
    });
    const auth = new AbcSupplyAuth(config, tokenFetch as unknown as typeof fetch);
    const client = new AbcSupplyAccountClient(auth, (async () => ({
      ok: true,
      json: async () => ({
        pagination: { pageNumber: 1, totalPages: 1 },
        shipTos: [],
      }),
    })) as unknown as typeof fetch);

    await client.searchShipToAccounts();

    const [, init] = tokenFetch.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String((init as { body: unknown }).body));
    expect(body.get("scope")).toBe("account.read");
  });

  it("keeps pricing and account tokens in separate cache slots", async () => {
    const tokenFetch = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = new URLSearchParams(String((init as { body: unknown }).body));
      return {
        ok: true,
        json: async () => ({ access_token: `token-for-${body.get("scope")}`, expires_in: 1800 }),
      };
    });
    const auth = new AbcSupplyAuth(config, tokenFetch as unknown as typeof fetch);

    const pricingToken = await auth.getPricingToken();
    const accountToken = await auth.getAccountToken();
    expect(pricingToken).toBe("token-for-pricing.read");
    expect(accountToken).toBe("token-for-account.read");

    // Second round-trip hits the cache: no new refresh requests.
    await auth.getPricingToken();
    await auth.getAccountToken();
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });

  it("traverses every result page before filtering retired accounts", async () => {
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true,
      json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const page = (pageNumber: number, totalPages: number, shipTos: unknown[]) => ({
      ok: true,
      json: async () => ({
        pagination: { itemsPerPage: 1, pageNumber, totalPages, totalItems: totalPages },
        shipTos,
      }),
    });
    const shipTo = (number: string) => ({
      number,
      name: `ACCOUNT ${number}`,
      status: "active",
      branches: [{ number: "340", name: "Branch 340", status: "active", homeBranch: true }],
    });
    const searchFetch = jest
      .fn()
      .mockResolvedValueOnce(page(1, 2, [shipTo("2010466-2")]))
      .mockResolvedValueOnce(page(2, 2, [shipTo("2010466-3")]));
    const client = new AbcSupplyAccountClient(auth, searchFetch as unknown as typeof fetch);

    const accounts = await client.searchShipToAccounts();

    expect(accounts.map((a) => a.number)).toEqual(["2010466-2", "2010466-3"]);
    expect(searchFetch).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String((searchFetch.mock.calls[1] as [string, RequestInit])[1].body));
    expect(secondBody.pagination).toEqual({ itemsPerPage: 50, pageNumber: 2 });
  });

  it("rejects a missing shipTos field instead of treating it as zero accounts", async () => {
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true, json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const client = new AbcSupplyAccountClient(auth, (async () => ({
      ok: true, json: async () => ({ pagination: { pageNumber: 1, totalPages: 1 } }),
    })) as unknown as typeof fetch);
    await expect(client.searchShipToAccounts()).rejects.toThrow("response is invalid");
  });

  it("accepts a genuinely empty result only with an explicit shipTos array", async () => {
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true, json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const client = new AbcSupplyAccountClient(auth, (async () => ({
      ok: true, json: async () => ({
        pagination: { pageNumber: 1, totalPages: 1 }, shipTos: [],
      }),
    })) as unknown as typeof fetch);
    await expect(client.searchShipToAccounts()).resolves.toEqual([]);
  });

  it.each([
    ["missing pagination", { shipTos: [] }],
    ["mismatched page", { pagination: { pageNumber: 2, totalPages: 2 }, shipTos: [] }],
    ["fractional total", { pagination: { pageNumber: 1, totalPages: 1.5 }, shipTos: [] }],
    ["zero total", { pagination: { pageNumber: 1, totalPages: 0 }, shipTos: [] }],
    ["invalid shipTos", { pagination: { pageNumber: 1, totalPages: 1 }, shipTos: null }],
    ["oversized single page", { pagination: { pageNumber: 1, totalPages: 1 }, shipTos: Array.from({ length: 51 }, () => ({
      number: "2010466-2", name: "Test", status: "active", branches: [],
    })) }],
  ])("fails closed on %s", async (_case, body) => {
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true, json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const client = new AbcSupplyAccountClient(auth, (async () => ({
      ok: true, json: async () => body,
    })) as unknown as typeof fetch);
    await expect(client.searchShipToAccounts()).rejects.toThrow("response is invalid");
  });

  it("rejects excessive page counts without silently returning a truncated list", async () => {
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true, json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const searchFetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({
        pagination: { pageNumber: 1, totalPages: 101 }, shipTos: [],
      }),
    });
    const client = new AbcSupplyAccountClient(auth, searchFetch as unknown as typeof fetch);
    await expect(client.searchShipToAccounts()).rejects.toThrow("safe page limit");
    expect(searchFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects inconsistent pagination rather than returning incomplete accounts", async () => {
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true, json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const searchFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        pagination: { pageNumber: 1, totalPages: 2 }, shipTos: [],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        pagination: { pageNumber: 2, totalPages: 1 }, shipTos: [],
      }) });
    const client = new AbcSupplyAccountClient(auth, searchFetch as unknown as typeof fetch);
    await expect(client.searchShipToAccounts()).rejects.toThrow("pagination changed");
    expect(searchFetch).toHaveBeenCalledTimes(2);
  });

  it("does not fetch a later page after the caller aborts", async () => {
    const controller = new AbortController();
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true, json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const searchFetch = jest.fn().mockImplementation(async () => {
      controller.abort();
      return { ok: true, json: async () => ({
        pagination: { pageNumber: 1, totalPages: 2 }, shipTos: [],
      }) };
    });
    const client = new AbcSupplyAccountClient(auth, searchFetch as unknown as typeof fetch);
    await expect(client.searchShipToAccounts(controller.signal)).rejects.toThrow("was canceled");
    expect(searchFetch).toHaveBeenCalledTimes(1);
  });

  it("throws a sanitized error on non-OK responses without leaking the body", async () => {
    const auth = new AbcSupplyAuth(config, (async () => ({
      ok: true,
      json: async () => ({ access_token: "t", expires_in: 1800 }),
    })) as unknown as typeof fetch);
    const client = new AbcSupplyAccountClient(auth, (async () => ({
      ok: false,
      status: 403,
    })) as unknown as typeof fetch);

    await expect(client.searchShipToAccounts()).rejects.toThrow(
      "ABC Supply Search Accounts request failed: HTTP 403",
    );
  });
});

// Account discovery precedes pricing account selection; don't require those
// pricing-only environment variables to discover authorized Ship-Tos.
describe("ABC sandbox OAuth auth-only configuration", () => {
  it("loads OAuth client credentials without a branch or Ship-To", () => {
    const env = {
      ABC_SUPPLY_SANDBOX_CLIENT_ID: "cid",
      ABC_SUPPLY_SANDBOX_CLIENT_SECRET: "private",
    };
    expect(loadAbcSupplyAuthConfig(env)).toEqual({
      clientId: "cid", clientSecret: "private", refreshToken: null,
    });
    expect(loadAbcSupplyConfig(env)).toBeNull();
  });

  it("fails closed without client credentials", () => {
    expect(loadAbcSupplyAuthConfig({ ABC_SUPPLY_SANDBOX_CLIENT_ID: "cid" })).toBeNull();
  });
});
