import { AbcSupplyAccountClient } from "../modules/supplier-integration/abcAccount";
import { AbcSupplyAuth } from "../modules/supplier-integration/abcSupply";

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
      json: async () => ({ shipTos: [] }),
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
