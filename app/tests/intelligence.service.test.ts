const mockPrisma = {
  customer: { findMany: jest.fn() },
  project: { findMany: jest.fn() },
  estimate: { findMany: jest.fn() },
  invoice: { findMany: jest.fn() },
  projectFile: { findMany: jest.fn() },
  recentItem: { findMany: jest.fn(), upsert: jest.fn() },
  featureFlag: { findMany: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { FeatureFlagsService, GlobalSearchService, RecentlyViewedService, scoreSearchDocument } from "../modules/intelligence/service";

describe("intelligence foundation services", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scores exact title matches above fuzzy matches", () => {
    const exact = scoreSearchDocument("acme roofing", {
      entityType: "customer",
      entityId: "1",
      title: "Acme Roofing",
      href: "/customers/1",
    });
    const fuzzy = scoreSearchDocument("acme roofing", {
      entityType: "customer",
      entityId: "2",
      title: "Apex Residential",
      subtitle: "Acme roofing referral",
      href: "/customers/2",
    });

    expect(exact.score).toBeGreaterThan(fuzzy.score);
    expect(exact.matchReason).toBe("exact");
  });

  it("returns ranked search results from multiple sources", async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      {
        id: "customer-1",
        name: "Acme Roofing",
        email: "ops@acme.example",
        phone: null,
        address: null,
        updatedAt: new Date("2026-07-03T12:00:00.000Z"),
      },
    ]);
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Acme Warehouse",
        jobType: "Roofing",
        siteAddress: "123 Main St",
        status: "active",
        updatedAt: new Date("2026-07-03T11:00:00.000Z"),
        customer: { name: "Acme Roofing" },
      },
    ]);
    mockPrisma.estimate.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.projectFile.findMany.mockResolvedValue([]);

    const service = new GlobalSearchService();
    const results = await service.search("org-1", { query: "acme", limit: 5 });

    expect(results).toHaveLength(2);
    expect(results[0].entityType).toBe("customer");
    expect(results[1].entityType).toBe("project");
  });

  it("upserts recent items and increments view counts", async () => {
    mockPrisma.recentItem.upsert.mockResolvedValue({
      id: "recent-1",
      orgId: "org-1",
      userId: "user-1",
      entityType: "project",
      entityId: "project-1",
      title: "Kitchen Remodel",
      subtitle: "In progress",
      href: "/projects/project-1",
      keywordsJson: ["kitchen"],
      metadataJson: { status: "active" },
      updatedAtIso: "2026-07-03T12:00:00.000Z",
      lastViewedAt: new Date("2026-07-03T12:00:00.000Z"),
      viewCount: 4,
    });

    const service = new RecentlyViewedService();
    const item = await service.record({
      orgId: "org-1",
      userId: "user-1",
      entityType: "project",
      entityId: "project-1",
      title: "Kitchen Remodel",
      subtitle: "In progress",
      href: "/projects/project-1",
    });

    expect(item.viewCount).toBe(4);
    expect(mockPrisma.recentItem.upsert).toHaveBeenCalled();
  });

  it("evaluates feature flags using scope precedence", async () => {
    mockPrisma.featureFlag.findMany.mockResolvedValue([
      { id: "flag-org", orgId: "org-1", key: "new-command-center", enabled: false, scopeType: "org", scopeKey: "org-1" },
      { id: "flag-user", orgId: "org-1", key: "new-command-center", enabled: true, scopeType: "user", scopeKey: "user-1" },
    ]);

    const service = new FeatureFlagsService();
    const result = await service.evaluate("org-1", "new-command-center", {
      orgId: "org-1",
      userId: "user-1",
    });

    expect(result.enabled).toBe(true);
    expect(result.matchedScope).toBe("user");
  });
});
