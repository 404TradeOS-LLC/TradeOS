jest.mock("../modules/supplier-integration/abcOAuth", () => ({
  ABC_OAUTH_CALLBACK_URL:
    "https://api.404tradeos.com/api/v1/supplier-integrations/abc/oauth/callback",
  ABC_OAUTH_SETTINGS_RETURN_URL: "https://app.404tradeos.com/settings",
  buildAuthorizeUrl: jest.fn(),
  consumeAuthorizationState: jest.fn(),
  createAuthorizationState: jest.fn(),
  exchangeAuthorizationCode: jest.fn(),
}));
jest.mock("../backend/requestContext", () => ({
  requireOrgId: jest.fn(),
  requirePermissions: jest.fn(),
}));
jest.mock("../modules/supplier-integration/credentialStore", () => ({
  abcSupplyRefreshTokenStore: { load: jest.fn(), persist: jest.fn() },
}));
jest.mock("../modules/supplier-integration/service", () => ({
  SupplierIntegrationService: jest.fn().mockImplementation(() => ({})),
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
  buildAuthorizeUrl,
  consumeAuthorizationState,
  createAuthorizationState,
  exchangeAuthorizationCode,
} from "../modules/supplier-integration/abcOAuth";
import { abcSupplyRefreshTokenStore } from "../modules/supplier-integration/credentialStore";
import { requireOrgId, requirePermissions } from "../backend/requestContext";
import { prisma } from "../db/client";

const buildUrl = buildAuthorizeUrl as jest.Mock;
const consume = consumeAuthorizationState as jest.Mock;
const createState = createAuthorizationState as jest.Mock;
const exchange = exchangeAuthorizationCode as jest.Mock;
const permissions = requirePermissions as jest.Mock;
const org = requireOrgId as jest.Mock;
const persist = abcSupplyRefreshTokenStore.persist as jest.Mock;
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
    res.status(error?.statusCode || error?.status || 400).json({ error: "rejected" });
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
    createState.mockResolvedValue({ state: "state-token", codeChallenge: "challenge" });
    buildUrl.mockReturnValue("https://sandbox.example/authorize?state=state-token");
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

  it("returns the authorize URL for an owner", async () => {
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/oauth/authorize");
    expect(response.status).toBe(200);
    expect(response.body.authorizeUrl).toBe("https://sandbox.example/authorize?state=state-token");
    expect(permissions).toHaveBeenCalledWith(expect.anything(), ["costbook.manage"]);
    expect(createState).toHaveBeenCalledWith({ orgId: ORG_ID, userId: USER_ID, supplierId: SUPPLIER_ID });
    expect(buildUrl).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cid", state: "state-token", codeChallenge: "challenge" }),
    );
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
    consume.mockResolvedValue(consumed);
    exchange.mockResolvedValue({ refreshToken: "new-rt", scope: "pricing.read offline_access" });
    persist.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("redirects with an error flag for unknown, expired, or replayed states", async () => {
    consume.mockResolvedValue(null);
    const response = await request(app())
      .get("/api/v1/supplier-integrations/abc/oauth/callback")
      .query({ code: "code", state: "replayed-or-unknown" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("redirects with an error flag when required query params are missing", async () => {
    const response = await request(app()).get("/api/v1/supplier-integrations/abc/oauth/callback");
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(consume).not.toHaveBeenCalled();
  });

  it("sanitizes provider exchange failures: status flag only, no error text in the redirect", async () => {
    exchange.mockRejectedValue(
      new Error("ABC Supply authorization code exchange failed: HTTP 400 :: planted-secret-marker"),
    );
    const response = await request(app())
      .get("/api/v1/supplier-integrations/abc/oauth/callback")
      .query({ code: "bad-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
    expect(response.headers.location).not.toContain("planted-secret-marker");
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists the refresh token and redirects with a success flag", async () => {
    const response = await request(app())
      .get("/api/v1/supplier-integrations/abc/oauth/callback")
      .query({ code: "good-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=success");
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
  });

  it("redirects with an error flag when persistence fails", async () => {
    persist.mockRejectedValue(new Error("ABC Supply rotation requires an active owner/admin tenant session"));
    const response = await request(app())
      .get("/api/v1/supplier-integrations/abc/oauth/callback")
      .query({ code: "good-code", state: "state-token" });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("abc_oauth=error");
  });
});
