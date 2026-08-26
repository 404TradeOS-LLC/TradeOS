const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
  },
  appUser: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  organizationMembership: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  organizationMembershipAudit: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  material: {
    findMany: jest.fn(),
  },
  materialPriceAudit: {
    findMany: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { AdminDashboardService } from "../modules/admin-dashboard/service";

describe("AdminDashboardService membership management", () => {
  const ownerActor = { userId: "actor-owner", orgId: "org-1", role: "owner" as const };
  const adminActor = { userId: "actor-admin", orgId: "org-1", role: "admin" as const };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.organizationMembership.count.mockResolvedValue(1);
  });

  it("lists organization members with user details", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.organizationMembership.findMany.mockResolvedValue([
      {
        id: "membership-1",
        userId: "user-1",
        role: "owner",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        user: {
          authSubject: "subject-1",
          email: "owner@example.com",
          fullName: "Owner",
        },
      },
    ]);

    const service = new AdminDashboardService();
    const members = await service.listOrganizationMembers("org-1");

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      membershipId: "membership-1",
      userId: "user-1",
      authSubject: "subject-1",
      email: "owner@example.com",
      fullName: "Owner",
      role: "owner",
      status: "active",
    });
  });

  it("lists filtered material price history newest first", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.materialPriceAudit.findMany.mockResolvedValue([{
      id: "price-audit-1",
      orgId: "org-1",
      materialId: "material-1",
      materialName: "Ready Mix Concrete",
      oldUnitCost: 150,
      newUnitCost: 165,
      source: "manual",
      actorUserId: "actor-admin",
      actorRole: "admin",
      createdAt: new Date("2026-06-24T12:00:00.000Z"),
    }]);

    const rows = await new AdminDashboardService().listMaterialPriceHistory("org-1", {
      materialQuery: "concrete",
      source: "manual",
      limit: 25,
    });

    expect(mockPrisma.materialPriceAudit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orgId: "org-1",
        materialName: { contains: "concrete", mode: "insensitive" },
        source: "manual",
      }),
      orderBy: { createdAt: "desc" },
      take: 25,
    }));
    expect(rows[0]).toMatchObject({ oldUnitCost: 150, newUnitCost: 165 });
  });

  it("provisions or updates a member and membership", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.appUser.findUnique.mockResolvedValue(null);
    mockPrisma.appUser.create.mockResolvedValue({
      id: "user-1",
      authSubject: "subject-1",
      email: "owner@example.com",
      fullName: "Owner",
    });
    mockPrisma.organizationMembership.upsert.mockResolvedValue({
      id: "membership-1",
      userId: "user-1",
      role: "admin",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      user: {
        authSubject: "subject-1",
        email: "owner@example.com",
        fullName: "Owner",
      },
    });

    const service = new AdminDashboardService();
    const member = await service.upsertOrganizationMember("org-1", {
      authSubject: "subject-1",
      email: "owner@example.com",
      fullName: "Owner",
      role: "admin",
    }, ownerActor);

    expect(member.role).toBe("admin");
    expect(mockPrisma.appUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authSubject: "subject-1", email: "owner@example.com", fullName: "Owner" }),
      })
    );
    expect(mockPrisma.organizationMembership.upsert).toHaveBeenCalled();
    expect(mockPrisma.organizationMembershipAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "created",
          actorUserId: "actor-owner",
          actorRole: "owner",
          orgId: "org-1",
        }),
      })
    );
  });

  it("updates and disables existing memberships", async () => {
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "estimator",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      user: {
        authSubject: "subject-1",
        email: "owner@example.com",
        fullName: "Owner",
      },
    });
    mockPrisma.organizationMembership.update.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
      status: "disabled",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      user: {
        authSubject: "subject-1",
        email: "owner@example.com",
        fullName: "Owner",
      },
    });

    const service = new AdminDashboardService();
    const updated = await service.updateOrganizationMember("org-1", "membership-1", { role: "admin", status: "disabled" }, adminActor);
    expect(updated.role).toBe("admin");

    await service.removeOrganizationMember("org-1", "membership-1", adminActor);
    expect(mockPrisma.organizationMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "membership-1" },
        data: { status: "disabled" },
      })
    );
    expect(mockPrisma.organizationMembershipAudit.create).toHaveBeenCalled();
  });

  it("lists membership history in reverse chronological order", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      user: {
        authSubject: "subject-1",
        email: "owner@example.com",
        fullName: "Owner",
      },
    });
    mockPrisma.organizationMembershipAudit.findMany.mockResolvedValue([
      {
        id: "audit-2",
        orgId: "org-1",
        membershipId: "membership-1",
        userId: "user-1",
        action: "updated",
        actorUserId: "actor-owner",
        actorRole: "owner",
        beforeState: {
          membershipId: "membership-1",
          userId: "user-1",
          authSubject: "subject-1",
          email: "owner@example.com",
          fullName: "Owner",
          role: "technician",
          sourceRole: "viewer",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        afterState: {
          membershipId: "membership-1",
          userId: "user-1",
          authSubject: "subject-1",
          email: "owner@example.com",
          fullName: "Owner",
          role: "admin",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);

    const service = new AdminDashboardService();
    const history = await service.listOrganizationMemberHistory("org-1", "membership-1");

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: "audit-2",
      action: "updated",
      actorUserId: "actor-owner",
      actorRole: "owner",
    });
    expect(mockPrisma.organizationMembershipAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-1", membershipId: "membership-1" }),
      })
    );
  });

  it("applies action type and date range filters to membership history", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      user: {
        authSubject: "subject-1",
        email: "owner@example.com",
        fullName: "Owner",
      },
    });
    mockPrisma.organizationMembershipAudit.findMany.mockResolvedValue([]);

    const service = new AdminDashboardService();
    await service.listOrganizationMemberHistory("org-1", "membership-1", {
      actionType: "disabled",
      dateFrom: new Date("2026-01-01T00:00:00.000Z"),
      dateTo: new Date("2026-01-31T23:59:59.000Z"),
    });

    expect(mockPrisma.organizationMembershipAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: "org-1",
          membershipId: "membership-1",
          action: "disabled",
          createdAt: {
            gte: new Date("2026-01-01T00:00:00.000Z"),
            lte: new Date("2026-01-31T23:59:59.000Z"),
          },
        },
      })
    );
  });

  it("paginates membership history and clamps requests beyond the last page", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      user: { authSubject: "subject-1", email: "owner@example.com", fullName: "Owner" },
    });
    mockPrisma.organizationMembershipAudit.count.mockResolvedValue(45);
    mockPrisma.organizationMembershipAudit.findMany.mockResolvedValue([]);

    const service = new AdminDashboardService();
    const page = await service.listOrganizationMemberHistoryPage("org-1", "membership-1", {}, 99, 20);

    expect(page).toMatchObject({ page: 3, pageSize: 20, total: 45, totalPages: 3 });
    expect(mockPrisma.organizationMembershipAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 })
    );
  });

  it("rejects cross-org access and owner lockout edge cases", async () => {
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      orgId: "org-1",
      userId: "user-1",
      role: "owner",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      user: {
        authSubject: "subject-1",
        email: "owner@example.com",
        fullName: "Owner",
      },
    });
    mockPrisma.organizationMembership.count.mockResolvedValue(0);

    const service = new AdminDashboardService();

    await expect(
      service.updateOrganizationMember("org-1", "membership-1", { role: "admin" }, { ...ownerActor, userId: "actor-owner-2" })
    ).rejects.toThrow("Organization must retain at least one active owner");

    await expect(service.updateOrganizationMember("org-1", "membership-1", {}, adminActor)).rejects.toThrow(
      "At least one field must be provided"
    );

    await expect(
      service.upsertOrganizationMember(
        "org-2",
        {
          authSubject: "subject-2",
          email: "new@example.com",
          fullName: "New Person",
          role: "technician",
        },
        ownerActor
      )
    ).rejects.toThrow("Cross-organization access is not allowed");

    await expect(
      service.upsertOrganizationMember(
        "org-1",
        {
          authSubject: "subject-3",
          email: "admin@example.com",
          fullName: "Admin",
          role: "owner",
        },
        adminActor
      )
    ).rejects.toThrow("Only owners can assign owner memberships");
  });
});
