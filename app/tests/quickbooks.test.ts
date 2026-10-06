import { QuickBooksClient } from "../modules/quickbooks/client";
import {
  QuickBooksAuth,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
} from "../modules/quickbooks/oauth";
import { QuickBooksService } from "../modules/quickbooks/service";
import {
  QuickBooksConfig,
  QuickBooksError,
  loadQuickBooksConfig,
} from "../modules/quickbooks/types";

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const body = handler(url as string, init);
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as unknown as typeof fetch;
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: "at-1",
    refresh_token: "rt-2",
    expires_in: 3600,
    token_type: "Bearer",
    ...overrides,
  };
}

const config: QuickBooksConfig = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "https://app.example.com/api/quickbooks/oauth/callback",
  refreshToken: "rt-1",
  realmId: "12345",
};

describe("loadQuickBooksConfig", () => {
  it("returns null when any required variable is missing", () => {
    expect(loadQuickBooksConfig({})).toBeNull();
    expect(
      loadQuickBooksConfig({
        QUICKBOOKS_SANDBOX_CLIENT_ID: "id",
        QUICKBOOKS_SANDBOX_CLIENT_SECRET: "secret",
      }),
    ).toBeNull();
  });

  it("returns the config when fully configured", () => {
    expect(
      loadQuickBooksConfig({
        QUICKBOOKS_SANDBOX_CLIENT_ID: "id",
        QUICKBOOKS_SANDBOX_CLIENT_SECRET: "secret",
        QUICKBOOKS_SANDBOX_REDIRECT_URI: "https://x/cb",
        QUICKBOOKS_SANDBOX_REFRESH_TOKEN: "rt",
        QUICKBOOKS_SANDBOX_REALM_ID: "9",
      }),
    ).toEqual({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://x/cb",
      refreshToken: "rt",
      realmId: "9",
    });
  });
});

describe("buildAuthorizeUrl", () => {
  it("builds the Intuit consent URL with required params", () => {
    const { url, state } = buildAuthorizeUrl(config, { state: "s1" });
    expect(url.startsWith("https://appcenter.intuit.com/connect/oauth2?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("client_id")).toBe("cid");
    expect(params.get("redirect_uri")).toBe(config.redirectUri);
    expect(params.get("response_type")).toBe("code");
    expect(params.get("state")).toBe("s1");
    expect(params.get("scope")).toContain("com.intuit.quickbooks.accounting");
    expect(state).toBe("s1");
  });

  it("generates a random state when omitted", () => {
    const a = buildAuthorizeUrl(config);
    const b = buildAuthorizeUrl(config);
    expect(a.state).not.toBe(b.state);
  });
});

describe("exchangeCodeForTokens", () => {
  it("rejects on state mismatch", async () => {
    await expect(
      exchangeCodeForTokens(config, "code", "12345", "wrong", "expected"),
    ).rejects.toThrow(QuickBooksError);
  });

  it("exchanges the code with Basic auth and the authorization_code grant", async () => {
    const fetchFn = mockFetch((url, init) => {
      expect(url).toBe("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe(
        `Basic ${Buffer.from("cid:csecret", "utf8").toString("base64")}`,
      );
      const body = new URLSearchParams(init?.body as string);
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("authcode");
      expect(body.get("redirect_uri")).toBe(config.redirectUri);
      return tokenResponse();
    });
    const tokens = await exchangeCodeForTokens(config, "authcode", "12345", "s1", "s1", fetchFn);
    expect(tokens.accessToken).toBe("at-1");
    expect(tokens.realmId).toBe("12345");
  });
});

describe("QuickBooksAuth", () => {
  it("mints a token via refresh_token grant and caches it", async () => {
    let calls = 0;
    const rotated: string[] = [];
    const fetchFn = mockFetch(() => {
      calls += 1;
      return tokenResponse();
    });
    const auth = new QuickBooksAuth(config, fetchFn, Date.now, {
      onRefreshTokenRotated: (rt) => rotated.push(rt),
    });
    expect(await auth.getAccessToken()).toBe("at-1");
    expect(await auth.getAccessToken()).toBe("at-1");
    expect(calls).toBe(1);
    expect(rotated).toEqual(["rt-2"]);
  });

  it("refreshes when the cached token is within the expiry margin", async () => {
    let now = 0;
    const fetchFn = mockFetch(() => tokenResponse({ access_token: "at-new" }));
    const auth = new QuickBooksAuth(config, fetchFn, () => now);
    await auth.getAccessToken();
    now = 3600 * 1000 - 30_000; // 30s before expiry -> inside 60s margin
    expect(await auth.getAccessToken()).toBe("at-new");
  });

  it("throws QuickBooksError on token endpoint failure", async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 400, text: async () => "bad" }) as Response);
    const auth = new QuickBooksAuth(config, fetchFn);
    await expect(auth.getAccessToken()).rejects.toThrow(QuickBooksError);
  });
});

describe("QuickBooksClient", () => {
  function clientWith(handler: (url: string, init?: RequestInit) => unknown) {
    const auth = new QuickBooksAuth(config, mockFetch(() => tokenResponse()));
    return new QuickBooksClient(config, auth, mockFetch(handler));
  }

  it("fetches company info from the sandbox QBO host", async () => {
    const client = clientWith((url, init) => {
      expect(url).toContain("https://sandbox-quickbooks.api.intuit.com/v3/company/12345/companyinfo/12345");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer at-1");
      return { CompanyInfo: { CompanyName: "Sandbox Co", LegalName: "Sandbox Co LLC" } };
    });
    const info = await client.getCompanyInfo();
    expect(info.companyName).toBe("Sandbox Co");
  });

  it("fetches userinfo from the sandbox accounts host", async () => {
    const client = clientWith((url) => {
      expect(url).toBe("https://sandbox-accounts.platform.intuit.com/v1/openid_connect/userinfo");
      return { sub: "sub-1", email: "a@b.c", givenName: "Test" };
    });
    const user = await client.getUserInfo();
    expect(user.sub).toBe("sub-1");
    expect(user.email).toBe("a@b.c");
  });

  it("creates a test charge against the sandbox payments host", async () => {
    const client = clientWith((url, init) => {
      expect(url).toBe("https://sandbox.api.intuit.com/quickbooks/v4/payments/charges");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body.amount).toBe("10.00");
      return { id: "ch-1", status: "CAPTURED", amount: "10.00", currency: "USD" };
    });
    const charge = await client.createTestCharge({ amount: "10.00" });
    expect(charge.id).toBe("ch-1");
    expect(charge.status).toBe("CAPTURED");
  });

  it("maps Intuit faults to QuickBooksError with the Intuit code", async () => {
    const auth = new QuickBooksAuth(config, mockFetch(() => tokenResponse()));
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ Fault: { Error: [{ code: "6000", message: "nope" }] } }),
    })) as unknown as typeof fetch;
    const client = new QuickBooksClient(config, auth, fetchFn);
    const err = await client.getCompanyInfo().catch((e) => e);
    expect(err).toBeInstanceOf(QuickBooksError);
    expect((err as QuickBooksError).intuitErrorCode).toBe("6000");
    expect((err as QuickBooksError).status).toBe(400);
  });
});

describe("QuickBooksService", () => {
  const env = {
    QUICKBOOKS_SANDBOX_CLIENT_ID: "id",
    QUICKBOOKS_SANDBOX_CLIENT_SECRET: "secret",
    QUICKBOOKS_SANDBOX_REDIRECT_URI: "https://x/cb",
    QUICKBOOKS_SANDBOX_REFRESH_TOKEN: "rt",
    QUICKBOOKS_SANDBOX_REALM_ID: "9",
  };

  it("is a no-op returning null when unconfigured", () => {
    expect(QuickBooksService.forOrg("org-1", { env: {} })).toBeNull();
  });

  it("exposes the authorization starter and API calls when configured", async () => {
    const fetchFn = mockFetch((url) => {
      if (String(url).includes("oauth2/v1/tokens/bearer")) return tokenResponse();
      return { CompanyInfo: { CompanyName: "Sandbox Co" } };
    });
    const svc = QuickBooksService.forOrg("org-1", { env, fetchFn });
    expect(svc).not.toBeNull();
    const { url, state } = svc!.startAuthorization();
    expect(url).toContain("appcenter.intuit.com");
    expect(state).toBeTruthy();
    const info = await svc!.getCompanyInfo();
    expect(info.companyName).toBe("Sandbox Co");
  });
});
