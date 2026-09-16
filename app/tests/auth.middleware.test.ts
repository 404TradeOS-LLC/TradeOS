import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";

const mockPrisma = {
  $transaction: jest.fn(),
  appUser: {
    findUnique: jest.fn(),
  },
  organizationMembership: {
    findFirst: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: mockPrisma }));

import { signAuthToken } from "../backend/auth/jwt";
import { requireAuth } from "../backend/middleware/auth";
import { databaseSession } from "../backend/middleware/databaseSession";
import { errorHandler } from "../backend/middleware/errorHandler";

function buildApp() {
  const app = express();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
  });
  app.get("/secure", authLimiter, requireAuth, databaseSession, (req, res) => {
    const authed = req as express.Request & {
      auth?: { userId: string; orgId: string; role: string; email?: string; canonicalRole?: string };
      orgId?: string;
    };

    res.json({
      userId: authed.auth?.userId,
      orgId: authed.orgId,
      role: authed.auth?.role,
      canonicalRole: authed.auth?.canonicalRole,
      email: authed.auth?.email,
    });
  });
  app.use(errorHandler);
  return app;
}

describe("requireAuth middleware", () => {
  const secret = "test-secret";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AUTH_JWT_SECRET: secret,
      AUTH_ISSUER: "tradeos-costbook",
      AUTH_AUDIENCE: "tradeos-costbook-api",
    };
    mockPrisma.$transaction.mockImplementation(async (callback: (transaction: typeof mockPrisma & { $queryRaw: jest.Mock }) => unknown) =>
      callback({ ...mockPrisma, $queryRaw: jest.fn().mockResolvedValue([]) })
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("accepts a signed bearer token and loads the matching membership context", async () => {
    const token = signAuthToken(
      {
        sub: "auth-sub-1",
        email: "owner@example.com",
        orgId: "org-1",
        role: "owner",
        iss: "tradeos-costbook",
        aud: "tradeos-costbook-api",
      },
      secret
    );

    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "auth-sub-1",
      email: "owner@example.com",
      isActive: true,
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "owner",
      status: "active",
    });

    const response = await request(buildApp()).get("/secure").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      canonicalRole: "owner",
      email: "owner@example.com",
    });
  });

  it("rejects unauthenticated requests even when x-org-id is supplied", async () => {
    process.env.AUTH_ALLOW_HEADER_ORG_ID = "true";

    const response = await request(buildApp()).get("/secure").set("x-org-id", "org-1");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing bearer token" });
  });

  it("rejects malformed bearer tokens before any membership lookup", async () => {
    const response = await request(buildApp()).get("/secure").set("Authorization", "Bearer not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid bearer token" });
    expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
  });

  it("rejects expired bearer tokens before any membership lookup", async () => {
    const token = signAuthToken(
      {
        sub: "auth-sub-1",
        email: "owner@example.com",
        iss: "tradeos-costbook",
        aud: "tradeos-costbook-api",
        exp: Math.floor(Date.now() / 1000) - 1,
      },
      secret
    );

    const response = await request(buildApp()).get("/secure").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Bearer token has expired" });
    expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a bearer token with an invalid signature", async () => {
    const token = signAuthToken(
      { sub: "auth-sub-1", iss: "tradeos-costbook", aud: "tradeos-costbook-api" },
      secret
    );
    const [header, payload, signature] = token.split(".");
    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const tampered = `${header}.${payload}.${tamperedSignature}`;

    const response = await request(buildApp()).get("/secure").set("Authorization", `Bearer ${tampered}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid bearer token signature" });
    expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
  });

  it("rejects arbitrary organization-header values without echoing tenant details", async () => {
    process.env.AUTH_ALLOW_HEADER_ORG_ID = "true";

    const response = await request(buildApp()).get("/secure").set("x-org-id", "org-secret-target");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing bearer token");
    expect(JSON.stringify(response.body)).not.toContain("org-secret-target");
  });

  it("rejects a bearer token that requests an organization the user does not belong to", async () => {
    const token = signAuthToken(
      {
        sub: "auth-sub-1",
        email: "owner@example.com",
        orgId: "org-2",
        iss: "tradeos-costbook",
        aud: "tradeos-costbook-api",
      },
      secret
    );

    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "auth-sub-1",
      email: "owner@example.com",
      isActive: true,
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).get("/secure").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Authenticated user does not belong to the requested organization",
    });
  });

  it("fails closed when an authenticated identity has no active organization membership", async () => {
    const token = signAuthToken(
      {
        sub: "auth-sub-1",
        email: "owner@example.com",
        iss: "tradeos-costbook",
        aud: "tradeos-costbook-api",
      },
      secret
    );

    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "auth-sub-1",
      email: "owner@example.com",
      isActive: true,
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).get("/secure").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Authenticated user does not belong to the requested organization",
    });
  });

  it("still allows membership-based tenant selection for a valid authenticated user", async () => {
    const token = signAuthToken(
      {
        sub: "auth-sub-1",
        email: "owner@example.com",
        orgId: "org-2",
        iss: "tradeos-costbook",
        aud: "tradeos-costbook-api",
      },
      secret
    );

    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "auth-sub-1",
      email: "owner@example.com",
      isActive: true,
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-2",
      orgId: "org-2",
      userId: "user-1",
      role: "admin",
      status: "active",
    });

    const response = await request(buildApp()).get("/secure").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.orgId).toBe("org-2");
    expect(response.body.role).toBe("admin");
  });

  it("does not reactivate the old bypass in production mode", async () => {
    process.env.AUTH_ALLOW_HEADER_ORG_ID = "true";
    process.env.NODE_ENV = "production";

    const response = await request(buildApp()).get("/secure").set("x-org-id", "org-1");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing bearer token" });
  });
});
