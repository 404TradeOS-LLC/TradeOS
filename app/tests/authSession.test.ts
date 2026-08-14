import { ApiError } from "../backend/middleware/errorHandler";

type QueryRawMock = jest.Mock;

const mockPrisma = {
  appUser: {
    findUnique: jest.fn(),
  },
  organizationMembership: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("../db/client", () => ({ basePrisma: mockPrisma, prisma: mockPrisma }));

import { resolveAuthContext } from "../backend/auth/session";
import type { AuthClaims } from "../backend/auth/jwt";

function buildClaims(overrides: Partial<AuthClaims> = {}): AuthClaims {
  return {
    sub: "auth-sub-1",
    email: "owner@example.com",
    iss: "tradeos-costbook",
    aud: "tradeos-costbook-api",
    ...overrides,
  };
}

describe("resolveAuthContext (production schema compatibility)", () => {
  let queryRaw: QueryRawMock;

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw = jest.fn().mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (callback: (transaction: typeof mockPrisma & { $queryRaw: QueryRawMock }) => unknown) =>
      callback({ ...mockPrisma, $queryRaw: queryRaw })
    );
  });

  // Migration-3 production reality: the `users` table has no password_hash
  // column (added by a later migration). These mock resolutions deliberately
  // never include passwordHash, matching what a real migration-3 database
  // would actually return through an explicit select -- unlike a bare
  // findUnique, which would attempt to select it and fail.
  const migrationThreeUser = { id: "user-1", isActive: true, email: "owner@example.com" };
  const activeMembership = { orgId: "org-1", role: "admin" };

  it("requests only the explicit minimal user fields, not a bare findUnique", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(migrationThreeUser);
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(activeMembership);

    await resolveAuthContext(buildClaims({ orgId: "org-1" }));

    expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
      where: { authSubject: "auth-sub-1" },
      select: { id: true, isActive: true, email: true },
    });

    const call = mockPrisma.appUser.findUnique.mock.calls[0][0];
    expect(call.select).toBeDefined();
    expect(call.select).not.toHaveProperty("passwordHash");
    expect(Object.keys(call.select)).toEqual(["id", "isActive", "email"]);
  });

  it("succeeds when the resolved user object has no password_hash field at all (migration-3 schema)", async () => {
    // No `passwordHash` key present anywhere on this object -- simulates
    // exactly what an explicit select against a migration-3 database
    // returns, as opposed to a bare select failing before this mock is
    // even reached.
    mockPrisma.appUser.findUnique.mockResolvedValue({ id: "user-1", isActive: true, email: "owner@example.com" });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(activeMembership);

    const auth = await resolveAuthContext(buildClaims({ orgId: "org-1" }));

    expect(auth).toEqual(
      expect.objectContaining({
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
      canonicalRole: "admin",
      email: "owner@example.com",
      })
    );
    expect(auth.permissions).toBeDefined();
    expect(auth.permissions?.length).toBeGreaterThan(0);
  });

  it("rejects an inactive user", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue({ id: "user-1", isActive: false, email: "owner@example.com" });

    await expect(resolveAuthContext(buildClaims())).rejects.toMatchObject(
      new ApiError(403, "Authenticated user is not provisioned in this organization")
    );
    expect(mockPrisma.organizationMembership.findFirst).not.toHaveBeenCalled();
  });

  it("rejects when no app user is provisioned for the auth subject", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(null);

    await expect(resolveAuthContext(buildClaims())).rejects.toMatchObject(
      new ApiError(403, "Authenticated user is not provisioned in this organization")
    );
    expect(mockPrisma.organizationMembership.findFirst).not.toHaveBeenCalled();
  });

  it("rejects when the user has no active organization membership", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(migrationThreeUser);
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

    await expect(resolveAuthContext(buildClaims())).rejects.toMatchObject(
      new ApiError(403, "Authenticated user does not belong to the requested organization")
    );
  });

  it("rejects cross-organization access when the claimed org does not match any active membership", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(migrationThreeUser);
    // The where clause includes orgId when claims.orgId is set; a real
    // Prisma query with a non-matching orgId filter returns null, which is
    // what this asserts the function correctly treats as a rejection rather
    // than falling back to some other membership.
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

    await expect(resolveAuthContext(buildClaims({ orgId: "org-does-not-belong-to-user" }))).rejects.toMatchObject(
      new ApiError(403, "Authenticated user does not belong to the requested organization")
    );

    expect(mockPrisma.organizationMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", status: "active", orgId: "org-does-not-belong-to-user" }),
      })
    );
  });

  it("preserves existing role/permission context unchanged for a valid membership", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(migrationThreeUser);
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({ orgId: "org-1", role: "admin" });

    const auth = await resolveAuthContext(buildClaims({ orgId: "org-1" }));

    // role is the raw stored value; canonicalRole goes through normalizeRole
    // (which maps legacy role values like "viewer"/"estimator" onto their
    // canonical equivalent) -- this fix touches neither, so both should
    // behave exactly as they did before the select was narrowed.
    expect(auth.role).toBe("admin");
    expect(auth.canonicalRole).toBe("admin");
    expect(auth.orgId).toBe("org-1");
    expect(auth.userId).toBe("user-1");
  });

  it("still normalizes a legacy stored role to its canonical equivalent (unchanged behavior)", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(migrationThreeUser);
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({ orgId: "org-1", role: "viewer" });

    const auth = await resolveAuthContext(buildClaims({ orgId: "org-1" }));

    expect(auth.role).toBe("viewer");
    expect(auth.canonicalRole).toBe("technician");
  });
});
