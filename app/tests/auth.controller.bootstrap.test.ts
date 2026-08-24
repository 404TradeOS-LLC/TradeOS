import express from "express";
import request from "supertest";

const mockTransactionClient = {
  $queryRaw: jest.fn(),
  appUser: {
    findFirst: jest.fn(),
  },
  organizationMembership: {
    findFirst: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  },
};

const mockPrisma = {
  $transaction: jest.fn((callback: (tx: typeof mockTransactionClient) => unknown) => callback(mockTransactionClient)),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: mockPrisma }));

import { signAuthToken } from "../backend/auth/jwt";
import { authController } from "../backend/controllers/auth.controller";
import { asyncHandler } from "../backend/middleware/asyncHandler";
import { errorHandler } from "../backend/middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/v1/auth/bootstrap", asyncHandler(authController.bootstrap));
  app.use(errorHandler);
  return app;
}

// POST /api/v1/auth/bootstrap is the one route that links a client-supplied
// organization name to a server-assigned "owner" role and a brand-new
// organization/membership — see the production incident this whole recovery
// flow exists for (docs/CURRENT_STATE.md). These tests pin the HTTP-boundary
// guarantee that the request body can never widen that beyond
// organizationName/regionCode/fullName, regardless of what a modified client
// sends.
describe("POST /api/v1/auth/bootstrap request-body trust boundary", () => {
  const secret = "test-secret";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, AUTH_JWT_SECRET: secret };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each([
    { organizationName: "Acme", role: "owner" },
    { organizationName: "Acme", userId: "attacker-controlled-id" },
    { organizationName: "Acme", authSubject: "supabase:someone-else" },
    { organizationName: "Acme", organizationId: "another-orgs-id" },
  ])("rejects a bootstrap body with an unrecognized privileged field: %j", async (body) => {
    const app = buildApp();
    const token = signAuthToken({ sub: "local:test-user", email: "owner@example.com" }, secret);

    const response = await request(app).post("/api/v1/auth/bootstrap").set("Authorization", `Bearer ${token}`).send(body);

    // Zod's bootstrapSchema is `.strict()` (app/backend/controllers/auth.controller.ts),
    // so an unrecognized key fails validation before AuthService ever runs —
    // this is a stronger guarantee than "the field is ignored", since the
    // request never reaches provisioning logic at all.
    expect(response.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts a bootstrap body with only organizationName/regionCode/fullName", async () => {
    mockTransactionClient.appUser.findFirst.mockResolvedValue({ id: "user-1", email: "owner@example.com", fullName: "Owner Person", isActive: true });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({ id: "membership-1", role: "owner", orgId: "org-1", createdAt: new Date("2024-01-01") });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });

    const app = buildApp();
    const token = signAuthToken({ sub: "local:test-user", email: "owner@example.com" }, secret);

    const response = await request(app)
      .post("/api/v1/auth/bootstrap")
      .set("Authorization", `Bearer ${token}`)
      .send({ organizationName: "Acme", regionCode: "us-east", fullName: "Owner Person" });

    expect(response.status).toBe(201);
    expect(response.body.role).toBe("owner");
  });
});
