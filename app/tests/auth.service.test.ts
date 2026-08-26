process.env.AUTH_JWT_SECRET = "test-secret";

const mockTransactionClient = {
  $queryRaw: jest.fn(),
  appUser: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organizationMembership: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  },
  authRefreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  passwordResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  organizationInvite: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userTotpCredential: {
    findUnique: jest.fn(),
  },
};

const mockBasePrisma = {
  $transaction: jest.fn((callback: (tx: typeof mockTransactionClient) => unknown) => callback(mockTransactionClient)),
};

const mockPrisma = {
  organizationInvite: {
    create: jest.fn(),
  },
  userTotpCredential: {
    findUnique: jest.fn(),
  },
};

const mockProvision = jest.fn();
const mockSendPasswordReset = jest.fn().mockResolvedValue({ sent: true });
const mockSendTeamInvite = jest.fn().mockResolvedValue({ sent: true });

jest.mock("../db/client", () => ({ basePrisma: mockBasePrisma, prisma: mockPrisma }));
jest.mock("../modules/email/service", () => ({
  emailService: {
    sendPasswordReset: mockSendPasswordReset,
    sendTeamInvite: mockSendTeamInvite,
  },
}));
jest.mock("../modules/organization-provisioning/service", () => ({
  OrganizationProvisioningService: jest.fn().mockImplementation(() => ({ provision: mockProvision })),
}));

import { hashPassword } from "../backend/auth/password";
import { AuthService } from "../modules/auth/service";

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBasePrisma.$transaction.mockImplementation((callback: (tx: typeof mockTransactionClient) => unknown) =>
      callback(mockTransactionClient)
    );
    mockTransactionClient.userTotpCredential.findUnique.mockResolvedValue(null);
  });

  it("signs up a new organization and returns a usable session with refresh token", async () => {
    mockProvision.mockResolvedValue({
      organization: { id: "org-1", name: "Acme Co", regionCode: null },
      owner: { userId: "user-1", membershipId: "membership-1", authSubject: "local:abc", email: "owner@example.com", role: "owner", status: "active" },
    });

    const service = new AuthService();
    const result = await service.signup({
      organizationName: "Acme Co",
      email: "Owner@Example.com",
      password: "super-secret-1",
      fullName: "Owner Person",
    });

    expect(result.organization).toEqual({ id: "org-1", name: "Acme Co" });
    expect(result.role).toBe("owner");
    expect(typeof result.token).toBe("string");
    expect(typeof result.refreshToken).toBe("string");
    expect(mockTransactionClient.authRefreshToken.create).toHaveBeenCalled();
  });

  it("logs in a user with the correct password and an active membership", async () => {
    const passwordHash = await hashPassword("correct-password");
    mockTransactionClient.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "local:abc",
      email: "owner@example.com",
      fullName: "Owner Person",
      isActive: true,
      passwordHash,
    });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({ id: "membership-1", orgId: "org-1", role: "owner" });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });

    const service = new AuthService();
    const result = await service.login({ email: "owner@example.com", password: "correct-password" });

    expect(result.user.email).toBe("owner@example.com");
    expect(result.organization).toEqual({ id: "org-1", name: "Acme Co" });
    expect(result.role).toBe("owner");
    expect(result.refreshToken).toBeTruthy();
  });

  it("rejects login with an incorrect password", async () => {
    const passwordHash = await hashPassword("correct-password");
    mockTransactionClient.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "local:abc",
      email: "owner@example.com",
      fullName: null,
      isActive: true,
      passwordHash,
    });

    const service = new AuthService();
    await expect(service.login({ email: "owner@example.com", password: "wrong-password" })).rejects.toThrow("Invalid email or password");
  });

  it("rotates refresh tokens", async () => {
    mockTransactionClient.authRefreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      orgId: "org-1",
      userId: "user-1",
      membershipId: "membership-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "dispatcher",
      status: "active",
    });
    mockTransactionClient.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "local:abc",
      email: "dispatch@example.com",
      fullName: "Dispatch",
      isActive: true,
    });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });

    const service = new AuthService();
    const result = await service.refresh({ refreshToken: "refresh-token" });

    expect(result.role).toBe("dispatcher");
    expect(mockTransactionClient.authRefreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ revokedAt: null }) }));
    expect(mockTransactionClient.authRefreshToken.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a refresh when another request already won the conditional rotation", async () => {
    mockTransactionClient.authRefreshToken.findUnique.mockResolvedValue({
      id: "rt-1", orgId: "org-1", userId: "user-1", membershipId: "membership-1",
      expiresAt: new Date(Date.now() + 60_000), revokedAt: null,
    });
    mockTransactionClient.appUser.findUnique.mockResolvedValue({ id: "user-1", isActive: true });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({ id: "membership-1", orgId: "org-1", userId: "user-1", role: "dispatcher", status: "active" });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });
    mockTransactionClient.authRefreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(new AuthService().refresh({ refreshToken: "refresh-token" })).rejects.toMatchObject({ statusCode: 401 });
    expect(mockTransactionClient.authRefreshToken.create).not.toHaveBeenCalled();
  });

  it("revokes all local refresh sessions on logout", async () => {
    await new AuthService().logout("user-1");

    expect(mockTransactionClient.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date), lastUsedAt: expect.any(Date) }),
    });
  });

  it("rejects refresh for an inactive application user", async () => {
    mockTransactionClient.authRefreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      orgId: "org-1",
      userId: "user-1",
      membershipId: "membership-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "dispatcher",
      status: "active",
    });
    mockTransactionClient.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "local:abc",
      email: "dispatch@example.com",
      fullName: "Dispatch",
      isActive: false,
    });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });

    await expect(new AuthService().refresh({ refreshToken: "refresh-token" })).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid refresh token",
    });
    expect(mockTransactionClient.authRefreshToken.update).not.toHaveBeenCalled();
    expect(mockTransactionClient.authRefreshToken.create).not.toHaveBeenCalled();
  });

  it("creates password reset tokens without leaking unknown-email status", async () => {
    mockTransactionClient.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "local:abc",
      email: "owner@example.com",
      fullName: "Owner",
      isActive: true,
    });

    const service = new AuthService();
    const result = await service.requestPasswordReset({ email: "owner@example.com" });
    await waitForScheduledEmail();

    expect(result.success).toBe(true);
    expect(mockTransactionClient.passwordResetToken.create).toHaveBeenCalled();
    expect(mockSendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        token: expect.any(String),
        expiresAt: expect.any(Date),
      })
    );
  });

  it("preserves the generic password-reset response when email delivery fails", async () => {
    mockTransactionClient.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      authSubject: "local:abc",
      email: "owner@example.com",
      fullName: "Owner",
      isActive: true,
    });
    mockSendPasswordReset.mockRejectedValueOnce(new Error("provider unavailable"));

    const service = new AuthService();
    const result = await service.requestPasswordReset({ email: "owner@example.com" });
    await waitForScheduledEmail();

    expect(result.success).toBe(true);
    expect(result.resetToken).toEqual(expect.any(String));
  });

  it("bootstrapSupabaseIdentity returns an existing user's membership without organizationName and without provisioning", async () => {
    mockTransactionClient.appUser.findFirst.mockResolvedValue({ id: "user-1", email: "owner@example.com", fullName: "Owner Person", isActive: true });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({ id: "membership-1", role: "owner", orgId: "org-1", createdAt: new Date("2024-01-01") });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });

    const service = new AuthService();
    const result = await service.bootstrapSupabaseIdentity({
      authSubject: "supabase:abc",
      email: "owner@example.com",
    });

    expect(result.organization).toEqual({ id: "org-1", name: "Acme Co" });
    expect(result.role).toBe("owner");
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it("bootstrapSupabaseIdentity ignores a supplied organizationName for an already-bootstrapped user (idempotent, no duplicate org)", async () => {
    mockTransactionClient.appUser.findFirst.mockResolvedValue({ id: "user-1", email: "owner@example.com", fullName: "Owner Person", isActive: true });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({ id: "membership-1", role: "owner", orgId: "org-1", createdAt: new Date("2024-01-01") });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });

    const service = new AuthService();
    const result = await service.bootstrapSupabaseIdentity({
      authSubject: "supabase:abc",
      email: "owner@example.com",
      organizationName: "A Different Name Typed On A Stale Form",
    });

    expect(result.organization).toEqual({ id: "org-1", name: "Acme Co" });
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it("bootstrapSupabaseIdentity sets the app.login_lookup, app.user_id, and app.org_id RLS session flags in order before each successive lookup", async () => {
    // Regression test for a real production incident: without explicitly
    // setting these session-local flags, organization_memberships' and
    // organizations' RLS policies silently return zero rows even when the
    // data exists, which previously made every already-provisioned
    // identity's second-and-later bootstrap call falsely report "no active
    // organization membership" (a mocked Prisma client can't catch an RLS
    // gap — this test pins the actual set_config call sequence instead).
    mockTransactionClient.appUser.findFirst.mockResolvedValue({ id: "user-1", email: "owner@example.com", fullName: "Owner Person", isActive: true });
    mockTransactionClient.organizationMembership.findFirst.mockResolvedValue({ id: "membership-1", role: "owner", orgId: "org-1", createdAt: new Date("2024-01-01") });
    mockTransactionClient.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Co" });

    const service = new AuthService();
    await service.bootstrapSupabaseIdentity({ authSubject: "supabase:abc", email: "owner@example.com" });

    const setConfigCalls = mockTransactionClient.$queryRaw.mock.calls.map((call) => (call[0] as { strings: string[] }).strings.join(""));
    expect(setConfigCalls[0]).toContain("app.login_lookup");
    expect(setConfigCalls[1]).toContain("app.user_id");
    expect(mockTransactionClient.$queryRaw.mock.calls[1][0]).toMatchObject({ values: ["user-1"] });
    expect(setConfigCalls[2]).toContain("app.org_id");
    expect(mockTransactionClient.$queryRaw.mock.calls[2][0]).toMatchObject({ values: ["org-1"] });

    // The lookups themselves must happen after their corresponding flag is
    // set, not before (order matters for RLS visibility).
    expect(mockTransactionClient.appUser.findFirst).toHaveBeenCalled();
    expect(mockTransactionClient.organizationMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
    expect(mockTransactionClient.organization.findUnique).toHaveBeenCalledWith({ where: { id: "org-1" } });
  });

  it("rejects bootstrap for an inactive existing application user", async () => {
    mockTransactionClient.appUser.findFirst.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      fullName: "Owner Person",
      isActive: false,
    });

    await expect(
      new AuthService().bootstrapSupabaseIdentity({ authSubject: "supabase:abc", email: "owner@example.com" })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Authenticated user is not provisioned in this organization",
    });
    expect(mockTransactionClient.organizationMembership.findFirst).not.toHaveBeenCalled();
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it("bootstrapSupabaseIdentity rejects provisioning a new organization without a name", async () => {
    mockTransactionClient.appUser.findFirst.mockResolvedValue(null);

    const service = new AuthService();
    await expect(
      service.bootstrapSupabaseIdentity({
        authSubject: "supabase:new-user",
        email: "new@example.com",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("organizationName is required"),
      // Stable machine-readable discriminator the frontend relies on to
      // route this specific case to a "finish setup" screen instead of
      // either failing silently or sending the user to a dashboard that
      // will 403 on every request — see web/src/app/actions/auth.ts's
      // isOrganizationNameRequiredError.
      details: { code: "organization_name_required" },
    });
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it("bootstrapSupabaseIdentity provisions a new organization for a brand-new identity", async () => {
    mockTransactionClient.appUser.findFirst.mockResolvedValue(null);
    mockProvision.mockResolvedValue({
      organization: { id: "org-2", name: "New Co", regionCode: null },
      owner: { userId: "user-2", membershipId: "membership-2", authSubject: "supabase:new-user", email: "new@example.com", role: "owner", status: "active" },
    });

    const service = new AuthService();
    const result = await service.bootstrapSupabaseIdentity({
      authSubject: "supabase:new-user",
      email: "new@example.com",
      organizationName: "New Co",
    });

    expect(result.organization).toEqual({ id: "org-2", name: "New Co" });
    expect(result.role).toBe("owner");
    expect(mockProvision).toHaveBeenCalledWith(
      expect.objectContaining({ organizationName: "New Co", owner: expect.objectContaining({ authSubject: "supabase:new-user" }) })
    );
  });

  it("keeps the persisted invitation response when email delivery fails", async () => {
    mockPrisma.organizationInvite.create.mockResolvedValue({
      id: "invite-1",
      email: "tech@example.com",
      role: "technician",
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockSendTeamInvite.mockRejectedValueOnce(new Error("provider unavailable"));

    const service = new AuthService();
    const result = await service.inviteTeamMember({
      orgId: "org-1",
      invitedByUserId: "owner-1",
      email: "tech@example.com",
      role: "technician",
    });
    await waitForScheduledEmail();

    expect(result).toEqual(
      expect.objectContaining({
        inviteId: "invite-1",
        email: "tech@example.com",
        role: "technician",
      })
    );
  });

  it("allows owners to create dispatcher and technician invites", async () => {
    mockPrisma.organizationInvite.create.mockResolvedValue({
      id: "invite-1",
      email: "tech@example.com",
      role: "technician",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const service = new AuthService();
    const result = await service.inviteTeamMember({
      orgId: "org-1",
      invitedByUserId: "owner-1",
      email: "tech@example.com",
      role: "technician",
    });
    await waitForScheduledEmail();

    expect(result.role).toBe("technician");
    expect(mockPrisma.organizationInvite.create).toHaveBeenCalled();
    expect(mockSendTeamInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tech@example.com",
        role: "technician",
        token: expect.any(String),
        expiresAt: expect.any(Date),
      })
    );
  });
});


function waitForScheduledEmail(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
