import { createHash, createHmac } from "node:crypto";
import {
  ABC_OAUTH_BROWSER_COOKIE_NAME,
  ABC_OAUTH_CALLBACK_URL,
  ABC_OAUTH_SCOPES,
  abcOAuthCookieDomain,
  buildAuthorizeUrl,
  buildBrowserBindingCookie,
  buildClearBrowserBindingCookie,
  exchangeAuthorizationCode,
  generateBrowserBinding,
  generateOAuthState,
  generatePkcePair,
  hmacTokenHash,
  isOAuthStateHmacConfigured,
  readCookieValue,
} from "../modules/supplier-integration/abcOAuth";
import { AbcSupplyAuth, loadAbcSupplyConfig } from "../modules/supplier-integration/abcSupply";

jest.mock("../modules/supplier-integration/credentialStore", () => ({
  abcSupplyRefreshTokenStore: { load: jest.fn(), persist: jest.fn() },
}));

import { createDurableAbcAuth } from "../modules/supplier-integration/feed";
import { abcSupplyRefreshTokenStore } from "../modules/supplier-integration/credentialStore";

const storeLoad = abcSupplyRefreshTokenStore.load as jest.Mock;

describe("buildAuthorizeUrl", () => {
  const input = {
    clientId: "cid",
    redirectUri: ABC_OAUTH_CALLBACK_URL,
    state: "state123",
    codeChallenge: "challenge123",
  };

  it("emits the sandbox authorize URL with all required parameters", () => {
    const url = new URL(buildAuthorizeUrl(input));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://sandbox.auth.partners.abcsupply.com/oauth2/aus1vp07knpuqf6Xz0h8/v1/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe(ABC_OAUTH_CALLBACK_URL);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(ABC_OAUTH_SCOPES);
    expect(url.searchParams.get("scope")).toContain("pricing.read");
    expect(url.searchParams.get("scope")).toContain("offline_access");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("rejects a redirect URI that is not allowlisted", () => {
    expect(() =>
      buildAuthorizeUrl({ ...input, redirectUri: "https://evil.example/callback" }),
    ).toThrow("ABC OAuth redirect URI is not allowlisted");
  });
});

describe("PKCE and state generation", () => {
  it("generates a valid S256 challenge for its verifier", () => {
    const { verifier, challenge } = generatePkcePair();
    const expected = createHash("sha256").update(verifier, "utf8").digest("base64url");
    expect(challenge).toBe(expected);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique, URL-safe states", () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique, URL-safe browser-binding secrets", () => {
    const a = generateBrowserBinding();
    const b = generateBrowserBinding();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hmacTokenHash", () => {
  const secret = "test-hmac-secret";

  it("hashes deterministically with an explicit secret", () => {
    const expected = createHmac("sha256", secret).update("state:abc", "utf8").digest("hex");
    expect(hmacTokenHash("abc", "state", secret)).toBe(expected);
  });

  it("domain-separates state and browser-binding purposes", () => {
    expect(hmacTokenHash("abc", "state", secret)).not.toBe(hmacTokenHash("abc", "browser-binding", secret));
  });

  it("fails closed when no secret is configured", () => {
    const saved = process.env.ABC_OAUTH_STATE_HMAC_SECRET;
    delete process.env.ABC_OAUTH_STATE_HMAC_SECRET;
    try {
      expect(() => hmacTokenHash("abc", "state")).toThrow("ABC OAuth state HMAC secret is not configured");
      expect(isOAuthStateHmacConfigured()).toBe(false);
    } finally {
      if (saved !== undefined) process.env.ABC_OAUTH_STATE_HMAC_SECRET = saved;
    }
  });

  it("reads the secret from the environment", () => {
    process.env.ABC_OAUTH_STATE_HMAC_SECRET = secret;
    try {
      expect(isOAuthStateHmacConfigured()).toBe(true);
      expect(hmacTokenHash("abc", "state")).toBe(hmacTokenHash("abc", "state", secret));
    } finally {
      delete process.env.ABC_OAUTH_STATE_HMAC_SECRET;
    }
  });
});

describe("browser-binding cookie", () => {
  it("derives the shared registrable domain from the allowlisted callback", () => {
    expect(abcOAuthCookieDomain("api.404tradeos.com")).toBe("404tradeos.com");
    expect(abcOAuthCookieDomain("app.404tradeos.com")).toBe("404tradeos.com");
  });

  it("returns no domain outside the production domain", () => {
    expect(abcOAuthCookieDomain("localhost")).toBeUndefined();
    expect(abcOAuthCookieDomain("evil-404tradeos.com")).toBeUndefined();
  });

  it("serializes a hardened cookie", () => {
    const header = buildBrowserBindingCookie("binding-secret", "api.404tradeos.com");
    expect(header).toContain(`${ABC_OAUTH_BROWSER_COOKIE_NAME}=binding-secret`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Domain=404tradeos.com");
    expect(header).toContain("Max-Age=600");
    expect(header).toContain("Path=/");
  });

  it("reads the binding value from a Cookie header", () => {
    expect(readCookieValue(`other=1; ${ABC_OAUTH_BROWSER_COOKIE_NAME}=abc123; x=2`, ABC_OAUTH_BROWSER_COOKIE_NAME)).toBe("abc123");
    expect(readCookieValue("other=1", ABC_OAUTH_BROWSER_COOKIE_NAME)).toBeNull();
    expect(readCookieValue(undefined, ABC_OAUTH_BROWSER_COOKIE_NAME)).toBeNull();
  });

  it("serializes an expiring cookie with matching name, path, and domain", () => {
    const header = buildClearBrowserBindingCookie("api.404tradeos.com");
    expect(header).toContain(`${ABC_OAUTH_BROWSER_COOKIE_NAME}=`);
    expect(header).not.toContain("binding-secret");
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("Path=/");
    expect(header).toContain("Domain=404tradeos.com");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
  });
});

describe("exchangeAuthorizationCode", () => {
  const input = {
    code: "auth-code",
    codeVerifier: "verifier",
    redirectUri: ABC_OAUTH_CALLBACK_URL,
    clientId: "cid",
    clientSecret: "csecret",
  };

  it("returns the refresh token on success", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "at",
        refresh_token: "new-rt",
        expires_in: 1800,
        scope: "pricing.read offline_access",
      }),
    });
    const result = await exchangeAuthorizationCode({ ...input, fetchFn: fetchFn as unknown as typeof fetch });
    expect(result.refreshToken).toBe("new-rt");
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String((init as { body: unknown }).body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.get("redirect_uri")).toBe(ABC_OAUTH_CALLBACK_URL);
  });

  it("sanitizes provider failures to the HTTP status only", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant", leak: "must-not-surface" }),
    });
    await expect(
      exchangeAuthorizationCode({ ...input, fetchFn: fetchFn as unknown as typeof fetch }),
    ).rejects.toThrow("ABC Supply authorization code exchange failed: HTTP 400");
    await expect(
      exchangeAuthorizationCode({ ...input, fetchFn: fetchFn as unknown as typeof fetch }),
    ).rejects.not.toThrow(/must-not-surface/);
  });

  it("rejects a token response without a refresh token", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "at", expires_in: 1800 }),
    });
    await expect(
      exchangeAuthorizationCode({ ...input, fetchFn: fetchFn as unknown as typeof fetch }),
    ).rejects.toThrow();
  });

  it("refuses a non-allowlisted redirect URI before any network call", async () => {
    const fetchFn = jest.fn();
    await expect(
      exchangeAuthorizationCode({
        ...input,
        redirectUri: "https://evil.example/callback",
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toThrow("ABC OAuth redirect URI is not allowlisted");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("durable refresh-token authority", () => {
  it("loads config without the env bootstrap refresh token", () => {
    const config = loadAbcSupplyConfig({
      ABC_SUPPLY_SANDBOX_CLIENT_ID: "id",
      ABC_SUPPLY_SANDBOX_CLIENT_SECRET: "secret",
      ABC_SUPPLY_BRANCH_NUMBER: "340",
      ABC_SUPPLY_SHIP_TO_NUMBER: "2010466-2",
    });
    expect(config).not.toBeNull();
    expect(config?.refreshToken).toBeNull();
  });

  it("still returns null when core credentials are missing", () => {
    expect(loadAbcSupplyConfig({})).toBeNull();
    expect(
      loadAbcSupplyConfig({
        ABC_SUPPLY_SANDBOX_CLIENT_SECRET: "secret",
        ABC_SUPPLY_BRANCH_NUMBER: "340",
        ABC_SUPPLY_SHIP_TO_NUMBER: "2010466-2",
      }),
    ).toBeNull();
  });

  it("AbcSupplyAuth fails closed without any refresh token", async () => {
    const fetchFn = jest.fn();
    const auth = new AbcSupplyAuth(
      { clientId: "cid", clientSecret: "csecret", refreshToken: null, branchNumber: "340", shipToNumber: "2010466-2" },
      fetchFn as unknown as typeof fetch,
    );
    await expect(auth.getPricingToken()).rejects.toThrow("ABC Supply refresh token is not configured");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("createDurableAbcAuth prefers the durable Vault token over the env bootstrap token", async () => {
    storeLoad.mockResolvedValue("durable-rt");
    const { authConfig } = await createDurableAbcAuth(
      { clientId: "cid", clientSecret: "csecret", refreshToken: "env-rt", branchNumber: "340", shipToNumber: "2010466-2" },
      "org-1",
      "supplier-1",
    );
    expect(authConfig.refreshToken).toBe("durable-rt");
  });

  it("createDurableAbcAuth fails closed when no token exists anywhere", async () => {
    storeLoad.mockResolvedValue(null);
    await expect(
      createDurableAbcAuth(
        { clientId: "cid", clientSecret: "csecret", refreshToken: null, branchNumber: "340", shipToNumber: "2010466-2" },
        "org-1",
        "supplier-1",
      ),
    ).rejects.toThrow("ABC sandbox refresh token is not configured");
  });

  beforeEach(() => {
    storeLoad.mockReset();
  });
});
