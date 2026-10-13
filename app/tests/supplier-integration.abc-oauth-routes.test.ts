jest.mock("../modules/supplier-integration/abcOAuth", () => ({
  ABC_OAUTH_BROWSER_COOKIE_NAME: "abc_oauth_browser",
  ABC_OAUTH_CALLBACK_URL:
    "https://api.404tradeos.com/api/v1/supplier-integrations/abc/oauth/callback",
  ABC_OAUTH_SETTINGS_RETURN_URL: "https://app.404tradeos.com/settings",
  abcOAuthCookieDomain: jest.fn(() => "404tradeos.com"),
  buildAuthorizeUrl: jest.fn(),
  buildBrowserBindingCookie: jest.fn(
    (binding: string) => `abc_oauth_browser=${binding}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ),
  buildClearBrowserBindingCookie: jest.fn(
    () => `abc_oauth_browser=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  ),
  consumeAuthorizationState: jest.fn(),
  createAuthorizationState: jest.fn(),
  exchangeAuthorizationCode: jest.fn(),
  generateBrowserBinding: jest.fn(() => "browser-binding-token"),
  hmacTokenHash: jest.fn((value: string) => `hmac:${value}`),
  isOAuthStateHmacConfigured: jest.fn(() => true),
  readCookieValue: jest.fn((header: string | undefined, name: string) => {
    if (!header) return null;
    for (const part of header.split(";")) {
      const index = part.indexOf("=");
      if (index >= 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim() || null;
    }
    return null;
  }),
}));
jest.mock("../backend/requestContext", () => ({
  requireOrgId: jest.fn(),
  requirePermissions: jest.fn(),
}));
jest.mock("../modules/supplier-integration/credentialStore", () => ({
  abcSupplyRefreshTokenStore: { load: jest.fn(), persist: jest.fn(), persistInCurrentSession: jest.fn() },
}));
jest.mock("../modules/supplier-integration/service", () => ({
  SupplierIntegrationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../modules/supplier-integration/feed", () => ({
  createDurableAbcAuth: jest.fn(),
}));
jest.mock("../modules/supplier-integration/abcSupply", () => ({
  loadAbcSupplyAuthConfig: jest.fn(),
  AbcSupplyPricingClient: jest.fn(),
}));
jest.mock("../modules/supplier-integration/abcAccount", () => ({
  AbcSupplyAccountClient: jest.fn(),
}));
jest.mock("../backend/routes/supplierCronRateLimitStore", () => ({
  SharedSupplierCronRateLimitStore: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    increment: jest.fn(async () => ({ totalHits: 1, resetTime: new Date("2026-10-13T01:00:00Z") })),
  })),
}));
jest.mock("../db/requestSession", () => ({
  runWithBackgroundDatabaseSession: jest.fn((_client: unknown, _input: unknown, operation: () => Promise<unknown>) =>
    operation(),
  ),
}));
jest.mock("../db/client", () => ({
  basePrisma: {},
  prisma: { supplier: { findFirst: jest.fn() } },
}));

import express from "express";
import request from "supertest";
import {
  abcOAuthCallbackRouter,
  supplierIntegrationRouter,
} from "../backend/routes/supplierIntegration.routes";
import {
  ABC_OAUTH_BROWSER_COOKIE_NAME,
  buildAuthorizeUrl,
  consumeAuthorizationState,
  createAuthorizationState,
  exchangeAuthorizationCode,
  isOAuthStateHmacConfigured,
} from "../modules/supplier-integration/abcOAuth";
import { abcSupplyRefreshTokenStore } from "../modules/supplier-integration/credentialStore";
import { createDurableAbcAuth } from "../modules/supplier-integration/feed";
import { AbcSupplyPricingClient, loadAbcSupplyAuthConfig } from "../modules/supplier-integration/abcSupply";
import { AbcSupplyAccountClient } from "../modules/supplier-integration/abcAccount";
import { requireOrgId, requirePermissions } from "../backend/requestContext";
import { prisma } from "../db/client";
import { ApiError } from "../backend/middleware/errorHandler";
import { AbcAccountAuthorizationError } from "../modules/supplier-integration/abcAccountAuthorizationError";

const buildUrl = buildAuthorizeUrl as jest.Mock;
const consume = consumeAuthorizationState as jest.Mock;
const createState = createAuthorizationState as jest.Mock;
const exchange = exchangeAuthorizationCode as jest.Mock;
const hmacConfigured = isOAuthStateHmacConfigured as jest.Mock;
const permissions = requirePermissions as jest.Mock;
const org = requireOrgId as jest.Mock;
const persist = abcSupplyRefreshTokenStore.persistInCurrentSession as jest.Mock;
const independentRotation = abcSupplyRefreshTokenStore.persist as jest.Mock;
const findSupplier = (prisma.supplier.findFirst as jest.Mock);

const ORG_ID = "6d9fbc90-e4db-45b5-b6c7-852def03695a";
const USER_ID = "ce018fa6-2644-44ae-8c19-6899faf0221c";
const SUPPLIER_ID = "bb73490f-a05d-4e2f-abd9-6179a9df31b6";

function app() {
  const server = express();
  server.use(express.json());
  // Mirror server.ts: the callback router mounts before the authenticated middleware.
  server.use("/api/v1/supplier-integrations", abcOAuthCallbackRouter);
  server.use("/api/v1/supplier-integrations", supplierIntegrationRouter);
  server.use((error: any, _req: any, res: any, _next: any) => {
    const status = error?.statusCode || error?.status || (error?.name === "ZodError" ? 400 : 500);
    res.status(status).json({ error: error instanceof ApiError ? error.message : "rejected" });
  });
  return server;
}

describe("POST /abc/oauth/authorize", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = SUPPLIER_ID;
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_ID = "cid";
    org.mockReturnValue(ORG_ID);
    permissions.mockReturnValue({ role: "owner", userId: USER_ID });
    findSupplier.mockResolvedValue({ id: SUPPLIER_ID });
    createState.mockResolvedValue({ state: "state-token", codeChallenge: "challenge", browserBinding: "browser-binding-token" });
    buildUrl.mockReturnValue("https://sandbox.example/authorize?state=state-token");
    hmacConfigured.mockReturnValue(true);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("rejects a non-admin actor even with costbook.manage", async () => {
    permissions.mockReturnValue({ role: "estimator", userId: USER_ID });
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/oauth/authorize");
    expect(response.status).toBe(403);
    expect(createState).not.toHaveBeenCalled();
  });

  it("returns the authorize URL for an owner and sets the browser-binding cookie", async () => {
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/oauth/authorize");
    expect(response.status).toBe(200);
    expect(response.body.authorizeUrl).toBe("https://sandbox.example/authorize?state=state-token");
    expect(permissions).toHaveBeenCalledWith(expect.anything(), ["costbook.manage"]);
    expect(createState).toHaveBeenCalledWith({ orgId: ORG_ID, userId: USER_ID, supplierId: SUPPLIER_ID });
    expect(buildUrl).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cid", state: "state-token", codeChallenge: "challenge" }),
    );
    const setCookie = response.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const setCookieValue = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(setCookieValue).toContain(`${ABC_OAUTH_BROWSER_COOKIE_NAME}=browser-binding-token`);
    expect(setCookieValue).toContain("HttpOnly");
  });

  it("fails closed when the HMAC secret is not configured", async () => {
    hmacConfigured.mockReturnValue(false);
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/oauth/authorize");
    expect(response.status).toBe(503);
    expect(createState).not.toHaveBeenCalled();
  });

  it("fails closed when the ABC supplier is not routed", async () => {
    delete process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID;
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/oauth/authorize");
    expect(response.status).toBe(503);
    expect(createState).not.toHaveBeenCalled();
  });

  it("fails closed when the supplier is not visible to the tenant", async () => {
    findSupplier.mockResolvedValue(null);
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/oauth/authorize");
    expect(response.status).toBe(404);
    expect(createState).not.toHaveBeenCalled();
  });
});

describe("GET /abc/oauth/callback", () => {
  const OLD_ENV = process.env;
  const consumed = {
    orgId: ORG_ID,
    userId: USER_ID,
    supplierId: SUPPLIER_ID,
    codeVerifier: "verifier",
    redirectUri: "https://api.404tradeos.com/api/v1/supplier-integrations/abc/oauth/callback",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_ID = "cid";
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_SECRET = "csecret";
    // Mirror the real wrapper: the state is consumed only when the presented
    // browser-binding secret matches.
    consume.mockImplementation(async (_state: string, binding: string | null) =>
      binding === "browser-binding-token" ? consumed : null,
    );
    exchange.mockResolvedValue({ refreshToken: "new-rt", scope: "pricing.read offline_access" });
    persist.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const callbackWithBinding = (binding: string | null, query: Record<string, string>) => {
    const req = request(app()).get("/api/v1/supplier-integrations/abc/oauth/callback").query(query);
    return binding === null ? req : req.set("Cookie", `${ABC_OAUTH_BROWSER_COOKIE_NAME}=${binding}`);
  };

  it("redirects with an error flag for unknown, expired, or replayed states", async () => {
    consume.mockResolvedValue(null);
    const response = await callbackWithBinding("browser-binding-token", { code: "code", state: "replayed-or-unknown" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(response.headers.location).toContain("abc_oauth_step=state");
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("redirects with an error flag when required query params are missing", async () => {
    const response = await request(app()).get("/api/v1/supplier-integrations/abc/oauth/callback");
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(response.headers.location).toContain("abc_oauth_step=request");
    expect(consume).not.toHaveBeenCalled();
  });

  it("rejects the callback without consuming state when the binding cookie is missing", async () => {
    const response = await callbackWithBinding(null, { code: "good-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(response.headers.location).toContain("abc_oauth_step=state");
    expect(consume).toHaveBeenCalledWith("state-token", null);
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects the callback when the binding cookie does not match", async () => {
    const response = await callbackWithBinding("attacker-binding", { code: "good-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(response.headers.location).toContain("abc_oauth_step=state");
    expect(consume).toHaveBeenCalledWith("state-token", "attacker-binding");
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it.each(["ABC_SUPPLY_SANDBOX_CLIENT_ID", "ABC_SUPPLY_SANDBOX_CLIENT_SECRET"] as const)(
    "classifies missing %s as an exchange-stage failure after valid state consumption",
    async (credential) => {
      delete process.env[credential];
      const response = await callbackWithBinding("browser-binding-token", {
        code: "good-code",
        state: "state-token",
      });
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("abc_oauth=error");
      expect(response.headers.location).toContain("abc_oauth_step=exchange");
      expect(consume).toHaveBeenCalledWith("state-token", "browser-binding-token");
      expect(exchange).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    },
  );

  it("sanitizes provider exchange failures: status flag only, no error text in the redirect", async () => {
    exchange.mockRejectedValue(
      new Error("ABC Supply authorization code exchange failed: HTTP 400 :: planted-secret-marker"),
    );
    const response = await callbackWithBinding("browser-binding-token", { code: "bad-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(response.headers.location).toContain("abc_oauth_step=exchange");
    expect(response.headers.location).not.toContain("planted-secret-marker");
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists the refresh token and redirects with a success flag", async () => {
    const response = await callbackWithBinding("browser-binding-token", { code: "good-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=success");
    expect(response.headers.location).not.toContain("abc_oauth_step=");
    expect(exchange).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "good-code",
        codeVerifier: "verifier",
        redirectUri: "https://api.404tradeos.com/api/v1/supplier-integrations/abc/oauth/callback",
        clientId: "cid",
        clientSecret: "csecret",
      }),
    );
    expect(persist).toHaveBeenCalledWith(ORG_ID, SUPPLIER_ID, "new-rt");
    expect(independentRotation).not.toHaveBeenCalled();
  });

  it("expires the browser-binding cookie on the callback redirect", async () => {
    const response = await callbackWithBinding("browser-binding-token", { code: "good-code", state: "state-token" });
    expect(response.status).toBe(302);
    const rawSetCookie = response.headers["set-cookie"];
    const setCookie = Array.isArray(rawSetCookie) ? rawSetCookie.join("; ") : (rawSetCookie ?? "");
    expect(setCookie).toContain(`${ABC_OAUTH_BROWSER_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");
  });

  it("redirects with an error flag when persistence fails", async () => {
    persist.mockRejectedValue(new Error("ABC Supply rotation requires an active owner/admin tenant session"));
    const response = await callbackWithBinding("browser-binding-token", { code: "good-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(response.headers.location).toContain("abc_oauth_step=persist");
  });
});

describe("GET /abc/accounts (read-only sandbox Ship-To discovery)", () => {
  const oldEnv = process.env;
  const getAuth = createDurableAbcAuth as jest.Mock;
  const loadConfig = loadAbcSupplyAuthConfig as jest.Mock;
  const accountClient = AbcSupplyAccountClient as jest.Mock;
  const search = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv, ABC_SUPPLY_SANDBOX_SUPPLIER_ID: SUPPLIER_ID };
    org.mockReturnValue(ORG_ID);
    permissions.mockReturnValue({ role: "owner", userId: USER_ID });
    findSupplier.mockResolvedValue({ id: SUPPLIER_ID });
    // Search Accounts requires no preselected branch or Ship-To.
    loadConfig.mockReturnValue({ clientId: "cid", clientSecret: "private", refreshToken: null });
    getAuth.mockResolvedValue({ auth: { getAccountToken: jest.fn() } });
    accountClient.mockImplementation(() => ({ searchShipToAccounts: search }));
    search.mockResolvedValue([{ number: "2010466-2", name: "Example account", status: "active",
      branches: [{ number: "340", name: "Branch 340", status: "active", homeBranch: true }] }]);
  });

  afterAll(() => { process.env = oldEnv; });

  const path = "/api/v1/supplier-integrations/abc/accounts";

  it.each(["owner", "admin"])("returns authorized Ship-To accounts for a %s without writing prices", async (role) => {
    permissions.mockReturnValue({ role, userId: USER_ID });
    const response = await request(app()).get(path);
    expect(response.status).toBe(200);
    expect(response.body.accounts).toHaveLength(1);
    expect(response.body.accounts[0].branches[0].number).toBe("340");
    expect(response.body).not.toHaveProperty("refreshToken");
    expect(permissions).toHaveBeenCalledWith(expect.anything(), ["costbook.manage"]);
    expect(findSupplier).toHaveBeenCalledWith({ where: { id: SUPPLIER_ID, orgId: ORG_ID, apiIntegrationKey: "ABC_SUPPLY" }, select: { id: true } });
    expect(getAuth).toHaveBeenCalledWith(expect.objectContaining({ clientId: "cid" }), ORG_ID, SUPPLIER_ID);
    expect(search).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(independentRotation).not.toHaveBeenCalled();
  });

  it("rejects non-owner/admin roles even when they have costbook.manage", async () => {
    permissions.mockReturnValue({ role: "estimator", userId: USER_ID });
    expect((await request(app()).get(path)).status).toBe(403);
    expect(findSupplier).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("rejects tenant, branch, or supplier overrides from request query", async () => {
    const response = await request(app()).get(path).query({ orgId: "another-org", branchNumber: "579" });
    expect(response.status).toBe(400);
    expect(findSupplier).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("fails closed when the ABC supplier belongs to another workspace", async () => {
    findSupplier.mockResolvedValue(null);
    expect((await request(app()).get(path)).status).toBe(404);
    expect(getAuth).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("fails closed with missing tenant supplier routing or sandbox credentials", async () => {
    delete process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID;
    expect((await request(app()).get(path)).status).toBe(503);
    expect(getAuth).not.toHaveBeenCalled();
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = SUPPLIER_ID;
    loadConfig.mockReturnValue(null);
    expect((await request(app()).get(path)).status).toBe(503);
    expect(getAuth).not.toHaveBeenCalled();
  });

  it.each([
    "ABC sandbox refresh token is not configured",
    "ABC Supply token refresh failed: HTTP 400",
    "ABC Supply token refresh failed: HTTP 403",
    "ABC Supply Search Accounts request failed: HTTP 403",
  ])("returns a safe 409 reconnection instruction for %s", async (reason) => {
    search.mockRejectedValue(new AbcAccountAuthorizationError(reason));
    const response = await request(app()).get(path);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("account.read");
    expect(JSON.stringify(response.body)).not.toContain("private");
  });

  it("returns a reconnect response if Vault has no ABC refresh grant", async () => {
    getAuth.mockRejectedValueOnce(new AbcAccountAuthorizationError("ABC sandbox refresh token is not configured"));
    const response = await request(app()).get(path);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("account.read");
    expect(search).not.toHaveBeenCalled();
  });

  it("does not return an untrusted provider failure body", async () => {
    search.mockRejectedValue(new Error("ABC Supply Search Accounts request failed: HTTP 502"));
    const response = await request(app()).get(path);
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("502");
  });

  it("never initiates a provider request when costbook.manage is denied", async () => {
    permissions.mockImplementation(() => { throw new ApiError(403, "Permission denied"); });
    const response = await request(app()).get(path);
    expect(response.status).toBe(403);
    expect(findSupplier).not.toHaveBeenCalled();
    expect(getAuth).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });
});

describe("selected ABC sandbox quote enforces account membership and no-write boundaries", () => {
  const oldEnv = process.env;
  const auth = createDurableAbcAuth as jest.Mock;
  const config = loadAbcSupplyAuthConfig as jest.Mock;
  const accounts = AbcSupplyAccountClient as jest.Mock;
  const pricing = AbcSupplyPricingClient as jest.Mock;
  const search = jest.fn();
  const quote = jest.fn();
  const path = "/api/v1/supplier-integrations/abc/selected-price-probe";
  const body = { shipToNumber: "2010466-2", branchNumber: "340", sku: "654210" };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv, ABC_SUPPLY_SANDBOX_SUPPLIER_ID: SUPPLIER_ID };
    org.mockReturnValue(ORG_ID);
    permissions.mockReturnValue({ role: "owner", userId: USER_ID });
    findSupplier.mockResolvedValue({ id: SUPPLIER_ID });
    config.mockReturnValue({ clientId: "cid", clientSecret: "private", refreshToken: null });
    auth.mockResolvedValue({ auth: { getAccountToken: jest.fn(), getPricingToken: jest.fn() } });
    accounts.mockImplementation(() => ({ searchShipToAccounts: search }));
    pricing.mockImplementation(() => ({ priceItems: quote }));
    search.mockResolvedValue([{ number: body.shipToNumber, status: "active", branches: [
      { number: body.branchNumber, status: "active", homeBranch: true },
    ] }]);
    quote.mockResolvedValue([{ id: "selected-review-0", itemNumber: "654210",
      statusCode: "OK", currencyCode: "USD", unitPrice: 19.5, uom: "RL" }]);
  });
  afterAll(() => { process.env = oldEnv; });

  it("returns read-only provider price and UOM without approving or saving them", async () => {
    const response = await request(app()).post(path).send(body);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      priced: true, price: 19.5, currency: "USD", stockingUnit: "RL",
      materialCreated: false, priceApplied: false, accountPreferenceSaved: false,
      unitMappingVerified: false,
    });
    expect(search).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(quote).toHaveBeenCalledWith(
      [{ id: "selected-review-0", itemNumber: "654210", quantity: 1 }],
      { shipToNumber: body.shipToNumber, branchNumber: body.branchNumber },
      expect.any(AbortSignal),
    );
    expect(findSupplier).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: SUPPLIER_ID, orgId: ORG_ID, apiIntegrationKey: "ABC_SUPPLY" },
    }));
  });

  it.each([
    ["other account", { ...body, shipToNumber: "another" }],
    ["other branch", { ...body, branchNumber: "987" }],
  ])("denies %s before pricing", async (_name, payload) => {
    expect((await request(app()).post(path).send(payload)).status).toBe(403);
    expect(quote).not.toHaveBeenCalled();
  });

  it("requires active branch and active account", async () => {
    search.mockResolvedValue([{ number: body.shipToNumber, status: "inactive",
      branches: [{ number: body.branchNumber, status: "active" }] }]);
    expect((await request(app()).post(path).send(body)).status).toBe(403);
    search.mockResolvedValue([{ number: body.shipToNumber, status: "active",
      branches: [{ number: body.branchNumber, status: "inactive" }] }]);
    expect((await request(app()).post(path).send(body)).status).toBe(403);
    expect(quote).not.toHaveBeenCalled();
  });

  it.each([
    { ...body, sku: "UNKNOWN" },
    { ...body, sku: "../../../token" },
    { ...body, orgId: ORG_ID },
    { ...body, quantity: 10 },
  ])("rejects unallowlisted or excess request input", async (payload) => {
    expect((await request(app()).post(path).send(payload)).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it("denies staff roles before retrieving customer data", async () => {
    permissions.mockReturnValue({ role: "estimator", userId: USER_ID });
    expect((await request(app()).post(path).send(body)).status).toBe(403);
    expect(search).not.toHaveBeenCalled();
  });

  it("does not quote from another tenant's supplier", async () => {
    findSupplier.mockResolvedValue(null);
    expect((await request(app()).post(path).send(body)).status).toBe(404);
    expect(quote).not.toHaveBeenCalled();
  });

  it.each([
    ["Error", 0, "USD", "RL"],
    ["OK", 0, "USD", "RL"],
    ["OK", 19.5, "EUR", "RL"],
    ["OK", 19.5, "USD", null],
  ])("rejects untrusted line status/price/unit %s %s %s %s", async (statusCode, unitPrice, currencyCode, uom) => {
    quote.mockResolvedValue([{ id: "selected-review-0", itemNumber: body.sku,
      statusCode, unitPrice, currencyCode, uom }]);
    const response = await request(app()).post(path).send(body);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ priced: false, price: null, stockingUnit: null, priceApplied: false });
  });

  it("does not expose provider messages and rejects duplicate matching lines", async () => {
    quote.mockResolvedValueOnce([
      { id: "selected-review-0", itemNumber: body.sku, statusCode: "OK", unitPrice: 1, uom: "RL", currencyCode: "USD" },
      { id: "selected-review-0", itemNumber: body.sku, statusCode: "OK", unitPrice: 2, uom: "RL", currencyCode: "USD" },
    ]);
    expect((await request(app()).post(path).send(body)).status).toBe(502);
    quote.mockRejectedValueOnce(new Error("ABC provider returned private account details"));
    const response = await request(app()).post(path).send(body);
    expect(response.status).toBe(502);
    expect(JSON.stringify(response.body)).not.toContain("private account details");
  });

  it("gives a safe reconnect response if the account grant is stale", async () => {
    search.mockRejectedValue(new AbcAccountAuthorizationError("ABC Search Accounts rejected grant"));
    expect((await request(app()).post(path).send(body)).status).toBe(409);
    expect(quote).not.toHaveBeenCalled();
  });
});
